"""依团混工作簿重绘的A4横向矢量手卡；运行时不读取附件，不写入业务数据。"""
from io import BytesIO
from math import ceil
import re

from reportlab.lib.colors import HexColor, black

from app.services import elimination_scorecard_pdf as individual
from app.services import ranking_scorecard_pdf as shared


CARD_WIDTH = 233.0
CARD_HEIGHT = 194.0
CARD_GAP = 24.0
ROW_GAP = 10.0
LEFT = 52.8
TOP = 132.0
# Two-team final: proportions of the workbook's paired gold block.
FINAL_LEFT = 52.0
FINAL_TOP = 98.0
FINAL_META_ROW = 35.0
FINAL_HEADER_HEIGHT = 24.0
FINAL_SET_HEIGHT = 48.0
FINAL_SHOOT_HEIGHT = 28.0
FINAL_RESULT_HEIGHT = 24.0
FINAL_SIGN_HEIGHT = 36.0
FINAL_GRID_HEIGHT = FINAL_HEADER_HEIGHT + 4 * FINAL_SET_HEIGHT + FINAL_SHOOT_HEIGHT + FINAL_RESULT_HEIGHT + FINAL_SIGN_HEIGHT
FINAL_GRAY = HexColor('#D9D9D9')
FINAL_YELLOW = HexColor('#FFFF00')
ROUND_ORDER = individual.ROUND_ORDER
EARLY_ROUNDS = individual.EARLY_ROUNDS
MAIN_ROUNDS = individual.TEMPLATE_ROUNDS
TITLES = {"team": "团体淘汰赛计分表", "mixed_team": "混合团体淘汰赛计分表"}


def _shade(pdf, x, top, width, height, color=individual.GRAY):
    pdf.saveState()
    pdf.setFillColor(color)
    shared._rect(pdf, x, top, width, height, fill=True, stroke=False)
    pdf.restoreState()


def _box(pdf, x, top, size):
    shared._rect(pdf, x, top, size, size)


def _headers(arrow_count, compound, paired):
    headers = ["" if paired else "局", *(str(index + 1) for index in range(arrow_count)), "小计", "合计"]
    if compound:
        return [*headers, "累计"]
    return [*headers, "局分", *(["累计局分"] if paired else [])]


def _gold_panels(arrow_count, compound):
    """Scale the sheet's equal-width columns and one-column gutter to A4."""
    columns = len(_headers(arrow_count, compound, paired=True))
    # 复合团金的首列 A 只用于抬头，左右记分表从 B / J 开始。
    leading = int(arrow_count == 3 and compound)
    cell = (shared.PAGE_WIDTH - 2 * FINAL_LEFT) / (2 * columns + 1 + leading)
    left = FINAL_LEFT + leading * cell
    return cell, left, left + (columns + 1) * cell


def _shoot_regions(arrow_count, compound, paired):
    # 与附件合并单元格相同：普通混双附加赛无独立“总分”标题。
    # 复合混双无独立双队样表，保留「混双 复合」的两箭决金栏，不加总分格。
    if arrow_count == 2 and (not paired or compound):
        return [("决金箭", 1), ("", 1), ("", 1), ("near", 2), ("", 1)]
    if not paired:
        return [("决金箭", 1), ("", 1), ("near", 3), ("总分", 1), ("", 1)]
    if compound:
        return [("决金箭", 1), ("", 1), ("near", 2), ("总分", 1), ("", arrow_count - 1)]
    return [("决金箭", 1), *[("", 1)] * arrow_count, ("near", 2), ("总分", 1), ("", 1)]


def _round_note(key, has_bronze):
    if key == "1/2":
        return ("胜方请前往金牌靶位，负方请前往铜牌靶位。" if has_bronze else
                "胜方请前往金牌靶位，负方请将计分表交与裁判。")
    if key in ("bronze", "gold"):
        return "请胜负双方选手均将计分纸交与裁判。"
    return "胜方继续下一轮，负方请将计分表交与裁判。"


def _draw_grid(pdf, x, top, width, key, target, arrow_count, compound, paired=False, has_bronze=False):
    headers = _headers(arrow_count, compound, paired)
    columns = len(headers)
    cell = width / columns
    round_h, header_h, set_h = (0, FINAL_HEADER_HEIGHT, FINAL_SET_HEIGHT) if paired else (20, 13, 25)
    shoot_h, result_h, note_h, sign_h = (FINAL_SHOOT_HEIGHT, FINAL_RESULT_HEIGHT, 0, FINAL_SIGN_HEIGHT) if paired else (15, 14, 12, 20)
    gray = FINAL_GRAY if paired else individual.GRAY
    height = round_h + header_h + 4 * set_h + shoot_h + result_h + note_h + sign_h
    head_top = top + round_h
    sets_top = head_top + header_h
    shoot_top = sets_top + 4 * set_h
    result_top = shoot_top + shoot_h
    note_top = result_top + result_h
    sign_top = note_top + note_h
    font = 11 if paired else 9.5
    pdf.setStrokeColor(black)
    pdf.setLineWidth(0.65)
    if not paired:
        title_cols = columns - 4
        shared._yellow(pdf, x + (columns - 2) * cell, top, 2 * cell, round_h)
        for split in (title_cols, columns - 2):
            shared._line(pdf, x + split * cell, top, x + split * cell, head_top)
        shared._fit_text(pdf, individual.ROUND_LABELS[key], x, top, title_cols * cell, round_h, 15, bold=True)
        shared._fit_text(pdf, "靶位号", x + title_cols * cell, top, 2 * cell, round_h, 9.5, bold=True)
        shared._fit_text(pdf, target, x + (columns - 2) * cell, top, 2 * cell, round_h, 19, bold=True)
    _shade(pdf, x + cell, head_top, width - cell, header_h, gray)
    _shade(pdf, x, sets_top, cell, 4 * set_h, gray)
    _shade(pdf, x, shoot_top, cell, shoot_h, gray)
    # Paint the total background before the shared grid so no edge is covered.
    shoot_regions = _shoot_regions(arrow_count, compound, paired)
    offset = 0
    for label, span in shoot_regions:
        if label == "总分":
            _shade(pdf, x + offset * cell, shoot_top, span * cell, shoot_h, gray)
        offset += span
    if note_h:
        _shade(pdf, x, note_top, width, note_h)
    # Three gold originals merge three cells for 胜; six-column复合混双
    # follows the split in its own scoring sheet (two cells for each result).
    left_cols = (3 if arrow_count == 2 and compound else 4) if paired else ceil(columns / 2)
    for start in (0, left_cols):
        _shade(pdf, x + start * cell, result_top, cell, result_h, gray)
    for y in (head_top, sets_top, shoot_top, result_top, note_top, sign_top):
        shared._line(pdf, x, y, x + width, y)
    for split in range(1, columns):
        shared._line(pdf, x + split * cell, head_top, x + split * cell, shoot_top)
    for row in range(4):
        row_top = sets_top + row * set_h
        if row:
            shared._line(pdf, x, row_top, x + width, row_top)
        # 附件每局两子行：只分箭值及小计，局号/合计/局分或累计为纵向合并。
        shared._line(pdf, x + cell, row_top + set_h / 2, x + (arrow_count + 2) * cell, row_top + set_h / 2)
        shared._fit_text(pdf, str(row + 1), x, row_top, cell, set_h, font, bold=True)
    if paired:
        shared._line(pdf, x + (columns - 1) * cell, sets_top, x + width, sets_top + set_h)
    for column, label in enumerate(headers):
        if label:
            shared._fit_text(pdf, label, x + column * cell, head_top, cell, header_h, font, bold=column != 0)

    offset = 0
    for label, span in shoot_regions:
        start, region_width = x + offset * cell, span * cell
        if offset:
            shared._line(pdf, start, shoot_top, start, result_top)
        if label == "near":
            size = 8 if paired else 6
            _box(pdf, start + 4, shoot_top + (shoot_h - size) / 2, size)
            shared._fit_text(pdf, "接近中心打勾", start + size + 6, shoot_top, region_width - size - 8, shoot_h, font - 1)
        elif label:
            shared._fit_text(pdf, label, start, shoot_top, region_width, shoot_h, font, bold=True)
        offset += span
    for start, end, label in ((0, left_cols, "胜"), (left_cols, columns, "负")):
        if start:
            shared._line(pdf, x + start * cell, result_top, x + start * cell, note_top)
        shared._line(pdf, x + (start + 1) * cell, result_top, x + (start + 1) * cell, note_top)
        shared._fit_text(pdf, label, x + start * cell, result_top, cell, result_h, font, bold=True)
        size = 8 if paired else 6
        _box(pdf, x + (start + 1) * cell + (end - start - 1) * cell / 2 - size / 2,
             result_top + (result_h - size) / 2, size)
    if note_h:
        shared._fit_text(pdf, _round_note(key, has_bronze), x, note_top, width, note_h, 8.5, bold=True)
    shared._line(pdf, x + 2 * cell, sign_top, x + 2 * cell, top + height)
    shared._fit_text(pdf, "对手签字", x, sign_top, 2 * cell, sign_h, font, bold=True)
    pdf.setLineWidth(1.3)
    shared._rect(pdf, x, top, width, height)


def _handwriting(pdf, label, x, top, width, height, label_width, *, yellow=shared.YELLOW):
    _shade(pdf, x + label_width, top, width - label_width, height, yellow)
    pdf.setStrokeColor(black)
    pdf.setLineWidth(1.3)
    shared._rect(pdf, x, top, width, height)
    shared._line(pdf, x + label_width, top, x + label_width, top + height)
    shared._fit_text(pdf, label, x, top, label_width, height, 13, bold=True)
    for row, text in enumerate(("请运动员", "自行填写")):
        shared._fit_text(pdf, text, x + width - 36, top + row * height / 2, 36, height / 2, 7, bold=True)


def _page_header(pdf, year, season, group_label, competition_format):
    shared._fit_text(pdf, "杭州弓箭俱乐部冠军联赛", 190, 10, 460, 26, 19, bold=True)
    shared._fit_text(pdf, f"{year:04d}赛季 第{shared.STATIONS[season]}站 {season}", 190, 37, 460, 20, 15, bold=True)
    shared._fit_text(pdf, TITLES[competition_format], 190, 59, 460, 22, 17, bold=True)
    pdf.setStrokeColor(black)
    pdf.setLineWidth(1.3)
    shared._yellow(pdf, LEFT, 81, CARD_WIDTH, 19)
    shared._rect(pdf, LEFT, 81, CARD_WIDTH, 19)
    shared._fit_text(pdf, group_label, LEFT, 81, CARD_WIDTH, 19, 14, bold=True)


def _gold_header(pdf, year, season, group_label, competition_format, cell, right):
    shared._fit_text(pdf, f"{year:04d}赛季杭州弓箭俱乐部冠军联赛", 90, 6, shared.PAGE_WIDTH - 180, 32, 23, bold=True)
    mixed = competition_format == "mixed_team"
    badge_x = right + (3 if mixed else 4) * cell
    badge_left_width = (5 if mixed else 6) * cell
    title_x = max(308, FINAL_LEFT + badge_left_width + 12)
    title_width = min(543, badge_x - 12) - title_x
    title = "混双团体淘汰赛计分表" if mixed else TITLES[competition_format]
    shared._fit_text(pdf, title, title_x, 45, title_width, 29, 19, bold=True)
    shared._fit_text(pdf, f"第{shared.STATIONS[season]}站 {season}", title_x, 73, title_width, 14, 10)

    pdf.setStrokeColor(black)
    pdf.setLineWidth(1.6)
    shared._rect(pdf, badge_x, 36, 3 * cell, 47)
    shared._fit_text(pdf, "金牌决赛", badge_x, 36, 3 * cell, 47, 19, bold=True)

    # The route supplies distance and bow in this order; display them in separate cells.
    parts = re.match(r"^(\d+\s*(?:米|m))\s*(.+)$", group_label, re.IGNORECASE)
    distance, bow = parts.groups() if parts else ("", group_label)
    x, top, height = FINAL_LEFT, 51, 31
    distance_width, bow_width = 2 * cell, (3 if mixed else 2) * cell
    spacer = 0 if mixed else 2 * cell  # 团体金 / 复合团金均保留 E3:F3 空白合并格。
    _shade(pdf, x + distance_width, top, bow_width, height, FINAL_YELLOW)
    shared._rect(pdf, x, top, distance_width + bow_width + spacer, height)
    pdf.setLineWidth(0.65)
    for boundary in (distance_width, distance_width + bow_width) if spacer else (distance_width,):
        shared._line(pdf, x + boundary, top, x + boundary, top + height)
    shared._fit_text(pdf, distance, x, top, distance_width, height, 15, bold=True)
    shared._fit_text(pdf, bow, x + distance_width, top, bow_width, height, 15, bold=True)


def _footer(pdf, month, *, gold_cell=None, mixed=False):
    if gold_cell is not None:
        width, label_width = (8 if mixed else 9) * gold_cell, 3 * gold_cell
        x, top, height = FINAL_LEFT + (3 if mixed else 4) * gold_cell, 519, 31
        shared._rect(pdf, x, top, width, height)
        shared._line(pdf, x + label_width, top, x + label_width, top + height)
        shared._fit_text(pdf, "裁判员签字", x, top, label_width, height, 13, bold=True)
        year, month_number = month.split(".")
        shared._fit_text(pdf, f"{year}年{int(month_number)}月 杭州市弓箭运动协会", 190, 563, 460, 28, 16, bold=True)
    else:
        x = LEFT + 2 * (CARD_WIDTH + CARD_GAP)
        shared._rect(pdf, x, 548, CARD_WIDTH, 23)
        shared._line(pdf, x + CARD_WIDTH / 3, 548, x + CARD_WIDTH / 3, 571)
        shared._fit_text(pdf, "裁判签字", x, 548, CARD_WIDTH / 3, 23, 11, bold=True)
        shared._fit_text(pdf, f"杭州市弓箭运动协会   {month}", 190, 547, 340, 26, 15, bold=True)


def _draw_regular_page(pdf, year, season, group_label, rank, month, slots, page_number, page_count, arrow_count, compound, competition_format, has_bronze):
    _page_header(pdf, year, season, group_label, competition_format)
    shared._yellow(pdf, 681.5, 38, 77.5, 43)
    shared._rect(pdf, 604, 38, 155, 43)
    shared._line(pdf, 681.5, 38, 681.5, 81)
    for row, text in enumerate(("排位", "名次")):
        shared._fit_text(pdf, text, 604, 38 + row * 21.5, 77.5, 21.5, 15, bold=True)
    shared._fit_text(pdf, str(rank), 681.5, 38, 77.5, 43, 38, bold=True)
    _handwriting(pdf, "姓名", 168.5, 104, 219, 20, 78)
    _handwriting(pdf, "俱乐部", 464, 104, 219, 20, 78)
    if page_count > 1:
        marker = f"第{page_number}/{page_count}页" if page_number == 1 else f"续页 {page_number}/{page_count}"
        shared._fit_text(pdf, marker, 320, 83, 220, 15, 10)
    for slot, (key, target) in enumerate(slots):
        if key is not None:
            x = LEFT + (slot % 3) * (CARD_WIDTH + CARD_GAP)
            top = TOP + (slot // 3) * (CARD_HEIGHT + ROW_GAP)
            _draw_grid(pdf, x, top, CARD_WIDTH, key, target, arrow_count, compound, has_bronze=has_bronze)
    _footer(pdf, month)


def _draw_gold_page(pdf, year, season, group_label, cards, month, arrow_count, compound, competition_format):
    columns = len(_headers(arrow_count, compound, paired=True))
    cell, left, right = _gold_panels(arrow_count, compound)
    width = columns * cell
    _gold_header(pdf, year, season, group_label, competition_format, cell, right)
    for index, (x, card) in enumerate(zip((left, right), cards)):
        _handwriting(pdf, "姓名", x, FINAL_TOP, width, FINAL_META_ROW, 2 * cell, yellow=FINAL_YELLOW)
        _handwriting(pdf, "俱乐部", x, FINAL_TOP + FINAL_META_ROW, width, FINAL_META_ROW, 2 * cell, yellow=FINAL_YELLOW)
        rank_top = FINAL_TOP + 2 * FINAL_META_ROW
        start = x
        target_cols = columns - arrow_count - 2
        for label, value, span in (("排名", str(index + 1), arrow_count), ("靶位号", card["gold"], target_cols)):
            value_width = span * cell
            _shade(pdf, start + cell, rank_top, value_width, FINAL_META_ROW, FINAL_YELLOW)
            pdf.setLineWidth(0.65)
            if start != x:
                shared._line(pdf, start, rank_top, start, rank_top + FINAL_META_ROW)
            shared._line(pdf, start + cell, rank_top, start + cell, rank_top + FINAL_META_ROW)
            shared._fit_text(pdf, label, start, rank_top, cell, FINAL_META_ROW, 11, bold=True)
            shared._fit_text(pdf, value, start + cell, rank_top, value_width, FINAL_META_ROW, 20, bold=True)
            start += cell + value_width
        pdf.setLineWidth(1.3)
        shared._rect(pdf, x, rank_top, width, FINAL_META_ROW)
        _draw_grid(pdf, x, FINAL_TOP + 3 * FINAL_META_ROW, width, "gold", card["gold"], arrow_count, compound, paired=True)
    _footer(pdf, month, gold_cell=cell, mixed=competition_format == "mixed_team")


def _page_plans(cards, rounds):
    early = [key for key in EARLY_ROUNDS if key in rounds]
    main = [key for key in MAIN_ROUNDS if key in rounds]
    plans = []
    for rank, card in enumerate(cards, start=1):
        layouts = []
        if any(card.get(key, "轮空").strip() not in ("", "轮空") for key in early):
            layouts.append(early)
        if any(key in card for key in main):
            layouts.append(main)
        for page_index, keys in enumerate(layouts, start=1):
            slots = [(key, card[key]) if key in card else (None, "") for key in keys]
            slots.extend([(None, "")] * (6 - len(slots)))
            plans.append((rank, slots, page_index, len(layouts), "bronze" in card))
    if not plans:
        raise ValueError("没有可打印的比赛靶位")
    return plans


def build_team_elimination_scorecards(year, season, group_label, cards, *, bow_type, competition_format) -> bytes:
    """各排位普通手卡；只有两队且仅金牌赛时使用一张含双方的独立决赛表。"""
    if not isinstance(competition_format, str) or competition_format not in TITLES:
        raise ValueError("比赛形式必须是team或mixed_team")
    if not isinstance(bow_type, str):
        raise ValueError("弓种必须为字符串")
    group_label, cards, rounds = individual._validated_cards(year, season, group_label, cards)
    arrow_count = 3 if competition_format == "team" else 2
    compound = bow_type == "compound"
    paired = len(cards) == 2 and rounds == ["gold"] and all("gold" in card for card in cards)
    plans = [] if paired else _page_plans(cards, rounds)
    with shared._RENDER_LOCK:
        shared._ensure_font()
        for text in (group_label, *(value for card in cards for value in card.values())):
            shared._text_runs(shared._normal_text(text), False)
        month = shared.datetime.now(shared.CHINA_STANDARD_TIME).strftime("%Y.%m")
        output = BytesIO()
        pdf = shared.canvas.Canvas(output, pagesize=shared.PAGE_SIZE, pageCompression=1)
        pdf.setTitle("团体淘汰赛计分纸" if competition_format == "team" else "混双淘汰赛计分纸")
        pdf.setAuthor("杭州市弓箭运动协会")
        pdf.setSubject("A4横向团混淘汰赛手卡")
        if paired:
            _draw_gold_page(pdf, year, season, group_label, cards, month, arrow_count, compound, competition_format)
            pdf.showPage()
        else:
            for rank, slots, page_index, page_count, has_bronze in plans:
                _draw_regular_page(pdf, year, season, group_label, rank, month, slots, page_index, page_count,
                                   arrow_count, compound, competition_format, has_bronze)
                pdf.showPage()
        pdf.save()
        return output.getvalue()
