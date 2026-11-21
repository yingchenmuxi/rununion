from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

base = Path(r"E:/QPTapp/mobile/shots/announcements")
items = [
    ("01-school-announcements.png", "01 跑团页公告与入口"),
    ("02-club-home.png", "02 跑团主页"),
    ("03-announcement-detail.png", "03 置顶公告详情"),
    ("04-announcements-list.png", "04 全部公告 3 条"),
    ("05-announcements-unread.png", "05 未读筛选 1 条"),
    ("06-home-bell.png", "06 首页铃铛未读 3"),
    ("07-message-announcement.png", "07 消息中心公告消息"),
    ("08-announcement-from-message.png", "08 消息跳公告详情"),
    ("09-after-withdraw.png", "09 撤回后公告列表"),
]
target_w = 320
gap = 18
margin = 30
label_h = 32
cols = 3
bg = (247, 244, 236)
brand = (14, 90, 74)
muted = (110, 110, 105)
font_path = r"C:/Windows/Fonts/msyh.ttc"
font = ImageFont.truetype(font_path, 18)
small = ImageFont.truetype(font_path, 14)
title_font = ImageFont.truetype(font_path, 28)

loaded = []
for name, label in items:
    im = Image.open(base / name).convert("RGB")
    h = round(im.height * target_w / im.width)
    im = im.resize((target_w, h), Image.LANCZOS)
    loaded.append((im, label))

rows = (len(loaded) + cols - 1) // cols
img_h = max(im.height for im, _ in loaded)
width = margin * 2 + target_w * cols + gap * (cols - 1)
top = 96
height = top + rows * (label_h + img_h + 14) + 34
canvas = Image.new("RGB", (width, height), bg)
draw = ImageDraw.Draw(canvas)
draw.text((margin, 26), "青跑团 · 跑团公告与跑团主页", fill=brand, font=title_font)
draw.text((margin, 66), "手机端 390×844 视口 · 9 张证据图 · 49 项断言通过", fill=muted, font=small)
for i, (im, label) in enumerate(loaded):
    row, col = divmod(i, cols)
    x = margin + col * (target_w + gap)
    y = top + row * (label_h + img_h + 14)
    draw.text((x, y), label, fill=brand, font=font)
    canvas.paste(im, (x, y + label_h))
out = base / "contact-sheet.png"
canvas.save(out, "PNG", optimize=True)
print(out)
print(canvas.size)
