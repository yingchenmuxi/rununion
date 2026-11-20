from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

base = Path(r"E:/QPTapp/mobile/shots/activities-shared")
items = [
    ("01-home.png", "01 首页共享报名"),
    ("02-list-all.png", "02 全部活动"),
    ("03-list-open-empty.png", "03 可报名空态"),
    ("04-list-mine.png", "04 已报名筛选"),
    ("05-detail-signup.png", "05 已报名详情"),
    ("06-detail-signup-section.png", "06 取消报名入口"),
    ("07-profile-demo.png", "07 重置入口"),
    ("08-my-initial.png", "08 我的活动初始"),
    ("09-my-absent.png", "09 后台标未到"),
    ("10-detail-absent.png", "10 未到详情"),
    ("11-my-awaiting.png", "11 撤销后待核对"),
    ("12-detail-awaiting.png", "12 待核对详情"),
    ("13-detail-cancelled.png", "13 手机取消报名"),
    ("14-list-after-cancel.png", "14 可报名释放"),
    ("15-profile-reset-result.png", "15 重置结果"),
    ("16-my-after-reset.png", "16 我的活动恢复"),
    ("17-home-after-reset.png", "17 首页恢复"),
]
target_w = 300
gap = 16
margin = 28
label_h = 28
cols = 4
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
top = 92
height = top + rows * (label_h + img_h + 14) + 34
canvas = Image.new("RGB", (width, height), bg)
draw = ImageDraw.Draw(canvas)

draw.text((margin, 26), "青跑团 · 活动出勤跨端闭环", fill=brand, font=title_font)
draw.text((margin, 64), "手机端 390×844 视口 · 17 张证据图 · 64 项断言通过", fill=muted, font=small)

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
