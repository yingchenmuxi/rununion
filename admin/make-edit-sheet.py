from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

base = Path(r"E:/QPTapp/admin/shots/edit-activity")
items = [
    ("01-before-edit.png", "01 编辑前 07:00"),
    ("02-edit-modal.png", "02 编辑弹窗预填"),
    ("03-saved-toast.png", "03 保存成功提示"),
    ("04-detail-changed.png", "04 详情改为 07:20"),
]
target_w = 620
gap = 20
margin = 32
label_h = 34
cols = 2
bg = (243, 240, 232)
brand = (23, 38, 33)
muted = (91, 107, 100)
font_path = r"C:/Windows/Fonts/msyh.ttc"
font = ImageFont.truetype(font_path, 20)
small = ImageFont.truetype(font_path, 15)
title_font = ImageFont.truetype(font_path, 30)

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
draw.text((margin, 26), "社团后台 · 编辑活动与变更通知", fill=brand, font=title_font)
draw.text((margin, 68), "桌面 1440×1000 · 4 张证据图 · 20 项断言通过", fill=muted, font=small)
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
