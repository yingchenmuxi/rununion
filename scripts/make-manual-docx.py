#!/usr/bin/env python
# -*- coding: utf-8 -*-
import math
import re
import sys
from pathlib import Path
from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "21-青跑团功能手册-v0.1.md"
OUT = ROOT / "docs" / "青跑团功能手册-v0.1.docx"
ICON = ROOT / "mobile" / "pwa" / "icons" / "icon-1024.png"
BRAND = RGBColor(0x0E, 0x5A, 0x4A)
INK = RGBColor(0x23, 0x2B, 0x26)
MUTED = RGBColor(0x6B, 0x72, 0x6A)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
BEIGE = "F4EFE3"
LINE = "D8D1C2"
SOFT = "FBF8F1"
BT = chr(96)
FENCE = BT * 3


def font(run, size=10.5, bold=False, color=INK, name="Microsoft YaHei"):
    run.font.name = name
    run.font.size = Pt(size)
    run.bold = bold
    run.font.color.rgb = color
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    rfonts.set(qn("w:ascii"), name)
    rfonts.set(qn("w:hAnsi"), name)
    rfonts.set(qn("w:eastAsia"), "微软雅黑")


def style_font(style, size, bold=False, color=INK):
    style.font.name = "Microsoft YaHei"
    style.font.size = Pt(size)
    style.font.bold = bold
    style.font.color.rgb = color
    rpr = style.element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    rfonts.set(qn("w:eastAsia"), "微软雅黑")
    rfonts.set(qn("w:ascii"), "Microsoft YaHei")
    rfonts.set(qn("w:hAnsi"), "Microsoft YaHei")


def shade_p(p, fill):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    p._p.get_or_add_pPr().append(shd)


def border_p(p, edge="left", color=BRAND, sz=18, space=8):
    ppr = p._p.get_or_add_pPr()
    pbdr = ppr.find(qn("w:pBdr"))
    if pbdr is None:
        pbdr = OxmlElement("w:pBdr")
        ppr.append(pbdr)
    el = OxmlElement("w:" + edge)
    el.set(qn("w:val"), "single")
    el.set(qn("w:sz"), str(sz))
    el.set(qn("w:space"), str(space))
    el.set(qn("w:color"), str(color))
    pbdr.append(el)


def shade_cell(cell, fill):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    cell._tc.get_or_add_tcPr().append(shd)


def cell_margins(cell, top=80, bottom=80, left=110, right=110):
    mar = OxmlElement("w:tcMar")
    for tag, val in (("top", top), ("bottom", bottom), ("left", left), ("right", right)):
        el = OxmlElement("w:" + tag)
        el.set(qn("w:w"), str(val))
        el.set(qn("w:type"), "dxa")
        mar.append(el)
    cell._tc.get_or_add_tcPr().append(mar)


def borders(table, color=LINE, sz=4, val="single"):
    tblpr = table._tbl.tblPr
    bs = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement("w:" + edge)
        el.set(qn("w:val"), val)
        el.set(qn("w:sz"), str(sz))
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), color)
        bs.append(el)
    tblpr.append(bs)


def fixed(table):
    table.autofit = False
    layout = OxmlElement("w:tblLayout")
    layout.set(qn("w:type"), "fixed")
    table._tbl.tblPr.append(layout)


def no_split(row):
    row._tr.get_or_add_trPr().append(OxmlElement("w:cantSplit"))


def header_row(row):
    row._tr.get_or_add_trPr().append(OxmlElement("w:tblHeader"))


def inline(p, text, size=10.5, color=INK):
    text = text.replace(BT, "")
    parts = re.split(r"\*\*([^*]+)\*\*", text)
    for i, part in enumerate(parts):
        if not part:
            continue
        run = p.add_run(part)
        font(run, size, i % 2 == 1, color)


def body(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    inline(p, text)
    return p


def bullet(text):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.78)
    p.paragraph_format.first_line_indent = Cm(-0.48)
    p.paragraph_format.space_after = Pt(3.5)
    r = p.add_run("•  ")
    font(r, 10.5, True, BRAND)
    inline(p, text)


def num(n, text):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.88)
    p.paragraph_format.first_line_indent = Cm(-0.58)
    p.paragraph_format.space_after = Pt(3.5)
    r = p.add_run(str(n) + ".  ")
    font(r, 10.5, True, BRAND)
    inline(p, text)


def quote(text):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.3)
    p.paragraph_format.right_indent = Cm(0.3)
    p.paragraph_format.space_before = Pt(7)
    p.paragraph_format.space_after = Pt(9)
    p.paragraph_format.line_spacing = 1.35
    shade_p(p, BEIGE)
    border_p(p, "left", BRAND, 18, 8)
    r = p.add_run("说明｜")
    font(r, 10, True, BRAND)
    inline(p, text, 9.8)


def code(lines):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.35)
    p.paragraph_format.space_before = Pt(5)
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.line_spacing = 1.2
    shade_p(p, "F1EEE6")
    border_p(p, "left", "C9BFA8", 12, 6)
    run = p.add_run()
    font(run, 9, False, RGBColor(0x33, 0x3A, 0x34), "Consolas")
    for i, line in enumerate(lines):
        if i:
            run.add_break()
        run.add_text(line)


def heading(text, level):
    p = doc.add_paragraph(style="Heading " + str(level))
    p.paragraph_format.keep_with_next = True
    if level == 1:
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(10)
        border_p(p, "bottom", BRAND, 10, 6)
        r = p.add_run(text)
        font(r, 21, True, BRAND)
    elif level == 2:
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(5)
        r = p.add_run(text)
        font(r, 14, True, BRAND)
    else:
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(3)
        r = p.add_run(text)
        font(r, 11.5, True, INK)


def table(rows):
    n = max(len(r) for r in rows)
    t = doc.add_table(rows=0, cols=n)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    fixed(t)
    borders(t)
    for ri, row_data in enumerate(rows):
        row = t.add_row()
        no_split(row)
        if ri == 0:
            header_row(row)
        for ci, cell in enumerate(row.cells):
            cell.width = Cm(16.2 / n)
            cell_margins(cell)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.15
            if ri == 0:
                shade_cell(cell, "0E5A4A")
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                inline(p, row_data[ci] if ci < len(row_data) else "", 9.2, WHITE)
                for run in p.runs:
                    run.bold = True
            else:
                if ri % 2 == 0:
                    shade_cell(cell, SOFT)
                inline(p, row_data[ci] if ci < len(row_data) else "", 8.9)
    doc.add_paragraph()


def resolve(rel):
    for base in (SRC.parent, ROOT):
        p = (base / rel).resolve()
        if p.exists():
            return p
    return None


def images(items):
    cols = 1 if len(items) == 1 else 2
    rows = math.ceil(len(items) / cols)
    t = doc.add_table(rows=rows, cols=cols)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    fixed(t)
    borders(t, "FFFFFF", 0, "nil")
    for idx, (alt, rel) in enumerate(items):
        r, c = divmod(idx, cols)
        cell = t.cell(r, c)
        cell.width = Cm(8.0 if cols == 2 else 15.0)
        cell_margins(cell, 40, 40, 40, 40)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(2)
        path = resolve(rel)
        if path is None:
            run = p.add_run("[图片缺失] " + rel)
            font(run, 9, False, RGBColor(0xB0, 0x3A, 0x2E))
        else:
            p.add_run().add_picture(str(path), width=Cm(7.4 if cols == 2 else 14.2))
        cap = cell.add_paragraph()
        cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        cap.paragraph_format.space_after = Pt(0)
        cr = cap.add_run(alt)
        font(cr, 8.4, False, MUTED)
    doc.add_paragraph()


def parse(text):
    lines = text.splitlines()
    out = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line.startswith(FENCE):
            i += 1
            block = []
            while i < len(lines) and not lines[i].strip().startswith(FENCE):
                block.append(lines[i].rstrip())
                i += 1
            i += 1
            out.append(("code", block))
            continue
        if line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
                    rows.append(cells)
                i += 1
            if rows:
                out.append(("table", rows))
            continue
        if line.startswith("!["):
            items = []
            while i < len(lines):
                m = re.match(r"!\[([^\]]*)\]\(([^)]+)\)", lines[i].strip())
                if not m:
                    break
                items.append((m.group(1), m.group(2)))
                i += 1
            out.append(("images", items))
            continue
        if line.startswith(">"):
            q = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                q.append(lines[i].strip()[1:].strip())
                i += 1
            out.append(("quote", " ".join(q)))
            continue
        if line == "<!-- pagebreak -->":
            out.append(("pagebreak", None))
            i += 1
            continue
        if line == "---":
            i += 1
            continue
        m = re.match(r"^(#{1,4})\s+(.*)$", line)
        if m:
            out.append(("h" + str(len(m.group(1))), m.group(2)))
            i += 1
            continue
        m = re.match(r"^-\s+(.*)$", line)
        if m:
            out.append(("bullet", m.group(1)))
            i += 1
            continue
        m = re.match(r"^(\d+)\.\s+(.*)$", line)
        if m:
            out.append(("number", (m.group(1), m.group(2))))
            i += 1
            continue
        para = [line]
        i += 1
        while i < len(lines):
            nxt = lines[i].strip()
            if not nxt or nxt.startswith(("#", "|", ">", "- ", FENCE, "![", "<!--", "---")):
                break
            if re.match(r"^\d+\.\s+", nxt):
                break
            para.append(nxt)
            i += 1
        out.append(("p", " ".join(para)))
    return out


def main():
    blocks = parse(SRC.read_text(encoding="utf-8"))
    start = next(i for i, b in enumerate(blocks) if b[0] == "h2")
    body_blocks = blocks[start:]

    doc0 = Document()
    globals()["doc"] = doc0
    sec = doc0.sections[0]
    sec.page_width = Cm(21)
    sec.page_height = Cm(29.7)
    sec.top_margin = Cm(2.0)
    sec.bottom_margin = Cm(2.0)
    sec.left_margin = Cm(2.2)
    sec.right_margin = Cm(2.2)
    sec.header_distance = Cm(1.0)
    sec.footer_distance = Cm(1.0)
    sec.different_first_page_header_footer = True

    normal = doc0.styles["Normal"]
    style_font(normal, 10.5)
    normal.paragraph_format.line_spacing = 1.55
    normal.paragraph_format.space_after = Pt(6)
    for name, size, color in (("Heading 1", 21, BRAND), ("Heading 2", 14, BRAND), ("Heading 3", 11.5, INK)):
        st = doc0.styles[name]
        style_font(st, size, True, color)
        st.paragraph_format.keep_with_next = True

    doc0.core_properties.title = "青跑团 · 功能手册"
    doc0.core_properties.author = "青跑团项目组"

    p = doc0.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(22)
    p.paragraph_format.space_after = Pt(14)
    r = p.add_run("QINGRUN  ·  青少年公益长跑")
    font(r, 9, True, BRAND)

    if ICON.exists():
        pp = doc0.add_paragraph()
        pp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        pp.paragraph_format.space_after = Pt(16)
        pp.add_run().add_picture(str(ICON), width=Inches(1.08))

    p = doc0.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(6)
    r = p.add_run("青跑团 · 功能手册")
    font(r, 30, True, BRAND)

    p = doc0.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(18)
    r = p.add_run("从入团到成长，一份照着就能用的说明书")
    font(r, 12.5, False, MUTED)

    p = doc0.add_paragraph()
    p.paragraph_format.space_after = Pt(18)
    border_p(p, "bottom", BRAND, 12, 1)

    info = [
        ("版本", "v0.1 演示版", "更新日期", "2026-11-27"),
        ("适用对象", "社长、教练、平台管理员、体验者", "当前形态", "可点击原型 · 本地 Mock"),
        ("手机端", "http://rununion.club", "管理后台", "http://127.0.0.1:8081"),
    ]
    t = doc0.add_table(rows=0, cols=4)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    fixed(t)
    borders(t)
    widths = [2.2, 6.0, 2.2, 6.2]
    for row_data in info:
        row = t.add_row()
        no_split(row)
        for ci, cell in enumerate(row.cells):
            cell.width = Cm(widths[ci])
            cell_margins(cell, 95, 95, 120, 120)
            if ci % 2 == 0:
                shade_cell(cell, BEIGE)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.2
            inline(p, row_data[ci], 9.2, BRAND if ci % 2 == 0 else INK)

    p = doc0.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(14)
    r = p.add_run("演示资料  ·  所有姓名、活动、记录、公告、挑战与公益账本均为示例数据")
    font(r, 8.5, False, MUTED)
    doc0.add_page_break()

    p = doc0.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(8)
    r = p.add_run("阅读提示")
    font(r, 19, True, BRAND)
    border_p(p, "bottom", BRAND, 8, 5)
    body("这份手册按“先看懂、再操作、最后排障”的顺序编排。第一次接触青跑团，建议从第 1 章开始；已经熟悉产品，可以直接翻到对应章节。")
    for item in [
        "想先体验：看第 1 章的三个入口和演示账号，再翻到最后的「最短上手路线」。",
        "想用手机端：看第 2 章，覆盖登录、入团、五个主页、活动、消息、公告、挑战和公益账本。",
        "想用管理后台：看第 3 章社团后台和第 4 章平台总后台。",
        "想部署或排障：看第 7 章 Windows 部署运维和第 8 章常见问题。",
    ]:
        bullet(item)
    quote("青跑团当前是可点击原型，使用本地 Mock 数据，不是已经上线的正式产品。手册里的操作都可以真实点击，但数据只存在演示进程里，重启或重置会回到种子状态。")

    p = doc0.add_paragraph()
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(8)
    r = p.add_run("目录")
    font(r, 19, True, BRAND)
    border_p(p, "bottom", BRAND, 8, 5)
    toc = [
        ("1. 一分钟认识青跑团", "三个入口、演示账号、界面预览"),
        ("2. 手机端功能", "登录、入团、五个主页、活动、消息、公告、挑战、公益"),
        ("3. 社团后台", "概览、成员、邀请码、公告、活动、挑战、记录"),
        ("4. 平台总后台", "九个平台管理模块"),
        ("5. 典型流程", "入团、活动、公告、挑战、导出"),
        ("6. 数据与边界", "数据位置、重置、当前不做的事"),
        ("7. 部署与运维", "Windows 启动、停止、检查、更新、HTTPS"),
        ("8. 常见问题", "打不开、登录、邀请码、记录、PWA"),
        ("9. 本次验收", "历史验收与全量回归"),
        ("10. 文档与版本", "文档索引、版本信息"),
        ("附：最短上手路线", "5 分钟体验路径"),
    ]
    table([["章节", "你会看到"]] + [list(x) for x in toc])
    p = doc0.add_paragraph()
    p.paragraph_format.space_before = Pt(6)
    r = p.add_run("共 10 章 + 附录。页脚显示当前页码。")
    font(r, 8.5, False, MUTED)
    doc0.add_page_break()

    first = True
    for typ, value in body_blocks:
        if typ == "h2":
            if not first:
                doc0.add_page_break()
            heading(value, 1)
            first = False
        elif typ == "h3":
            heading(value, 2)
        elif typ == "h4":
            heading(value, 3)
        elif typ == "p":
            body(value)
        elif typ == "bullet":
            bullet(value)
        elif typ == "number":
            num(value[0], value[1])
        elif typ == "quote":
            quote(value)
        elif typ == "code":
            code(value)
        elif typ == "table":
            table(value)
        elif typ == "images":
            images(value)
        elif typ == "pagebreak":
            doc0.add_page_break()

    hp = sec.header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    hr = hp.add_run("青跑团 · 功能手册  |  内部演示资料")
    font(hr, 8, False, MUTED)

    fp = sec.footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.LEFT
    fp.paragraph_format.tab_stops.add_tab_stop(Cm(16.4), WD_TAB_ALIGNMENT.RIGHT)
    fr = fp.add_run("青跑团 v0.1 演示版\t第 ")
    font(fr, 8, False, MUTED)
    for code_text, tail in ((" PAGE ", " 页  /  共 "), (" NUMPAGES ", " 页")):
        fld1 = OxmlElement("w:fldChar")
        fld1.set(qn("w:fldCharType"), "begin")
        instr = OxmlElement("w:instrText")
        instr.set(qn("xml:space"), "preserve")
        instr.text = code_text
        fld2 = OxmlElement("w:fldChar")
        fld2.set(qn("w:fldCharType"), "end")
        run_el = fp.add_run()._r
        run_el.append(fld1)
        run_el.append(instr)
        run_el.append(fld2)
        rr = fp.add_run(tail)
        font(rr, 8, False, MUTED)

    doc0.save(str(OUT))
    check = Document(str(OUT))
    text_out = "\n".join(p.text for p in check.paragraphs)
    bad = [x for x in ("**", BT) if x in text_out]
    hs = [p.text for p in check.paragraphs if p.style.name.startswith("Heading")]
    print("saved=" + str(OUT))
    print("paragraphs=%s tables=%s images=%s" % (len(check.paragraphs), len(check.tables), len(check.inline_shapes)))
    print("headings=%s first=%s" % (len(hs), hs[:4]))
    print("leftover_markup=%s chars=%s" % (bad, len(text_out)))
    if bad:
        sys.exit(1)


if __name__ == "__main__":
    main()
