"""A4横向矢量排位记分纸；只在内存生成，不读取或持久化个人资料文件。"""
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from threading import Lock

from reportlab.lib.colors import HexColor, black
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont, TTFError
from reportlab.pdfgen import canvas


CHINA_STANDARD_TIME = timezone(timedelta(hours=8))
PAGE_SIZE = landscape(A4)
PAGE_WIDTH, PAGE_HEIGHT = PAGE_SIZE
FONT_PATH = Path("/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf")
FONT_NAME = "ScorecardDroidSansFallback"
_FONT_LOCK = Lock()
# ReportLab不保证共享TTFont对象的跨文档并行子集化；每个worker内串行绘制。
_RENDER_LOCK = Lock()
YELLOW = HexColor("#EEE94D")
MARGIN = 30.5
CARD_GAP = 25.0
CARD_WIDTH = (PAGE_WIDTH - 2 * MARGIN - 3 * CARD_GAP) / 4
CARD_TOP = 127.0
META_HEIGHT = 43.0
HEADER_HEIGHT = 38.5
GROUP_HEIGHT = 38.5
SUMMARY_HEIGHT = 38.5
CARD_HEIGHT = META_HEIGHT + HEADER_HEIGHT + 6 * GROUP_HEIGHT + SUMMARY_HEIGHT
STATIONS = {"春季赛": "一", "夏季赛": "二", "秋季赛": "三", "冬季赛": "四"}


class ScorecardFontUnavailable(RuntimeError):
    pass


class ScorecardUnsupportedText(ValueError):
    pass


def _ensure_font():
    with _FONT_LOCK:
        if FONT_NAME not in pdfmetrics.getRegisteredFontNames():
            try:
                pdfmetrics.registerFont(TTFont(FONT_NAME, str(FONT_PATH)))
            except (OSError, TTFError) as exc:
                raise ScorecardFontUnavailable("中文字体未安装，请安装 fonts-droid-fallback") from exc


def _normal_text(text):
    return str(text).replace("\r", " ").replace("\n", " ").replace("\t", " ")


def _character_font(character, bold):
    latin = "Helvetica-Bold" if bold else "Helvetica"
    try:
        code = character.encode("cp1252")[0]
        font = pdfmetrics.getFont(latin)
        glyph = font.encoding.vector[code]
        if glyph and glyph in font.face.glyphWidths:
            return latin
    except UnicodeEncodeError:
        pass
    if pdfmetrics.getFont(FONT_NAME).face.charToGlyph.get(ord(character)):
        return FONT_NAME
    raise ScorecardUnsupportedText(f"当前打印字体不支持字符 U+{ord(character):04X}，请检查输入文字")


def _text_runs(text, bold):
    # DroidSansFallback只提供CJK后备字形，ASCII/拉丁必须用PDF内建拉丁字体，不能画空白。
    runs = []
    for character in text:
        font = _character_font(character, bold)
        if runs and runs[-1][0] == font:
            runs[-1] = (font, runs[-1][1] + character)
        else:
            runs.append((font, character))
    return runs


def _text_metrics(runs, size):
    widths = [pdfmetrics.stringWidth(text, font, size) for font, text in runs]
    heights = [pdfmetrics.getAscentDescent(font, size) for font, _text in runs]
    return sum(widths), max(ascent for ascent, _descent in heights), min(descent for _ascent, descent in heights)


def _fit_text(pdf, text, x, top, width, height, size=12, bold=False, align="center"):
    """以字体实际宽度/升降部适配矩形，绝不省略、裁切或设置最小字号丢失文字。"""
    if not text:
        return
    text = _normal_text(text)
    available_width = max(width - 4, 0.1)
    available_height = max(height - 3, 0.1)
    runs = _text_runs(text, bold)
    natural_width, ascent, descent = _text_metrics(runs, size)
    scale = min(1, available_width / max(natural_width, 0.1), available_height / max(ascent - descent, 0.1))
    size *= scale
    text_width, ascent, descent = _text_metrics(runs, size)
    origin_x = x + 2 if align == "left" else x + (width - text_width) / 2
    baseline = PAGE_HEIGHT - top - (height - (ascent - descent)) / 2 - ascent
    pdf.saveState()
    pdf.setFillColor(black)
    pdf.setStrokeColor(black)
    pdf.setLineWidth(0.18)
    item = pdf.beginText(origin_x, baseline)
    for font, value in runs:
        item.setFont(font, size)
        item.setTextRenderMode(2 if bold and font == FONT_NAME else 0)
        item.textOut(value)
    pdf.drawText(item)
    pdf.restoreState()


def _line(pdf, x1, top1, x2, top2):
    pdf.line(x1, PAGE_HEIGHT - top1, x2, PAGE_HEIGHT - top2)


def _rect(pdf, x, top, width, height, fill=False, stroke=True):
    pdf.rect(x, PAGE_HEIGHT - top - height, width, height, stroke=int(stroke), fill=int(fill))


def _yellow(pdf, x, top, width, height):
    pdf.saveState()
    pdf.setFillColor(YELLOW)
    _rect(pdf, x, top, width, height, fill=True, stroke=False)
    pdf.restoreState()


def _vertical_label(pdf, text, x, top, width, height):
    for index, character in enumerate(text):
        _fit_text(pdf, character, x, top + index * height / len(text), width, height / len(text), 11)


def _draw_card(pdf, position, index):
    x = MARGIN + index * (CARD_WIDTH + CARD_GAP)
    cell = CARD_WIDTH / 7
    header_top = CARD_TOP + META_HEIGHT
    body_top = header_top + HEADER_HEIGHT
    summary_top = body_top + 6 * GROUP_HEIGHT

    _yellow(pdf, x + 2 * cell, CARD_TOP, 3 * cell, META_HEIGHT)
    _yellow(pdf, x + 5 * cell, CARD_TOP, 2 * cell, META_HEIGHT)
    _yellow(pdf, x + 4 * cell, summary_top, 3 * cell, SUMMARY_HEIGHT)
    pdf.setStrokeColor(black)
    pdf.setLineWidth(0.65)
    _line(pdf, x, CARD_TOP + META_HEIGHT / 2, x + 5 * cell, CARD_TOP + META_HEIGHT / 2)
    for split in (2, 5):
        _line(pdf, x + split * cell, CARD_TOP, x + split * cell, header_top)
    _line(pdf, x, header_top, x + CARD_WIDTH, header_top)

    _fit_text(pdf, "运动员", x, CARD_TOP, 2 * cell, META_HEIGHT / 2, 11, bold=True)
    _fit_text(pdf, "俱乐部", x, CARD_TOP + META_HEIGHT / 2, 2 * cell, META_HEIGHT / 2, 11, bold=True)
    _fit_text(pdf, position.athlete, x + 2 * cell, CARD_TOP, 3 * cell, META_HEIGHT / 2, 16, bold=True)
    _fit_text(pdf, position.club, x + 2 * cell, CARD_TOP + META_HEIGHT / 2, 3 * cell, META_HEIGHT / 2, 13, bold=True)
    _fit_text(pdf, position.target, x + 5 * cell, CARD_TOP, 2 * cell, META_HEIGHT, 24, bold=True)

    for split in range(1, 7):
        _line(pdf, x + split * cell, header_top, x + split * cell, summary_top)
    _line(pdf, x + cell, header_top + HEADER_HEIGHT / 2, x + 4 * cell, header_top + HEADER_HEIGHT / 2)
    for arrow in range(6):
        _fit_text(pdf, str(arrow + 1), x + (arrow % 3 + 1) * cell,
                  header_top + (arrow // 3) * HEADER_HEIGHT / 2, cell, HEADER_HEIGHT / 2, 12, bold=True)
    for column, label in ((4, "小计"), (5, "合计"), (6, "累计")):
        _vertical_label(pdf, label, x + column * cell, header_top, cell, HEADER_HEIGHT)

    for group in range(6):
        top = body_top + group * GROUP_HEIGHT
        _line(pdf, x, top, x + CARD_WIDTH, top)
        _line(pdf, x + cell, top + GROUP_HEIGHT / 2, x + 5 * cell, top + GROUP_HEIGHT / 2)
        _fit_text(pdf, f"{group + 1}/{(group + 1) * 6}", x, top, cell, GROUP_HEIGHT, 10.5)
    # 第一组累计栏不填，参考模板用从左上至右下的斜线提示。
    _line(pdf, x + 6 * cell, body_top, x + 7 * cell, body_top + GROUP_HEIGHT)
    _line(pdf, x, summary_top, x + CARD_WIDTH, summary_top)
    _line(pdf, x, summary_top + SUMMARY_HEIGHT / 2, x + CARD_WIDTH, summary_top + SUMMARY_HEIGHT / 2)
    for split in (2, 4):
        _line(pdf, x + split * cell, summary_top, x + split * cell, summary_top + SUMMARY_HEIGHT)
    _fit_text(pdf, "10+X", x, summary_top, 2 * cell, SUMMARY_HEIGHT / 2, 11)
    _fit_text(pdf, "X", x + 2 * cell, summary_top, 2 * cell, SUMMARY_HEIGHT / 2, 11)
    _fit_text(pdf, "单轮成绩", x + 4 * cell, summary_top, 3 * cell, SUMMARY_HEIGHT / 2, 12, bold=True)
    pdf.setLineWidth(1.4)
    _rect(pdf, x, CARD_TOP, CARD_WIDTH, CARD_HEIGHT)
    _fit_text(pdf, "运动员签字：", x + 1, 496, CARD_WIDTH - 2, 20, 11, bold=True, align="left")
    if index == 1:
        _fit_text(pdf, "计分员签字：", x + 1, 525, CARD_WIDTH - 2, 20, 11, bold=True, align="left")
    elif index == 2:
        _fit_text(pdf, "裁判员签字：", x + 1, 525, CARD_WIDTH - 2, 20, 11, bold=True, align="left")


def _draw_page(pdf, year, season, month, page):
    _fit_text(pdf, "杭州弓箭俱乐部冠军联赛", MARGIN, 21, PAGE_WIDTH - 2 * MARGIN, 26, 19, bold=True)
    _fit_text(pdf, f"{year:04d}赛季第{STATIONS[season]}站 {season}", MARGIN, 49, PAGE_WIDTH - 2 * MARGIN, 20, 15, bold=True)
    _fit_text(pdf, "排位赛计分表", MARGIN, 71, PAGE_WIDTH - 2 * MARGIN, 21, 17, bold=True)
    pdf.setStrokeColor(black)
    pdf.setLineWidth(1.3)
    _rect(pdf, MARGIN, 92.5, CARD_WIDTH, 22)
    _fit_text(pdf, page.group, MARGIN, 92.5, CARD_WIDTH, 22, 16, bold=True)
    round_x = MARGIN + 3 * (CARD_WIDTH + CARD_GAP)
    round_width = 76
    _yellow(pdf, round_x + round_width / 3, 92.5, round_width / 3, 22)
    _rect(pdf, round_x, 92.5, round_width, 22)
    value = page.round.strip()
    if value.startswith("第") and value.endswith("轮"):
        value = value[1:-1].strip()
    for index, text in enumerate(("第", value, "轮")):
        _fit_text(pdf, text, round_x + index * round_width / 3, 92.5, round_width / 3, 22, 16, bold=True)
    for index, position in enumerate(page.positions):
        _draw_card(pdf, position, index)
    _fit_text(pdf, f"杭州市弓箭运动协会   {month}", MARGIN, 556, PAGE_WIDTH - 2 * MARGIN, 26, 15, bold=True)


def _build_pdf(year, season, request):
    """从已验证的赛事身份及请求生成PDF字节；本函数没有数据库或磁盘输出操作。"""
    if not isinstance(year, int) or not 1 <= year <= 9999 or season not in STATIONS:
        raise ValueError("赛事年度或赛季无效，无法生成记分纸")
    _ensure_font()
    # 先验证所有上传文字，缺字时明确失败，禁止悄悄输出空白/方框后仍称生成成功。
    for page in request.pages:
        for text in (page.group, page.round, *(value for position in page.positions for value in (position.target, position.club, position.athlete))):
            _text_runs(_normal_text(text), False)
    output = BytesIO()
    pdf = canvas.Canvas(output, pagesize=PAGE_SIZE, pageCompression=1)
    pdf.setTitle("排位赛计分纸")
    pdf.setAuthor("杭州市弓箭运动协会")
    pdf.setSubject("A4横向四联排位赛计分表")
    generated_month = datetime.now(CHINA_STANDARD_TIME).strftime("%Y.%m")
    for page in request.pages:
        _draw_page(pdf, year, season, generated_month, page)
        pdf.showPage()
    pdf.save()
    return output.getvalue()


def build_ranking_scorecards(year, season, request):
    """请求只驻留内存，字体子集创建到pdf.save全程受同一个进程内锁保护。"""
    with _RENDER_LOCK:
        return _build_pdf(year, season, request)
