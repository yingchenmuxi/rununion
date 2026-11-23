from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

base = Path(r"E:/QPTapp/admin/shots/runs-challenges")
items = [
    ("01-records-list.png", "01 记录与导出 25 条 / 172.4 km"),
    ("02-records-filter.png", "02 按成员筛选 林小满 7 条"),
    ("03-challenges.png", "03 挑战列表 3 个"),
    ("04-challenge-created.png", "04 新建挑战并通知成员"),
    ("05-challenge-ended.png", "05 结束后进度只读"),
]
target_w = 620
gap = 20
margin = 32
label_h = 34
cols = 2
bg = (243, 240, 232)
brand = (23, 38, 33)
muted = (91, 107, 100)
font = ImageFont.truetype(r"C:/Windows/Fonts/msyh.ttc", 20)
small = ImageFont.truetype(r"C:/Windows/Fonts/msyh.ttc", 15)
title_font = ImageFont.truetype(r"C:/Windows/Fonts/msyh.ttc", 30)

loaded = []
for name, label in items:
    im = Image.open(base / name).convert("RGB")
    h = round(im.height * target_w / im.width)
    im = im.resize((target_w, h), Image.LANCZOS)
    loaded.append((im, label))

rows = (len(loaded) + cols - 1) // cols
img_h = max(im.height for im, _ in loaded)
width = margin * 2 + target_w * cols + gap * (cols - 1)
top = 100
height = top + rows * (label_h + img_h + 16) + 36
canvas = Image.new("RGB", (width, height), bg)
draw = ImageDraw.Draw(canvas)
draw.text((margin, 26), "社团后台 · 开跑记录与挑战", fill=brand, font=title_font)
draw.text((margin, 68), "桌面 1440×1000 · 5 张证据图 · 39 项后台断言通过", fill=muted, font=small)
for i, (im, label) in enumerate(loaded):
    row, col = divmod(i, cols)
    x = margin + col * (target_w + gap)
    y = top + row * (label_h + img_h + 16)
    draw.text((x, y), label, fill=brand, font=font)
    canvas.paste(im, (x, y + label_h))
out = base / "contact-sheet.png"
canvas.save(out, "PNG", optimize=True)
print(out)
print(canvas.size)
