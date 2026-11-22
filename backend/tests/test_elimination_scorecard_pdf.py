"""纯内存淘汰赛手卡：固定版式、每人顺序、续页、北京时间及共享字体锁。"""
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

from app.services import elimination_scorecard_pdf as renderer
from app.services import ranking_scorecard_pdf as shared


@pytest.fixture
def card():
    return {"1/16": "轮空", "1/8": "1左", "1/4": "1左", "1/2": "1", "bronze": "3", "gold": "1"}


def objects(pdf):
    return {int(match.group(1)): match.group(2) for match in re.finditer(rb"(\d+) 0 obj\s*(.*?)endobj", pdf, re.S)}


def decoded_stream(obj):
    marker = re.search(rb"stream\r?\n", obj)
    length = int(re.search(rb"/Length\s+(\d+)", obj[:marker.start()]).group(1))
    result = obj[marker.end():marker.end() + length]
    if b"ASCII85Decode" in obj[:marker.start()]:
        result = base64.a85decode(result, adobe=True)
    if b"FlateDecode" in obj[:marker.start()]:
        result = zlib.decompress(result)
    return result


def pages(pdf):
    values = objects(pdf)
    page_objects = [obj for obj in values.values() if re.search(rb"/Type\s*/Page\b", obj)]
    return [decoded_stream(values[int(re.search(rb"/Contents\s+(\d+) 0 R", page).group(1))]) for page in page_objects]


def test_valid_output_is_vector_a4_landscape_with_shared_embedded_font(card):
    pdf = renderer.build_elimination_scorecards(2026, "秋季赛", "10米反曲弓 男子组", [card])
    assert pdf.startswith(b"%PDF-")
    assert pdf.rstrip().endswith(b"%%EOF")
    assert len(pages(pdf)) == 1
    boxes = re.findall(rb"/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)\s*\]", pdf)
    assert len(boxes) == 1
    assert tuple(float(value) for value in boxes[0]) == pytest.approx(landscape(A4), abs=0.001)
    assert b"DroidSansFallback" in pdf
    assert b"/FontFile2" in pdf
    assert b"/ToUnicode" in pdf
    assert not re.search(rb"/Subtype\s*/Image", pdf)
    assert not re.search(rb"(?:^|\s)1 0 0 [rR][gG](?:\s|$)", pages(pdf)[0])
    assert b"(1/16)" in pages(pdf)[0]
    assert b"(1/8)" in pages(pdf)[0]
    assert b"(1/4)" in pages(pdf)[0]
    assert b"(1/2)" in pages(pdf)[0]


@pytest.mark.parametrize("rounds, expected_slots", [
    (("gold",), ["gold", None, None, None, None, None]),
    (("1/2", "gold"), ["1/2", "gold", None, None, None, None]),
    (("1/4", "1/2", "bronze", "gold"), ["1/4", "1/2", "bronze", "gold", None, None]),
    (("1/8", "1/4", "1/2", "bronze", "gold"), ["1/8", "1/4", "1/2", "bronze", "gold", None]),
    (renderer.TEMPLATE_ROUNDS, list(renderer.TEMPLATE_ROUNDS)),
])
def test_main_rounds_fill_slots_from_top_left_in_round_order(rounds, expected_slots, monkeypatch):
    calls = []
    original = renderer._draw_page

    def record(*args):
        calls.append(args)
        return original(*args)

    monkeypatch.setattr(renderer, "_draw_page", record)
    data = {key: str(index + 1) for index, key in enumerate(rounds)}
    pdf = renderer.build_elimination_scorecards(2026, "秋季赛", "10米反曲弓", [data])
    assert len(pages(pdf)) == 1
    assert [key for key, _target in calls[0][6]] == expected_slots
    assert calls[0][7:9] == (1, 1)


@pytest.mark.parametrize("count", [7, 8])
def test_early_rounds_have_a_separate_first_page_for_each_rank(count, monkeypatch):
    calls = []
    original = renderer._draw_page

    def record(*args):
        calls.append(args)
        return original(*args)

    monkeypatch.setattr(renderer, "_draw_page", record)
    keys = renderer.ROUND_ORDER[-count:]
    cards = [{key: f"{rank}{index}左" for index, key in enumerate(keys)} for rank in (1, 2)]
    pdf = renderer.build_elimination_scorecards(2026, "秋季赛", "70米反曲弓", cards)
    assert len(pages(pdf)) == 4
    assert [call[4] for call in calls] == [1, 1, 2, 2]
    assert [call[7:9] for call in calls] == [(1, 2), (2, 2), (1, 2), (2, 2)]
    early_rounds = list(keys[:-6])
    for rank in (0, 1):
        first, second = calls[2 * rank][6], calls[2 * rank + 1][6]
        assert first == [(key, cards[rank][key]) for key in early_rounds] + [(None, "")] * (6 - len(early_rounds))
        assert second == [(key, cards[rank][key]) for key in renderer.TEMPLATE_ROUNDS]
    first_page, main_page = pages(pdf)[:2]
    for key in early_rounds:
        assert f"({key})".encode() in first_page
        assert f"({key})".encode() not in main_page
    # The first page's page-number marker also contains the literal "1/2".
    for key in ("1/16", "1/8", "1/4"):
        assert f"({key})".encode() not in first_page
    for key in ("1/16", "1/8", "1/4", "1/2"):
        assert f"({key})".encode() in main_page


@pytest.mark.parametrize("early_rounds", [("1/32",), renderer.EARLY_ROUNDS])
def test_early_byes_skip_only_the_early_page_and_recalculate_numbering(card, early_rounds, monkeypatch):
    seen = []
    original = renderer._draw_page

    def record(*args):
        seen.append((args[4], args[6], args[7:9]))
        return original(*args)

    monkeypatch.setattr(renderer, "_draw_page", record)
    byes = dict.fromkeys(early_rounds, "轮空")
    cards = [{**card, **byes}, {**card, **byes, "1/32": "17左"}]
    pdf = renderer.build_elimination_scorecards(2026, "秋季赛", "70米反曲弓", cards)
    assert len(pages(pdf)) == 3
    assert [(rank, numbering) for rank, _slots, numbering in seen] == [(1, (1, 1)), (2, (1, 2)), (2, (2, 2))]
    assert seen[0][1] == seen[2][1] == list(card.items())
    assert seen[1][1][:len(early_rounds)] == [(key, cards[1][key]) for key in early_rounds]


def test_union_layout_does_not_shift_other_ranks_when_a_card_omits_bronze(card, monkeypatch):
    calls = []
    original = renderer._draw_page

    def record(*args):
        calls.append(args)
        return original(*args)

    monkeypatch.setattr(renderer, "_draw_page", record)
    second = {key: value for key, value in card.items() if key != "bronze"}
    renderer.build_elimination_scorecards(2026, "秋季赛", "10米反曲弓", [card, second])
    assert calls[0][6][4][0] == "bronze"
    assert calls[1][6][4] == (None, "")
    assert calls[0][6][5][0] == calls[1][6][5][0] == "gold"


def test_early_partial_round_is_not_silently_lost():
    pdf = renderer.build_elimination_scorecards(2026, "秋季赛", "70米反曲弓", [{"1/64": "17左", "gold": "1"}])
    early_page, main_page = pages(pdf)
    assert b"(1/64)" in early_page
    assert b"(17)" in early_page
    assert b"(1/64)" not in main_page


def test_card_table_geometry_is_identical_for_all_six_slots_and_has_five_sets(card, monkeypatch):
    shared._ensure_font()
    pdf = MagicMock()
    calls = []
    original = shared._fit_text

    def text(pdf, value, *args, **kwargs):
        calls.append(str(value))
        return original(pdf, value, *args, **kwargs)

    monkeypatch.setattr(shared, "_fit_text", text)
    for slot, key in enumerate(renderer.TEMPLATE_ROUNDS):
        renderer._draw_table(pdf, slot, key, card[key], True)
    outer = [call.args for call in pdf.rect.call_args_list if call.args[2:] == (renderer.CARD_WIDTH, renderer.CARD_HEIGHT)]
    assert len(outer) == 12  # 初始边框+最终加粗边框，各槽一致。
    assert {round(rect[2], 3) for rect in outer} == {233.0}
    assert {round(rect[3], 3) for rect in outer} == {184.0}
    for slot in range(6):
        x = renderer.LEFT + (slot % 3) * (renderer.CARD_WIDTH + renderer.CARD_GAP)
        top = renderer.TOP + (slot // 3) * (renderer.CARD_HEIGHT + renderer.ROW_GAP)
        assert any(rect == pytest.approx((x, shared.PAGE_HEIGHT - top - renderer.CARD_HEIGHT, renderer.CARD_WIDTH, renderer.CARD_HEIGHT)) for rect in outer)
    for number in range(1, 6):
        assert calls.count(str(number)) >= 6
    assert calls.count("决金箭") == 6
    assert calls.count("对手签字") == 6
    assert calls.count("总分") == 6
    assert len([call for call in pdf.rect.call_args_list if call.args[2:] == (7, 7)]) == 18
    assert not any(call.args == (1, 0, 0) for call in pdf.setFillColorRGB.call_args_list)


def test_unplayed_slot_has_no_border_or_header(monkeypatch):
    pdf = MagicMock()
    text = MagicMock()
    monkeypatch.setattr(shared, "_fit_text", text)
    renderer._draw_table(pdf, 4, None, "")
    pdf.rect.assert_not_called()
    pdf.line.assert_not_called()
    text.assert_not_called()


@pytest.mark.parametrize("has_bronze", [False, True])
def test_semifinal_directions_only_reference_bronze_if_this_card_has_bronze(monkeypatch, has_bronze):
    shared._ensure_font()
    text = MagicMock()
    monkeypatch.setattr(shared, "_fit_text", text)
    renderer._draw_table(MagicMock(), 3, "1/2", "1", has_bronze)
    notes = [call.args[1] for call in text.call_args_list]
    if has_bronze:
        assert "胜方请前往金牌靶位，负方请前往铜牌靶位。" in notes
    else:
        assert "胜方请前往金牌靶位，负方请将计分表交与裁判。" in notes
        assert not any("铜牌" in note for note in notes)


def test_page_keeps_names_clubs_blank_and_uses_beijing_generation_month(card, monkeypatch):
    seen = []
    clock_zones = []
    original = shared._fit_text

    class Clock:
        @staticmethod
        def now(zone):
            clock_zones.append(zone)
            return datetime(2026, 11, 30, 17, 0, tzinfo=timezone.utc).astimezone(zone)

    def text(pdf, value, *args, **kwargs):
        seen.append(str(value))
        return original(pdf, value, *args, **kwargs)

    monkeypatch.setattr(shared, "datetime", Clock)
    monkeypatch.setattr(shared, "_fit_text", text)
    renderer.build_elimination_scorecards(2026, "秋季赛", "10米反曲弓 男子组", [card, card])
    assert clock_zones == [shared.CHINA_STANDARD_TIME]
    assert seen.count("2026赛季 第三站 秋季赛") == 2
    assert seen.count("10米反曲弓 男子组") == 2
    assert seen.count("杭州市弓箭运动协会   2026.12") == 2
    assert seen.count("姓名") == seen.count("俱乐部") == 2
    assert seen.count("请运动员") == seen.count("自行填写") == 4
    assert seen.count("裁判签字") == 2


def test_continuation_is_visible_and_keeps_identical_headers_rank_footer(monkeypatch):
    seen = []
    original = shared._fit_text

    def text(pdf, value, *args, **kwargs):
        seen.append(str(value))
        return original(pdf, value, *args, **kwargs)

    monkeypatch.setattr(shared, "_fit_text", text)
    renderer.build_elimination_scorecards(2026, "冬季赛", "70米反曲弓", [{key: "1左" for key in renderer.ROUND_ORDER}])
    assert "第1/2页" in seen
    assert "续页 2/2" in seen
    assert seen.count("2026赛季 第四站 冬季赛") == 2
    assert seen.count("淘汰赛计分表") == 2
    assert seen.count("排位") == seen.count("名次") == 2


def test_input_objects_are_not_modified(card):
    cards = [card, deepcopy(card)]
    before = deepcopy(cards)
    renderer.build_elimination_scorecards(2026, "秋季赛", "10米反曲弓", cards)
    assert cards == before


@pytest.mark.parametrize("args", [
    (True, "秋季赛", "组别", [{"gold": "1"}]),
    (0, "秋季赛", "组别", [{"gold": "1"}]),
    (2026, "未知赛季", "组别", [{"gold": "1"}]),
    (2026, [], "组别", [{"gold": "1"}]),
    (2026, "秋季赛", "", [{"gold": "1"}]),
    (2026, "秋季赛", "组" * 121, [{"gold": "1"}]),
    (2026, "秋季赛", "组别", []),
    (2026, "秋季赛", "组别", [{"gold": "1"}] * 129),
    (2026, "秋季赛", "组别", [{}]),
    (2026, "秋季赛", "组别", [{"final": "1"}]),
    (2026, "秋季赛", "组别", [{"gold": 1}]),
    (2026, "秋季赛", "组别", [{"gold": "1" * 121}]),
])
def test_invalid_inputs_fail_explicitly(args):
    with pytest.raises(ValueError):
        renderer.build_elimination_scorecards(*args)


def test_missing_glyph_propagates_shared_clear_error(card):
    with pytest.raises(shared.ScorecardUnsupportedText, match=r"U\+20BB7"):
        renderer.build_elimination_scorecards(2026, "秋季赛", "测试𠮷", [card])


def test_shared_render_lock_covers_ranking_and_elimination_together(card, monkeypatch):
    real_lock = Lock()
    counter_lock = Lock()
    ready = Barrier(2)
    active = 0
    maximum = 0
    calls = 0
    original_canvas = shared.canvas.Canvas

    class SharedLock:
        def __enter__(self):
            nonlocal active, maximum, calls
            real_lock.acquire()
            with counter_lock:
                active += 1
                calls += 1
                maximum = max(maximum, active)

        def __exit__(self, *_args):
            nonlocal active
            with counter_lock:
                active -= 1
            real_lock.release()

    def canvas(*args, **kwargs):
        assert active == 1
        return original_canvas(*args, **kwargs)

    monkeypatch.setattr(shared, "_RENDER_LOCK", SharedLock())
    monkeypatch.setattr(shared.canvas, "Canvas", canvas)
    position = SimpleNamespace(target="1A", club="测试", athlete="示例")
    request = SimpleNamespace(pages=[SimpleNamespace(group="反曲弓", round="一", positions=[position] * 4)])

    def ranking():
        ready.wait()
        return shared.build_ranking_scorecards(2026, "秋季赛", request)

    def elimination():
        ready.wait()
        return renderer.build_elimination_scorecards(2026, "秋季赛", "10米反曲弓", [card])

    with ThreadPoolExecutor(max_workers=2) as pool:
        first, second = pool.submit(ranking), pool.submit(elimination)
        results = first.result(), second.result()
    assert maximum == 1
    assert calls == 2
    assert active == 0
    assert all(len(pages(pdf)) == 1 for pdf in results)


def test_exception_releases_shared_lock(card, monkeypatch):
    original = renderer._draw_page
    monkeypatch.setattr(renderer, "_draw_page", MagicMock(side_effect=RuntimeError("synthetic failure")))
    with pytest.raises(RuntimeError, match="synthetic failure"):
        renderer.build_elimination_scorecards(2026, "秋季赛", "10米反曲弓", [card])
    monkeypatch.setattr(renderer, "_draw_page", original)
    assert len(pages(renderer.build_elimination_scorecards(2026, "秋季赛", "10米反曲弓", [card]))) == 1


@pytest.mark.skipif(shutil.which("mutool") is None, reason="optional local PDF extraction")
def test_optional_pdf_text_extraction_matches_reference_labels_and_manual_fields(card, tmp_path):
    path = tmp_path / "elimination-synthetic.pdf"
    path.write_bytes(renderer.build_elimination_scorecards(2026, "秋季赛", "10米反曲弓 男子组", [card]))
    result = subprocess.run(["mutool", "draw", "-q", "-F", "txt", "-o", "-", str(path)], capture_output=True, text=True, check=True)
    for text in ("杭州弓箭俱乐部冠军联赛", "2026赛季 第三站 秋季赛", "淘汰赛计分表", "10米反曲弓 男子组", "姓名", "俱乐部", "请运动员", "自行填写", "1/16", "轮空", "1左", "决金箭", "小计", "局分", "对手签字", "裁判签字"):
        assert text in result.stdout


def test_three_person_cards_do_not_print_a_nonexistent_bronze_target_or_direction(monkeypatch):
    seen = []
    original = shared._fit_text

    def text(pdf, value, *args, **kwargs):
        seen.append(str(value))
        return original(pdf, value, *args, **kwargs)

    monkeypatch.setattr(shared, "_fit_text", text)
    cards = [{"1/2": "轮空", "gold": "1"}, {"1/2": "2左", "gold": "1"}, {"1/2": "2右", "gold": "1"}]
    assert len(pages(renderer.build_elimination_scorecards(2026, "秋季赛", "10米反曲弓", cards))) == 3
    assert not any("铜牌" in value for value in seen)
    assert seen.count("胜方请前往金牌靶位，负方请将计分表交与裁判。") == 3


def test_maximum_128_people_eight_rounds_produce_256_fixed_size_pages():
    card = {key: str(index + 1) + "左" for index, key in enumerate(renderer.ROUND_ORDER)}
    pdf = renderer.build_elimination_scorecards(2026, "秋季赛", "70米反曲弓", [card] * 128)
    assert len(pages(pdf)) == 256
    assert b"(128)" in pages(pdf)[-1]
    boxes = re.findall(rb"/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)\s*\]", pdf)
    assert len(boxes) == 256
    assert all(tuple(float(value) for value in box) == pytest.approx(landscape(A4), abs=0.001) for box in boxes)
