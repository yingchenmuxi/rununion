from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

base = Path(r"E:/QPTapp/mobile/shots/messages-growth-charity")
items = [
    ("01-home-bell.png", "01 首页铃铛未读 2"),
    ("02-messages-all.png", "02 消息中心 3 条"),
    ("03-messages-unread.png", "03 未读筛选 2 条"),
    ("04-activity-from-message.png", "04 消息跳活动详情"),
    ("05-message-read.png", "05 读完 1 条剩 1 未读"),
    ("06-all-read.png", "06 全部已读"),
    ("07-profile-reset.png", "07 重置演示数据结果"),
    ("08-growth-activity.png", "08 成长·活动参与"),
    ("09-charity-top.png", "09 公益透明账本"),
    ("10-charity-rules.png", "10 账本规则与声明"),
    ("11-change-message.png", "11 后台改期变更消息"),
    ("12-change-detail.png", "12 变更后详情 07:30"),
]
target_w = 300
gap = 16
margin = 28
label_h = 30
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
top = 96
height = top + rows * (label_h + img_h + 14) + 34
canvas = Image.new("RGB", (width, height), bg)
draw = ImageDraw.Draw(canvas)
draw.text((margin, 26), "青跑团 · 活动消息、成长与公益账本", fill=brand, font=title_font)
draw.text((margin, 66), "手机端 390×844 视口 · 12 张证据图 · 53 项断言通过", fill=muted, font=small)
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
