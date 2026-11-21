from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

base = Path(r"E:/QPTapp/mobile/shots/membership")
items = [
    ("01-invite-code.png", "01 邀请码"),
    ("02-join-form.png", "02 入团资料，不再要密码"),
    ("03-pending.png", "03 待社长审批"),
    ("04-approved.png", "04 审批通过页"),
    ("05-home-after-approval.png", "05 进团后保留昵称"),
    ("06-second-pending.png", "06 第二条申请待审批"),
    ("07-rejected.png", "07 拒绝页与社长留言"),
    ("08-reapply-form.png", "08 预填资料重新申请"),
    ("09-pending-again.png", "09 重提后待审批"),
]
target_w = 320
gap = 16
margin = 28
label_h = 30
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
draw.text((margin, 26), "青跑团 · 入团申请与成员审批", fill=brand, font=title_font)
draw.text((margin, 66), "手机端 390×844 视口 · 9 张证据图 · 58 项跨端断言通过", fill=muted, font=small)
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
