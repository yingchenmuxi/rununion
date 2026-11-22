from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

base = Path(r"E:/QPTapp/mobile/shots/invites")
items = [
    ("01-generated-code.png", "01 输入后台生成的邀请码"),
    ("02-join-with-generated-code.png", "02 验证通过后填写资料"),
    ("03-pending-after-generated-code.png", "03 提交后进入待审批"),
    ("04-disabled-code-error.png", "04 已停用邀请码被拒绝"),
]
target_w = 320
gap = 18
margin = 30
label_h = 32
cols = 2
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
draw.text((margin, 26), "青跑团 · 邀请码接入入团", fill=brand, font=title_font)
draw.text((margin, 66), "手机端 390×844 视口 · 4 张证据图 · 44 项跨端断言通过", fill=muted, font=small)
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
