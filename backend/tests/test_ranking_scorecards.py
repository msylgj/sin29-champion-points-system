"""PDF结构/字体/矢量布局及隔离HTTP测试；不使用真实参赛者数据。"""
from copy import deepcopy
from datetime import datetime, timezone
import base64
import re
import shutil
import subprocess
from unittest.mock import MagicMock
import zlib

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from sqlalchemy import create_engine, event as sql_event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models.event import Event
from app.models.event_configuration import EventConfiguration
from app.models.event_registration import EventRegistration
from app.models.score import Score
from app.models.scoring_rule import ScoringRule
from app.routers import ranking_scorecards as routes
from app.routers.ranking_scorecards import RankingScorecardRequest
from app.security import create_admin_access_token
from app.services import ranking_scorecard_pdf as renderer


@pytest.fixture
def payload():
    return {"pages": [{
        "group": "C组10米反曲弓组", "round": "第一轮",
        "positions": [
            {"target": "1A", "club": "示例俱乐部", "athlete": "测试甲"},
            {"target": "1B", "club": "Example Archery Club", "athlete": "测试乙*"},
            {"target": "1C", "club": "O’Neil — Club", "athlete": "示例丙"},
            {"target": "1D", "club": "", "athlete": ""},
        ],
    }]}


def mock_generation_clock(monkeypatch, instant):
    clock = MagicMock()
    clock.now.side_effect = lambda tz: instant.astimezone(tz)
    monkeypatch.setattr(renderer, "datetime", clock)
    return clock


@pytest.fixture
def october_generation(monkeypatch):
    mock_generation_clock(monkeypatch, datetime(2026, 10, 15, tzinfo=timezone.utc))


@pytest.fixture
def engine():
    value = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(value)
    with Session(value) as db:
        db.add(Event(id=42, year=2026, season="秋季赛"))
        db.add(Event(id=99, year=2025, season="冬季赛"))
        db.flush()
        db.add_all([
            EventRegistration(year=2026, season="秋季赛", name="保存记录", club="仅测试", distance="30m",
                              competition_bow_type="recurve", points_bow_type="recurve", competition_gender_group="men"),
            Score(event_id=42, name="保存记录", bow_type="recurve", distance="30m", format="ranking", gender_group="men", rank=1),
            EventConfiguration(event_id=42, gender_group="men", bow_type="recurve", distance="30m", individual_participant_count=20),
            ScoringRule(name="不可变快照", start_key=0, config={"snapshot": [25, 22, 19]}),
        ])
        db.commit()
    try:
        yield value
    finally:
        value.dispose()


@pytest.fixture
def client(engine):
    app = FastAPI()
    app.include_router(routes.router)

    def isolated_db():
        with Session(engine) as db:
            yield db

    app.dependency_overrides[get_db] = isolated_db
    with TestClient(app) as http:
        yield http


@pytest.fixture
def headers():
    return {"Authorization": f"Bearer {create_admin_access_token()}"}


def all_records(engine):
    with engine.connect() as connection:
        return {table.name: [deepcopy(dict(row)) for row in connection.execute(table.select()).mappings()]
                for table in Base.metadata.sorted_tables}


def objects(pdf):
    return {int(match.group(1)): match.group(2) for match in re.finditer(rb"(\d+) 0 obj\s*(.*?)endobj", pdf, re.S)}


def decoded_stream(obj):
    marker = re.search(rb"stream\r?\n", obj)
    length = re.search(rb"/Length\s+(\d+)", obj[:marker.start()])
    value = obj[marker.end():marker.end() + int(length.group(1))]
    if b"ASCII85Decode" in obj[:marker.start()]:
        value = base64.a85decode(value, adobe=True)
    if b"FlateDecode" in obj[:marker.start()]:
        value = zlib.decompress(value)
    return value


def page_streams(pdf):
    values = objects(pdf)
    pages = [obj for obj in values.values() if re.search(rb"/Type\s*/Page\b", obj)]
    return [decoded_stream(values[int(re.search(rb"/Contents\s+(\d+) 0 R", page).group(1))]) for page in pages]


def test_http_returns_pdf_attachment_and_only_reads_bound_event(client, engine, headers, payload):
    before = all_records(engine)
    statements = []

    def record(_connection, _cursor, sql, _parameters, _context, _many):
        statements.append(sql)

    sql_event.listen(engine, "before_cursor_execute", record)
    try:
        response = client.post("/api/events/42/ranking-scorecards", headers=headers, json=payload)
    finally:
        sql_event.remove(engine, "before_cursor_execute", record)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["content-disposition"] == 'attachment; filename="ranking-scorecards-42.pdf"'
    assert response.content.startswith(b"%PDF-")
    assert response.content.rstrip().endswith(b"%%EOF")
    assert len(statements) == 1
    assert statements[0].lstrip().startswith("SELECT")
    assert "FROM events" in statements[0]
    assert all_records(engine) == before


def test_pdf_is_a4_landscape_vector_not_raster_with_embedded_chinese_and_ascii(payload, october_generation):
    pdf = renderer.build_ranking_scorecards(2026, "秋季赛", RankingScorecardRequest(**payload))
    assert len(page_streams(pdf)) == 1
    boxes = re.findall(rb"/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)\s*\]", pdf)
    assert len(boxes) == 1
    assert tuple(float(value) for value in boxes[0]) == pytest.approx(landscape(A4), abs=0.001)
    assert b"/FontFile2" in pdf
    assert b"/ToUnicode" in pdf
    assert b"DroidSansFallback" in pdf
    assert b"Helvetica-Bold" in pdf
    assert not re.search(rb"/Subtype\s*/Image", pdf)
    streams = [decoded_stream(obj) for obj in objects(pdf).values() if re.search(rb"stream\r?\n", obj)]
    cmaps = b"\n".join(stream for stream in streams if b"begincmap" in stream).upper()
    for character in "杭州弓箭俱乐部冠军联赛测试甲乙丙组秋计分成绩":
        assert f"{ord(character):04X}".encode() in cmaps
    content = page_streams(pdf)[0]
    assert b"(2026)" in content
    assert b"2026.10)" in content
    assert b"(1A)" in content
    assert b"(1D)" in content
    assert b"(Example Archery Club)" in content
    assert b"(10+X)" in content
    assert b"(6/36)" in content
    assert not re.search(rb"(?:^|\s)1 0 0 [rR][gG](?:\s|$)", content)


def test_pages_and_position_order_are_preserved(payload):
    second = deepcopy(payload["pages"][0])
    second["positions"] = [{"target": f"2{letter}", "club": "", "athlete": ""} for letter in "ABCD"]
    payload["pages"].append(second)
    pdf = renderer.build_ranking_scorecards(2026, "春季赛", RankingScorecardRequest(**payload))
    streams = page_streams(pdf)
    assert len(streams) == 2
    assert [streams[0].index(f"(1{letter})".encode()) for letter in "ABCD"] == sorted(streams[0].index(f"(1{letter})".encode()) for letter in "ABCD")
    assert [streams[1].index(f"(2{letter})".encode()) for letter in "ABCD"] == sorted(streams[1].index(f"(2{letter})".encode()) for letter in "ABCD")


@pytest.mark.parametrize("season, station", [("春季赛", "一"), ("夏季赛", "二"), ("秋季赛", "三"), ("冬季赛", "四")])
def test_title_comes_from_event_identity_and_footer_from_generation_time(payload, monkeypatch, season, station):
    texts = []
    original = renderer._fit_text

    def record(pdf, text, *args, **kwargs):
        texts.append(str(text))
        return original(pdf, text, *args, **kwargs)

    monkeypatch.setattr(renderer, "_fit_text", record)
    mock_generation_clock(monkeypatch, datetime(2030, 2, 15, tzinfo=timezone.utc))
    renderer.build_ranking_scorecards(2027, season, RankingScorecardRequest(**payload))
    assert f"2027赛季第{station}站 {season}" in texts
    assert "杭州市弓箭运动协会   2030.02" in texts
    assert texts.count("运动员签字：") == 4
    assert texts.count("计分员签字：") == 1
    assert texts.count("裁判员签字：") == 1


def test_geometry_has_four_equal_cards_six_double_rows_and_first_cumulative_diagonals(payload):
    renderer._ensure_font()
    request = RankingScorecardRequest(**payload)
    pdf = MagicMock()
    renderer._draw_page(pdf, 2026, "秋季赛", "2026.10", request.pages[0])
    outer = [call.args for call in pdf.rect.call_args_list if call.args[2:] == (renderer.CARD_WIDTH, renderer.CARD_HEIGHT)]
    assert len(outer) == 4
    assert [rect[0] for rect in outer] == pytest.approx([renderer.MARGIN + index * (renderer.CARD_WIDTH + renderer.CARD_GAP) for index in range(4)])
    cell = renderer.CARD_WIDTH / 7
    body_top = renderer.CARD_TOP + renderer.META_HEIGHT + renderer.HEADER_HEIGHT
    lines = [call.args for call in pdf.line.call_args_list]
    for index in range(4):
        x = renderer.MARGIN + index * (renderer.CARD_WIDTH + renderer.CARD_GAP)
        assert (x + 6 * cell, renderer.PAGE_HEIGHT - body_top, x + 7 * cell, renderer.PAGE_HEIGHT - body_top - renderer.GROUP_HEIGHT) in lines
        for group in range(6):
            mid = renderer.PAGE_HEIGHT - body_top - (group + 0.5) * renderer.GROUP_HEIGHT
            assert any(line == pytest.approx((x + cell, mid, x + 5 * cell, mid)) for line in lines)
    assert len([call for call in pdf.setFillColor.call_args_list if call.args == (renderer.YELLOW,)]) == 13
    assert renderer.YELLOW.hexval() == "0xeee94d"


@pytest.mark.parametrize("text", ["姓名" * 60, "LongMixed中文Club-é—”" * 6])
def test_text_uses_actual_run_width_and_shrinks_without_truncating(text):
    renderer._ensure_font()
    pdf = MagicMock()
    renderer._fit_text(pdf, text, 0, 0, 75, 20, 16, bold=True)
    item = pdf.beginText.return_value
    assert "".join(call.args[0] for call in item.textOut.call_args_list) == text
    sizes = [call.args[1] for call in item.setFont.call_args_list]
    assert len(set(sizes)) == 1
    assert 0 < sizes[0] < 16
    runs = renderer._text_runs(text, True)
    width, ascent, descent = renderer._text_metrics(runs, sizes[0])
    assert width <= 71.000001
    assert ascent - descent <= 17.000001


@pytest.mark.parametrize("authorization", [None, "Bearer invalid"])
def test_pdf_requires_admin(client, payload, authorization):
    response = client.post("/api/events/42/ranking-scorecards", json=payload, headers={} if authorization is None else {"Authorization": authorization})
    assert response.status_code == 401


def test_missing_event_is_404_without_invoking_renderer(client, headers, payload, monkeypatch):
    called = MagicMock()
    monkeypatch.setattr(routes, "build_ranking_scorecards", called)
    assert client.post("/api/events/9999/ranking-scorecards", headers=headers, json=payload).status_code == 404
    called.assert_not_called()


@pytest.mark.parametrize("utc_hour, expected", [(15, b"2030.12)"), (16, b"2031.01)")])
def test_footer_uses_beijing_month_boundary_and_one_timestamp_per_pdf(client, headers, payload, monkeypatch, utc_hour, expected):
    clock = mock_generation_clock(monkeypatch, datetime(2030, 12, 31, utc_hour, 0, tzinfo=timezone.utc))
    payload["pages"].append(deepcopy(payload["pages"][0]))
    response = client.post("/api/events/42/ranking-scorecards", headers=headers, json=payload)
    assert response.status_code == 200
    streams = page_streams(response.content)
    assert len(streams) == 2
    assert all(expected in content and b"(2026)" in content for content in streams)
    clock.now.assert_called_once()


def test_clients_cannot_override_the_footer_month(client, headers, payload):
    payload["print_month"] = "2026.01"
    response = client.post("/api/events/42/ranking-scorecards", headers=headers, json=payload)
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "print_month"]


@pytest.mark.parametrize("change", ["no_pages", "301_pages", "3_positions", "5_positions", "no_target", "empty_group", "empty_round", "long_group", "long_round", "long_target", "long_club", "long_athlete", "numeric_text", "extra_event_title"])
def test_invalid_page_shape_and_text_limits(client, headers, payload, change):
    page = payload["pages"][0]
    if change == "no_pages": payload["pages"] = []
    elif change == "301_pages": payload["pages"] = [page] * 301
    elif change == "3_positions": page["positions"] = page["positions"][:3]
    elif change == "5_positions": page["positions"].append(page["positions"][0])
    elif change == "no_target":
        for position in page["positions"]: position["target"] = " "
    elif change == "empty_group": page["group"] = " "
    elif change == "empty_round": page["round"] = ""
    elif change in ("long_group", "long_round"): page[change[5:]] = "字" * 121
    elif change.startswith("long_"): page["positions"][0][change[5:]] = "字" * 121
    elif change == "numeric_text": page["positions"][0]["target"] = 1
    else: payload["year"] = 2020
    assert client.post("/api/events/42/ranking-scorecards", headers=headers, json=payload).status_code == 422


def test_exact_120_characters_and_300_pages_are_accepted_without_a_lower_invented_limit(client, headers, payload, monkeypatch):
    page = payload["pages"][0]
    page["positions"][0]["club"] = "中" * 120
    payload["pages"] = [page] * 300
    captured = []

    def render(year, season, request):
        captured.append((year, season, request))
        return b"%PDF-fixture"

    monkeypatch.setattr(routes, "build_ranking_scorecards", render)
    response = client.post("/api/events/42/ranking-scorecards", headers=headers, json=payload)
    assert response.status_code == 200
    assert len(captured[0][2].pages) == 300
    assert len(captured[0][2].pages[0].positions[0].club) == 120


def test_unknown_glyphs_fail_explicitly_instead_of_silent_missing_name(client, headers, payload):
    payload["pages"][0]["positions"][0]["athlete"] = "示例𠮷"
    response = client.post("/api/events/42/ranking-scorecards", headers=headers, json=payload)
    assert response.status_code == 422
    assert "U+20BB7" in response.json()["detail"]


def test_font_missing_has_actionable_503(client, headers, payload, monkeypatch, tmp_path):
    monkeypatch.setattr(renderer, "FONT_PATH", tmp_path / "missing.ttf")
    monkeypatch.setattr(pdfmetrics, "getRegisteredFontNames", lambda: [])
    response = client.post("/api/events/42/ranking-scorecards", headers=headers, json=payload)
    assert response.status_code == 503
    assert "fonts-droid-fallback" in response.json()["detail"]


def test_main_registers_the_admin_scorecard_route():
    from app.main import app
    route = next(route for route in app.routes if getattr(route, "path", None) == "/api/events/{event_id}/ranking-scorecards")
    assert route.methods == {"POST"}


@pytest.mark.skipif(shutil.which("mutool") is None, reason="optional local visual/PDF text integration")
def test_optional_mutool_reads_chinese_latin_digits_and_blank_target_position(payload, tmp_path, october_generation):
    path = tmp_path / "synthetic.pdf"
    path.write_bytes(renderer.build_ranking_scorecards(2026, "秋季赛", RankingScorecardRequest(**payload)))
    result = subprocess.run(["mutool", "draw", "-q", "-F", "txt", "-o", "-", str(path)], capture_output=True, text=True, check=True)
    for text in ("杭州弓箭俱乐部冠军联赛", "2026赛季第三站 秋季赛", "排位赛计分表", "测试甲", "测试乙*", "Example Archery Club", "O’Neil", "1D", "10+X", "6/36", "2026.10"):
        assert text in result.stdout


def test_parallel_requests_keep_font_subsets_and_documents_isolated(payload, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier, Lock

    ready = Barrier(4)
    counter_lock = Lock()
    active = 0
    maximum = 0
    draw = renderer._draw_page

    def track(*args, **kwargs):
        nonlocal active, maximum
        with counter_lock:
            active += 1
            maximum = max(maximum, active)
        try:
            return draw(*args, **kwargs)
        finally:
            with counter_lock:
                active -= 1

    monkeypatch.setattr(renderer, "_draw_page", track)

    def generate(index):
        data = deepcopy(payload)
        data["pages"][0]["positions"][0]["athlete"] = f"并行选手{index}"
        data["pages"] *= 2
        request = RankingScorecardRequest(**data)
        ready.wait()
        return renderer.build_ranking_scorecards(2026, "秋季赛", request)

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(generate, range(4)))
    assert maximum == 1
    assert active == 0
    for index, pdf in enumerate(results):
        assert len(page_streams(pdf)) == 2
        assert b"/FontFile2" in pdf
        assert f"({index})".encode() in page_streams(pdf)[0]


def test_render_exception_releases_document_lock_for_the_next_request(payload, monkeypatch):
    draw = renderer._draw_page
    monkeypatch.setattr(renderer, "_draw_page", MagicMock(side_effect=RuntimeError("synthetic render failure")))
    with pytest.raises(RuntimeError, match="synthetic render failure"):
        renderer.build_ranking_scorecards(2026, "秋季赛", RankingScorecardRequest(**payload))
    monkeypatch.setattr(renderer, "_draw_page", draw)
    assert len(page_streams(renderer.build_ranking_scorecards(2026, "秋季赛", RankingScorecardRequest(**payload)))) == 1
