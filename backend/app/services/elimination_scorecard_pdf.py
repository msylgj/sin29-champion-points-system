"""固定六槽的个人淘汰赛手卡；只生成内存矢量PDF，不写入姓名或业务数据。"""
from io import BytesIO

from reportlab.lib.colors import HexColor, black

from app.services import ranking_scorecard_pdf as shared


ROUND_ORDER = ("1/64", "1/32", "1/16", "1/8", "1/4", "1/2", "bronze", "gold")
EARLY_ROUNDS = ROUND_ORDER[:2]
TEMPLATE_ROUNDS = ROUND_ORDER[2:]
ROUND_LABELS = {**{key: key for key in ROUND_ORDER[:-2]}, "bronze": "铜牌", "gold": "金牌"}
CARD_WIDTH = 233.0
CARD_HEIGHT = 184.0
CARD_GAP = 24.0
ROW_GAP = 11.5
LEFT = 52.8
TOP = 147.5
ROUND_HEADER_HEIGHT = 22.0
ARROW_HEADER_HEIGHT = 13.5
SET_HEIGHT = 16.3
SHOOT_OFF_HEIGHT = 16.5
RESULT_HEIGHT = 16.0
NOTE_HEIGHT = 13.0
SIGN_HEIGHT = 21.5
GRAY = HexColor("#D3DADC")


def _shade(pdf, x, top, width, height):
    pdf.saveState()
    pdf.setFillColor(GRAY)
    shared._rect(pdf, x, top, width, height, fill=True, stroke=False)
    pdf.restoreState()


def _checkbox(pdf, x, top, size=7):
    shared._rect(pdf, x, top, size, size)


def _draw_table(pdf, slot, round_key, target, has_bronze=False, score_header="局分"):
    if round_key is None:
        return  # 未使用的槽位留白，不绘制表格边框。
    x = LEFT + (slot % 3) * (CARD_WIDTH + CARD_GAP)
    top = TOP + (slot // 3) * (CARD_HEIGHT + ROW_GAP)
    pdf.setStrokeColor(black)
    pdf.setLineWidth(1.3)
    shared._rect(pdf, x, top, CARD_WIDTH, CARD_HEIGHT)

    cell = CARD_WIDTH / 6
    arrow_top = top + ROUND_HEADER_HEIGHT
    sets_top = arrow_top + ARROW_HEADER_HEIGHT
    shoot_top = sets_top + 5 * SET_HEIGHT
    result_top = shoot_top + SHOOT_OFF_HEIGHT
    note_top = result_top + RESULT_HEIGHT
    sign_top = note_top + NOTE_HEIGHT

    shared._yellow(pdf, x + 4 * cell, top, 2 * cell, ROUND_HEADER_HEIGHT)
    _shade(pdf, x + cell, arrow_top, 5 * cell, ARROW_HEADER_HEIGHT)
    _shade(pdf, x, sets_top, cell, 5 * SET_HEIGHT)
    _shade(pdf, x, shoot_top, cell, SHOOT_OFF_HEIGHT)
    _shade(pdf, x + 4 * cell, shoot_top, cell, SHOOT_OFF_HEIGHT)
    for offset in (0, 3):
        _shade(pdf, x + offset * cell, result_top, cell, RESULT_HEIGHT)
    _shade(pdf, x, note_top, CARD_WIDTH, NOTE_HEIGHT)
    pdf.setLineWidth(0.65)
    for y in (arrow_top, sets_top, shoot_top, result_top, note_top, sign_top):
        shared._line(pdf, x, y, x + CARD_WIDTH, y)
    for split in (2, 4):
        shared._line(pdf, x + split * cell, top, x + split * cell, arrow_top)
    for split in range(1, 6):
        shared._line(pdf, x + split * cell, arrow_top, x + split * cell, shoot_top)
    for row in range(1, 5):
        shared._line(pdf, x, sets_top + row * SET_HEIGHT, x + CARD_WIDTH, sets_top + row * SET_HEIGHT)
    for split in (1, 2, 4, 5):
        shared._line(pdf, x + split * cell, shoot_top, x + split * cell, result_top)
    for split in (1, 3, 4):
        shared._line(pdf, x + split * cell, result_top, x + split * cell, note_top)
    shared._line(pdf, x + 2 * cell, sign_top, x + 2 * cell, top + CARD_HEIGHT)

    shared._fit_text(pdf, ROUND_LABELS[round_key], x, top, 2 * cell, ROUND_HEADER_HEIGHT, 17, bold=True)
    shared._fit_text(pdf, "靶位号", x + 2 * cell, top, 2 * cell, ROUND_HEADER_HEIGHT, 10, bold=True)
    shared._fit_text(pdf, target, x + 4 * cell, top, 2 * cell, ROUND_HEADER_HEIGHT, 21, bold=True)
    for column, label in enumerate(("局", "1", "2", "3", "小计", score_header)):
        shared._fit_text(pdf, label, x + column * cell, arrow_top, cell, ARROW_HEADER_HEIGHT, 10, bold=column != 0)
    for row in range(5):
        shared._fit_text(pdf, str(row + 1), x, sets_top + row * SET_HEIGHT, cell, SET_HEIGHT, 10.5, bold=True)
    shared._fit_text(pdf, "决金箭", x, shoot_top, cell, SHOOT_OFF_HEIGHT, 10, bold=True)
    _checkbox(pdf, x + 2 * cell + 6, shoot_top + (SHOOT_OFF_HEIGHT - 7) / 2)
    shared._fit_text(pdf, "接近中心打勾", x + 2 * cell + 14, shoot_top, 2 * cell - 16, SHOOT_OFF_HEIGHT, 8.5)
    shared._fit_text(pdf, "总分", x + 4 * cell, shoot_top, cell, SHOOT_OFF_HEIGHT, 10, bold=True)
    for offset, label in ((0, "胜"), (3, "负")):
        shared._fit_text(pdf, label, x + offset * cell, result_top, cell, RESULT_HEIGHT, 10.5, bold=True)
        _checkbox(pdf, x + (offset + 2) * cell - 3.5, result_top + (RESULT_HEIGHT - 7) / 2)
    if round_key == "1/2":
        note = ("胜方请前往金牌靶位，负方请前往铜牌靶位。" if has_bronze else
                "胜方请前往金牌靶位，负方请将计分表交与裁判。")
    elif round_key in ("bronze", "gold"):
        note = "请胜负双方选手均将计分纸交与裁判。"
    else:
        note = "胜方继续下一轮，负方请将计分表交与裁判。"
    shared._fit_text(pdf, note, x, note_top, CARD_WIDTH, NOTE_HEIGHT, 9, bold=True)
    shared._fit_text(pdf, "对手签字", x, sign_top, 2 * cell, SIGN_HEIGHT, 10, bold=True)
    pdf.setLineWidth(1.3)
    shared._rect(pdf, x, top, CARD_WIDTH, CARD_HEIGHT)


def _handwriting_field(pdf, label, x):
    top, width, height, label_width = 113.3, 219, 23, 78
    shared._yellow(pdf, x + label_width, top, width - label_width, height)
    pdf.setLineWidth(1.3)
    shared._rect(pdf, x, top, width, height)
    shared._line(pdf, x + label_width, top, x + label_width, top + height)
    shared._fit_text(pdf, label, x, top, label_width, height, 15, bold=True)
    for line, text in enumerate(("请运动员", "自行填写")):
        shared._fit_text(pdf, text, x + width - 36, top + line * height / 2, 36, height / 2, 7, bold=True)


def _draw_page(pdf, year, season, group_label, rank, month, slots, page_number, page_count, has_bronze, score_header):
    shared._fit_text(pdf, "杭州弓箭俱乐部冠军联赛", 190, 31, 460, 27, 20, bold=True)
    shared._fit_text(pdf, f"{year:04d}赛季 第{shared.STATIONS[season]}站 {season}", 190, 60, 460, 20, 15, bold=True)
    shared._fit_text(pdf, "淘汰赛计分表", 190, 83, 460, 22, 17, bold=True)
    pdf.setStrokeColor(black)
    pdf.setLineWidth(1.3)
    # 选项由调用者按距离/弓种/分组合成；与参考一样只放组别，不预填姓名/俱乐部。
    text_width, _ascent, _descent = shared._text_metrics(shared._text_runs(group_label, True), 16)
    highlight = min(CARD_WIDTH - 3, text_width + 4)
    shared._yellow(pdf, LEFT + (CARD_WIDTH - highlight) / 2, 81, highlight, 21)
    shared._rect(pdf, LEFT, 80, CARD_WIDTH, 23)
    shared._fit_text(pdf, group_label, LEFT, 80, CARD_WIDTH, 23, 16, bold=True)
    if page_count > 1:
        marker = f"第{page_number}/{page_count}页" if page_number == 1 else f"续页 {page_number}/{page_count}"
        shared._fit_text(pdf, marker, LEFT, 104, CARD_WIDTH, 9, 8)

    rank_x, rank_top, rank_width, rank_height = 604, 56, 155, 47
    shared._yellow(pdf, rank_x + rank_width / 2, rank_top, rank_width / 2, rank_height)
    shared._rect(pdf, rank_x, rank_top, rank_width, rank_height)
    shared._line(pdf, rank_x + rank_width / 2, rank_top, rank_x + rank_width / 2, rank_top + rank_height)
    for line, text in enumerate(("排位", "名次")):
        shared._fit_text(pdf, text, rank_x, rank_top + line * rank_height / 2, rank_width / 2, rank_height / 2, 16, bold=True)
    shared._fit_text(pdf, str(rank), rank_x + rank_width / 2, rank_top, rank_width / 2, rank_height, 42, bold=True)
    _handwriting_field(pdf, "姓名", 168.5)
    _handwriting_field(pdf, "俱乐部", 464)
    for index, (key, target) in enumerate(slots):
        _draw_table(pdf, index, key, target, has_bronze, score_header)

    shared._fit_text(pdf, f"杭州市弓箭运动协会   {month}", 190, 539, 340, 26, 15, bold=True)
    judge_x = LEFT + 2 * (CARD_WIDTH + CARD_GAP)
    shared._rect(pdf, judge_x, 538, CARD_WIDTH, 23)
    shared._line(pdf, judge_x + CARD_WIDTH / 3, 538, judge_x + CARD_WIDTH / 3, 561)
    shared._fit_text(pdf, "裁判签字", judge_x, 538, CARD_WIDTH / 3, 23, 11, bold=True)


def _validated_cards(year, season, group_label, cards):
    if type(year) is not int or not 1 <= year <= 9999 or not isinstance(season, str) or season not in shared.STATIONS:
        raise ValueError("赛事年度或赛季无效")
    if not isinstance(group_label, str) or not group_label.strip() or len(group_label) > 120:
        raise ValueError("组别文字必须为1至120个字符")
    if not isinstance(cards, list) or not 1 <= len(cards) <= 128:
        raise ValueError("记分卡数量必须为1至128")
    copied = []
    for card in cards:
        if not isinstance(card, dict) or any(key not in ROUND_ORDER for key in card):
            raise ValueError("包含不支持的淘汰轮次")
        if any(not isinstance(value, str) or len(value) > 120 for value in card.values()):
            raise ValueError("靶位文字必须为不超过120个字符的字符串")
        copied.append(dict(card))
    rounds = [key for key in ROUND_ORDER if any(key in card for card in copied)]
    if not rounds:
        raise ValueError("至少需要一个有效淘汰轮次")
    return group_label.strip(), copied, rounds


def build_elimination_scorecards(
    year: int, season: str, group_label: str, cards: list[dict[str, str]], *, bow_type: str = "",
) -> bytes:
    """按排位顺序逐人输出；有参赛靶位的早轮独立成页，其余轮次按固定网格排。"""
    group_label, cards, rounds = _validated_cards(year, season, group_label, cards)
    score_header = "累计" if bow_type == "compound" else "局分"
    # 与排位纸共享同一TTFont对象及同一锁，保护从字形检查到pdf.save的完整生命周期。
    with shared._RENDER_LOCK:
        shared._ensure_font()
        for text in (group_label, *(value for card in cards for value in card.values())):
            shared._text_runs(shared._normal_text(text), False)
        month = shared.datetime.now(shared.CHINA_STANDARD_TIME).strftime("%Y.%m")
        output = BytesIO()
        pdf = shared.canvas.Canvas(output, pagesize=shared.PAGE_SIZE, pageCompression=1)
        pdf.setTitle("个人淘汰赛计分纸")
        pdf.setAuthor("杭州市弓箭运动协会")
        pdf.setSubject("A4横向六槽个人淘汰赛手卡")
        # 1/64、1/32 独立成页；对没有早轮靶位的选手不打印整页轮空手卡。
        early_rounds = [key for key in EARLY_ROUNDS if key in rounds]
        main_rounds = [key for key in TEMPLATE_ROUNDS if key in rounds]
        for rank, card in enumerate(cards, start=1):
            layouts = []
            if any(card.get(key, "轮空") != "轮空" for key in early_rounds):
                layouts.append(early_rounds)
            if main_rounds:
                layouts.append(main_rounds)
            for page_index, keys in enumerate(layouts, start=1):
                slots = [(key, card[key]) if key in card else (None, "") for key in keys]
                slots.extend([(None, "")] * (6 - len(slots)))
                _draw_page(pdf, year, season, group_label, rank, month, slots, page_index, len(layouts),
                           "bronze" in card, score_header)
                pdf.showPage()
        pdf.save()
        return output.getvalue()
