"""团混模板的纯内存矢量PDF回归；样例均为虚构靶位，不依赖附件。"""
import base64
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timezone
import re
import shutil
import subprocess
from threading import Barrier, Lock
from types import SimpleNamespace
from unittest.mock import MagicMock
import zlib

import pytest
from reportlab.lib.pagesizes import A4, landscape

from app.services import ranking_scorecard_pdf as shared
from app.services import team_elimination_scorecard_pdf as renderer


@pytest.fixture
def card():
    return {"1/16": "轮空", "1/8": "17", "1/4": "9", "1/2": "5", "bronze": "3", "gold": "1"}


def objects(pdf):
    return {int(match.group(1)): match.group(2) for match in re.finditer(rb"(\d+) 0 obj\s*(.*?)endobj", pdf, re.S)}


def stream(obj):
    marker = re.search(rb"stream\r?\n", obj)
    length = int(re.search(rb"/Length\s+(\d+)", obj[:marker.start()]).group(1))
    result = obj[marker.end():marker.end() + length]
    if b"ASCII85Decode" in obj[:marker.start()]: result = base64.a85decode(result, adobe=True)
    if b"FlateDecode" in obj[:marker.start()]: result = zlib.decompress(result)
    return result


def pages(pdf):
    values = objects(pdf)
    page_objects = [obj for obj in values.values() if re.search(rb"/Type\s*/Page\b", obj)]
    return [stream(values[int(re.search(rb"/Contents\s+(\d+) 0 R", page).group(1))]) for page in page_objects]


def build(cards, competition_format="team", bow_type="recurve", group="30米测试组"):
    return renderer.build_team_elimination_scorecards(2026, "秋季赛", group, cards, bow_type=bow_type, competition_format=competition_format)


@pytest.mark.parametrize("competition_format", ["team", "mixed_team"])
@pytest.mark.parametrize("bow_type", ["recurve", "compound"])
def test_regular_templates_are_a4_landscape_vector_with_embedded_chinese(card, competition_format, bow_type):
    pdf = build([card], competition_format, bow_type)
    assert pdf.startswith(b"%PDF-")
    assert pdf.rstrip().endswith(b"%%EOF")
    assert len(pages(pdf)) == 1
    box = re.findall(rb"/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)\s*\]", pdf)
    assert tuple(float(value) for value in box[0]) == pytest.approx(landscape(A4), abs=0.001)
    assert b"/FontFile2" in pdf and b"/ToUnicode" in pdf and b"DroidSansFallback" in pdf
    assert not re.search(rb"/Subtype\s*/Image", pdf)
    assert b"(17)" in pages(pdf)[0]
    assert not re.search(rb"(?:^|\s)1 0 0 [rR][gG](?:\s|$)", pages(pdf)[0])


@pytest.mark.parametrize("arrow_count", [2, 3])
@pytest.mark.parametrize("compound", [False, True])
@pytest.mark.parametrize("paired", [False, True])
def test_headers_four_sets_and_exact_two_subrows_follow_workbook(arrow_count, compound, paired, monkeypatch):
    pdf = MagicMock()
    texts = []
    monkeypatch.setattr(shared, "_fit_text", lambda _pdf, text, *args, **kwargs: texts.append(str(text)))
    x, top = 42, 210
    columns = len(renderer._headers(arrow_count, compound, paired))
    width = columns * renderer._gold_panels(arrow_count, compound)[0] if paired else renderer.CARD_WIDTH
    renderer._draw_grid(pdf, x, top, width, "gold", "17", arrow_count, compound, paired=paired)
    headers = renderer._headers(arrow_count, compound, paired)
    assert headers[:arrow_count + 1] == ["" if paired else "局", *(str(index + 1) for index in range(arrow_count))]
    assert ("局" in texts) is (not paired)
    assert "小计" in texts and "合计" in texts
    assert ("累计" in texts) is compound
    assert ("局分" in texts) is (not compound)
    assert ("累计局分" in texts) is (paired and not compound)
    assert "5" not in texts
    for number in ("1", "2", "3", "4"):
        assert number in texts
    assert "决金箭" in texts and "接近中心打勾" in texts and "对手签字" in texts
    assert ("总分" in texts) is (arrow_count == 3 or (paired and not compound))
    if arrow_count == 2 and compound:
        assert renderer._shoot_regions(arrow_count, compound, paired) == [("决金箭", 1), ("", 1), ("", 1), ("near", 2), ("", 1)]
    assert sum(span for _label, span in renderer._shoot_regions(arrow_count, compound, paired)) == len(headers)
    cell = width / len(headers)
    head = top if paired else top + 20
    sets_top = head + (renderer.FINAL_HEADER_HEIGHT if paired else 13)
    set_height = renderer.FINAL_SET_HEIGHT if paired else 25
    lines = [call.args for call in pdf.line.call_args_list]
    diagonal = (x + width - cell, shared.PAGE_HEIGHT - sets_top, x + width, shared.PAGE_HEIGHT - sets_top - set_height)
    assert any(line == pytest.approx(diagonal) for line in lines) is paired
    for index in range(4):
        mid_y = shared.PAGE_HEIGHT - sets_top - (index + 0.5) * set_height
        assert any(line == pytest.approx((x + cell, mid_y, x + (arrow_count + 2) * cell, mid_y)) for line in lines)
        if index:
            y = shared.PAGE_HEIGHT - sets_top - index * set_height
            assert any(line == pytest.approx((x, y, x + width, y)) for line in lines)
    expected_height = renderer.FINAL_GRID_HEIGHT if paired else renderer.CARD_HEIGHT
    assert pdf.rect.call_args.args[2:] == (width, expected_height)


@pytest.mark.parametrize("competition_format", ["team", "mixed_team"])
@pytest.mark.parametrize("bow_type", ["recurve", "compound"])
def test_two_team_gold_uses_one_sheet_with_both_teams_and_correct_options(competition_format, bow_type, monkeypatch):
    captured = []
    draw = shared._fit_text

    def record(pdf, value, *args, **kwargs):
        captured.append(str(value))
        return draw(pdf, value, *args, **kwargs)

    monkeypatch.setattr(shared, "_fit_text", record)
    bow_name = "复合弓" if bow_type == "compound" else "反曲弓"
    pdf = build([{"gold": "53"}, {"gold": "54"}], competition_format, bow_type, group=f"50米{bow_name}")
    assert len(pages(pdf)) == 1
    assert "50米" in captured and bow_name in captured
    assert f"50米{bow_name}" not in captured
    assert captured.count("金牌决赛") == 1
    assert captured.count("姓名") == captured.count("俱乐部") == 2
    assert captured.count("排名") == captured.count("靶位号") == 2
    assert "53" in captured and "54" in captured
    assert captured.count("对手签字") == 2
    assert "裁判员签字" in captured
    assert any("金牌决赛" in text for text in captured)
    assert any(("混双" if competition_format == "mixed_team" else "团体") in text and "淘汰赛计分表" in text for text in captured)
    assert ("累计" in captured) is (bow_type == "compound")
    assert ("局分" in captured) is (bow_type != "compound")
    assert ("累计局分" in captured) is (bow_type != "compound")


@pytest.mark.parametrize("mode, arrow_count, compound, columns, bow_span, negative_col", [
    ("mixed_team", 2, False, 7, 3, 4),
    ("team", 3, True, 7, 2, 4),
    ("mixed_team", 2, True, 6, 3, 3),
    ("team", 3, False, 8, 2, 4),
])
def test_gold_metadata_and_result_cells_follow_each_variant(mode, arrow_count, compound, columns, bow_span, negative_col, monkeypatch):
    canvas = MagicMock()
    highlights = []
    origins = []
    fit_text = shared._fit_text
    shade = renderer._shade

    def record_text(pdf, text, x, top, width, height, *args, **kwargs):
        origins.append((str(text), x, top, width, height))
        if text == "50米" or text == "反曲弓":
            assert width > 0
        return fit_text(pdf, text, x, top, width, height, *args, **kwargs)

    def record_shade(pdf, x, top, width, height, color=renderer.individual.GRAY):
        if color == renderer.FINAL_YELLOW:
            highlights.append((x, top, width, height))
        return shade(pdf, x, top, width, height, color)

    shared._ensure_font()
    monkeypatch.setattr(shared, "_fit_text", record_text)
    monkeypatch.setattr(renderer, "_shade", record_shade)
    renderer._draw_gold_page(canvas, 2026, "秋季赛", "50米反曲弓", [{"gold": "53"}, {"gold": "54"}], "2026.11", arrow_count, compound, mode)
    cell = (shared.PAGE_WIDTH - 2 * renderer.FINAL_LEFT) / (2 * columns + 1 + (mode == "team" and compound))
    left, right = [x for value, x, *_ in origins if value == "姓名"]
    assert right - left == pytest.approx((columns + 1) * cell)
    assert right + columns * cell == pytest.approx(shared.PAGE_WIDTH - renderer.FINAL_LEFT)
    rank_top = renderer.FINAL_TOP + 2 * renderer.FINAL_META_ROW
    handwriting = [fill for fill in highlights if renderer.FINAL_TOP <= fill[1] < rank_top]
    assert len(handwriting) == 4
    for fill, (x, row) in zip(handwriting, ((x, row) for x in (left, right) for row in (0, 1))):
        assert fill == pytest.approx((x + 2 * cell, renderer.FINAL_TOP + row * renderer.FINAL_META_ROW,
                                      (columns - 2) * cell, renderer.FINAL_META_ROW))
    target_span = columns - arrow_count - 2
    assert [w for _, top, w, _ in highlights if top == rank_top] == pytest.approx(
        [arrow_count * cell, target_span * cell] * 2)
    assert [x for value, x, *_ in origins if value == "负"] == pytest.approx([left + negative_col * cell, right + negative_col * cell])
    assert len(highlights) == 9
    by_text = {value: (x, top, width, height) for value, x, top, width, height in origins}
    assert highlights[0] == by_text["反曲弓"]
    title = "混双团体淘汰赛计分表" if mode == "mixed_team" else "团体淘汰赛计分表"
    header_end = renderer.FINAL_LEFT + (5 if mode == "mixed_team" else 6) * cell
    title_x, _, title_width, _ = by_text[title]
    assert title_x > header_end and title_x + title_width < by_text["金牌决赛"][0]
    assert by_text["金牌决赛"][2] == pytest.approx(3 * cell)
    assert "2026年11月 杭州市弓箭运动协会" in by_text


@pytest.mark.parametrize("paired, compound, total_col", [(False, False, 5), (False, True, 5), (True, False, 6), (True, True, 4)])
def test_team_total_background_does_not_cover_any_of_its_four_edges(paired, compound, total_col, monkeypatch):
    drawing = []
    monkeypatch.setattr(shared, "_fit_text", MagicMock())
    monkeypatch.setattr(shared, "_line", lambda _pdf, *coords: drawing.append(("line", coords)))
    monkeypatch.setattr(renderer, "_shade", lambda _pdf, x, top, w, h, *_: drawing.append(("fill", (x, top, w, h))))
    x, top, cell = 40, 100, 30
    width = len(renderer._headers(3, compound, paired)) * cell
    renderer._draw_grid(MagicMock(), x, top, width, "gold", "53", 3, compound, paired=paired)
    shoot_top = top + (renderer.FINAL_HEADER_HEIGHT + 4 * renderer.FINAL_SET_HEIGHT if paired else 20 + 13 + 4 * 25)
    shoot_height = renderer.FINAL_SHOOT_HEIGHT if paired else 15
    shoot_bottom = shoot_top + shoot_height
    total_x = x + total_col * cell
    at = drawing.index(("fill", (total_x, shoot_top, cell, shoot_height)))
    for edge in (
        (x, shoot_top, x + width, shoot_top), (x, shoot_bottom, x + width, shoot_bottom),
        (total_x, shoot_top, total_x, shoot_bottom), (total_x + cell, shoot_top, total_x + cell, shoot_bottom),
    ):
        assert ("line", edge) in drawing[at + 1:]


def test_two_team_gold_data_is_not_used_for_a_multiple_round_bracket(card, monkeypatch):
    final = MagicMock()
    monkeypatch.setattr(renderer, "_draw_gold_page", final)
    assert len(pages(build([card, card]))) == 2
    final.assert_not_called()


def test_regular_page_has_six_equal_tables_and_no_unused_slot_borders(card, monkeypatch):
    calls = []
    draw = renderer._draw_grid

    def record(*args, **kwargs):
        calls.append((args, kwargs))
        return draw(*args, **kwargs)

    monkeypatch.setattr(renderer, "_draw_grid", record)
    build([card])
    assert len(calls) == 6
    for index, (args, _kwargs) in enumerate(calls):
        assert args[1] == pytest.approx(renderer.LEFT + (index % 3) * (renderer.CARD_WIDTH + renderer.CARD_GAP))
        assert args[2] == pytest.approx(renderer.TOP + (index // 3) * (renderer.CARD_HEIGHT + renderer.ROW_GAP))
        assert args[3] == renderer.CARD_WIDTH
    calls.clear()
    build([{"1/2": "1", "gold": "2"}])
    assert len(calls) == 2
    assert [args[4] for args, _kwargs in calls] == ["1/2", "gold"]


def test_early_round_page_is_skipped_only_for_pure_byes_and_rank_order_is_preserved(card, monkeypatch):
    first = {"1/64": "轮空", "1/32": "轮空", **card}
    second = {"1/64": "轮空", "1/32": "31", **card}
    seen = []
    draw = renderer._draw_regular_page

    def record(*args):
        seen.append(args)
        return draw(*args)

    monkeypatch.setattr(renderer, "_draw_regular_page", record)
    pdf = build([first, second])
    assert len(pages(pdf)) == 3
    assert [args[4] for args in seen] == [1, 2, 2]
    assert [args[7:9] for args in seen] == [(1, 1), (1, 2), (2, 2)]
    assert [key for key, _target in seen[1][6] if key] == ["1/64", "1/32"]
    assert not any(key in renderer.EARLY_ROUNDS for key, _target in seen[0][6] if key)


def test_empty_cards_do_not_create_blank_pages_or_renumber_remaining_rank(card, monkeypatch):
    ranks = []
    draw = renderer._draw_regular_page

    def record(*args):
        ranks.append(args[4])
        return draw(*args)

    monkeypatch.setattr(renderer, "_draw_regular_page", record)
    assert len(pages(build([{}, card]))) == 1
    assert ranks == [2]
    with pytest.raises(ValueError, match="没有可打印"):
        build([{"1/64": "轮空"}])


def test_three_team_semifinal_does_not_direct_losers_to_nonexistent_bronze(monkeypatch):
    captured = []
    draw = shared._fit_text

    def record(pdf, value, *args, **kwargs):
        captured.append(str(value))
        return draw(pdf, value, *args, **kwargs)

    monkeypatch.setattr(shared, "_fit_text", record)
    pdf = build([{"1/2": "轮空", "gold": "1"}, {"1/2": "3", "gold": "2"}, {"1/2": "4", "gold": "2"}])
    assert len(pages(pdf)) == 3
    assert not any("铜牌" in text for text in captured)
    assert captured.count("胜方请前往金牌靶位，负方请将计分表交与裁判。") == 3


def test_page_titles_manual_fields_and_generation_month_use_shared_beijing_clock(card, monkeypatch):
    captured, zones = [], []
    draw = shared._fit_text

    class Clock:
        @staticmethod
        def now(zone):
            zones.append(zone)
            return datetime(2026, 11, 30, 17, tzinfo=timezone.utc).astimezone(zone)

    def record(pdf, value, *args, **kwargs):
        captured.append(str(value))
        return draw(pdf, value, *args, **kwargs)

    monkeypatch.setattr(shared, "datetime", Clock)
    monkeypatch.setattr(shared, "_fit_text", record)
    build([card, card], competition_format="mixed_team")
    assert zones == [shared.CHINA_STANDARD_TIME]
    assert captured.count("2026赛季 第三站 秋季赛") == 2
    assert captured.count("混合团体淘汰赛计分表") == 2
    assert captured.count("杭州市弓箭运动协会   2026.12") == 2
    assert captured.count("姓名") == captured.count("俱乐部") == 2
    assert captured.count("请运动员") == captured.count("自行填写") == 4


def test_inputs_are_not_modified_and_targets_do_not_gain_left_right(card):
    cards = [card, deepcopy(card)]
    before = deepcopy(cards)
    pdf = build(cards)
    assert cards == before
    cmaps = b"\n".join(stream(obj) for obj in objects(pdf).values() if re.search(rb"stream\r?\n", obj) and b"begincmap" in stream(obj)).upper()
    assert f"{ord('左'):04X}".encode() not in cmaps
    assert f"{ord('右'):04X}".encode() not in cmaps


@pytest.mark.parametrize("cards, bow, mode, group", [
    ([{"gold": "1"}], "recurve", "individual", "组别"),
    ([{"gold": "1"}], None, "team", "组别"),
    ([], "recurve", "team", "组别"),
    ([{"gold": 1}], "recurve", "team", "组别"),
    ([{"final": "1"}], "recurve", "team", "组别"),
    ([{"gold": "1"}], "recurve", "team", ""),
    ([{"gold": "1"}] * 129, "recurve", "team", "组别"),
])
def test_invalid_inputs_fail_explicitly(cards, bow, mode, group):
    with pytest.raises(ValueError):
        build(cards, mode, bow, group)


def test_unknown_glyph_uses_shared_explicit_error(card):
    with pytest.raises(shared.ScorecardUnsupportedText, match=r"U\+20BB7"):
        build([card], group="测试𠮷")


def test_failure_releases_shared_lock(card, monkeypatch):
    original = renderer._draw_regular_page
    monkeypatch.setattr(renderer, "_draw_regular_page", MagicMock(side_effect=RuntimeError("synthetic failure")))
    with pytest.raises(RuntimeError, match="synthetic failure"):
        build([card])
    monkeypatch.setattr(renderer, "_draw_regular_page", original)
    assert len(pages(build([card]))) == 1


def test_ranking_and_team_generation_share_one_font_document_lock(card, monkeypatch):
    real_lock, ready = Lock(), Barrier(2)
    active, calls = 0, 0
    original = shared.canvas.Canvas

    class DocumentLock:
        def __enter__(self):
            nonlocal active, calls
            real_lock.acquire()
            active += 1
            calls += 1

        def __exit__(self, *_args):
            nonlocal active
            active -= 1
            real_lock.release()

    def canvas(*args, **kwargs):
        assert active == 1
        return original(*args, **kwargs)

    monkeypatch.setattr(shared, "_RENDER_LOCK", DocumentLock())
    monkeypatch.setattr(shared.canvas, "Canvas", canvas)
    position = SimpleNamespace(target="1A", club="测试", athlete="示例")
    request = SimpleNamespace(pages=[SimpleNamespace(group="反曲弓", round="一", positions=[position] * 4)])

    def ranking():
        ready.wait()
        return shared.build_ranking_scorecards(2026, "秋季赛", request)

    def team():
        ready.wait()
        return build([card])

    with ThreadPoolExecutor(max_workers=2) as pool:
        first, second = pool.submit(ranking), pool.submit(team)
        results = first.result(), second.result()
    assert calls == 2 and active == 0
    assert all(len(pages(pdf)) == 1 for pdf in results)


def test_maximum_128_team_bracket_with_early_rounds_produces_256_a4_pages(card):
    data = {"1/64": "31", "1/32": "17", **card}
    pdf = build([data] * 128, bow_type="compound")
    assert len(pages(pdf)) == 256
    boxes = re.findall(rb"/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)\s*\]", pdf)
    assert len(boxes) == 256
    assert all(tuple(float(value) for value in box) == pytest.approx(landscape(A4), abs=0.001) for box in boxes)


@pytest.mark.skipif(shutil.which("mutool") is None, reason="optional local PDF text extraction")
def test_optional_real_pdf_text_for_paired_mixed_gold(tmp_path):
    path = tmp_path / "synthetic-mixed-gold.pdf"
    path.write_bytes(build([{"gold": "17"}, {"gold": "18"}], competition_format="mixed_team"))
    result = subprocess.run(["mutool", "draw", "-q", "-F", "txt", "-o", "-", str(path)], capture_output=True, text=True, check=True)
    for text in ("2026赛季杭州弓箭俱乐部冠军联赛", "第三站 秋季赛", "混双团体淘汰赛计分表", "金牌决赛", "排名", "17", "18", "姓名", "俱乐部", "累计局分", "决金箭", "对手签字", "裁判员签字"):
        assert text in result.stdout
