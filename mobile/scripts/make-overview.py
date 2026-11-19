from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

base = Path(r"E:/QPTapp/mobile/shots")
items = [("home", "首页"), ("school", "跑团"), ("run", "开跑"), ("growth", "成长"), ("profile", "我的")]
target_w = 260
gap = 18
margin = 28
label_h = 36
bg = (247, 244, 236)
brand = (14, 90, 74)

font_path = r"C:/Windows/Fonts/msyh.ttc"
font = ImageFont.truetype(font_path, 20)
small = ImageFont.truetype(font_path, 14)

loaded = []
for name, label in items:
    im = Image.open(base / (name + ".png")).convert("RGB")
    h = round(im.height * target_w / im.width)
    im = im.resize((target_w, h), Image.LANCZOS)
    loaded.append((im, label))

img_h = max(im.height for im, _ in loaded)
width = margin * 2 + target_w * len(loaded) + gap * (len(loaded) - 1)
height = margin * 2 + label_h + img_h + 26
canvas = Image.new("RGB", (width, height), bg)
draw = ImageDraw.Draw(canvas)

for i, (im, label) in enumerate(loaded):
    x = margin + i * (target_w + gap)
    draw.text((x + target_w / 2, margin), label, fill=brand, font=font, anchor="ma")
    canvas.paste(im, (x, margin + label_h))

draw.text((margin, height - 20), "青跑团 · 五页可点击原型 · 示例数据", fill=(110, 110, 105), font=small)
out = base / "overview.png"
canvas.save(out, "PNG", optimize=True)
print(out)
print(canvas.size)
