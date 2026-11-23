from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

base = Path(r"E:/QPTapp/mobile/shots/runs-challenges")
items = [
    ("01-growth-challenge.png", "01 成长页挑战 50.5 / 80"),
    ("02-challenges-list.png", "02 全部挑战 4 个"),
    ("03-home-bell.png", "03 首页铃铛 3 条未读"),
    ("04-message-challenge.png", "04 消息中心挑战通知"),
    ("05-challenge-from-message.png", "05 消息跳转挑战页"),
    ("06-run-manual.png", "06 手动补记 3 km"),
    ("07-growth-after-run.png", "07 成长页刷新 53.5 / 80"),
]
target_w = 300
gap = 18
margin = 28
label_h = 30
cols = 4
bg = (243, 240, 232)
brand = (23, 38, 33)
muted = (91, 107, 100)
font = ImageFont.truetype(r"C:/Windows/Fonts/msyh.ttc", 16)
small = ImageFont.truetype(r"C:/Windows/Fonts/msyh.ttc", 13)
title_font = ImageFont.truetype(r"C:/Windows/Fonts/msyh.ttc", 28)

loaded = []
for name, label in items:
    im = Image.open(base / name).convert("RGB")
    h = round(im.height * target_w / im.width)
    im = im.resize((target_w, h), Image.LANCZOS)
    loaded.append((im, label))

rows = (len(loaded) + cols - 1) // cols
img_h = max(im.height for im, _ in loaded)
width = margin * 2 + target_w * cols + gap * (cols - 1)
top = 94
height = top + rows * (label_h + img_h + 14) + 30
canvas = Image.new("RGB", (width, height), bg)
draw = ImageDraw.Draw(canvas)
draw.text((margin, 24), "手机端 · 开跑记录与挑战", fill=brand, font=title_font)
draw.text((margin, 64), "390×844 · 7 张证据图 · 44 项手机断言通过", fill=muted, font=small)
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
