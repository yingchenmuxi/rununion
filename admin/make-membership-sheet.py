from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

base = Path(r"E:/QPTapp/admin/shots/membership")
items = [
    ("01-member-pending.png", "01 后台看到待审批申请"),
    ("02-member-approved.png", "02 通过后状态与提示"),
    ("03-reject-dialog.png", "03 填写拒绝原因"),
    ("04-reapplied.png", "04 修改后重新待审批"),
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
draw.text((margin, 26), "社团后台 · 成员审批", fill=brand, font=title_font)
draw.text((margin, 68), "桌面 1440×1000 · 4 张证据图 · 58 项跨端断言通过", fill=muted, font=small)
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
