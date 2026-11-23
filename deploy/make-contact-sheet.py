from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
SHOTS = ROOT / "shots"
OUT = SHOTS / "contact-sheet.png"

BG = (247, 244, 236)
INK = (14, 90, 74)
MUTED = (100, 112, 104)
CARD = (255, 255, 255)

def font(size, bold=False):
    name = "msyhbd.ttc" if bold else "msyh.ttc"
    for base in (Path("C:/Windows/Fonts"), Path("/usr/share/fonts/truetype/noto")):
        path = base / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()

def fit(path, width):
    image = Image.open(path).convert("RGB")
    height = round(image.height * width / image.width)
    return image.resize((width, height), Image.LANCZOS)

mobile = [
    ("01-mobile-home.png", "手机首页 · 本周跑量 / 消息 / 本周活动"),
    ("02-mobile-club.png", "跑团主页 · 公告与近期活动"),
    ("03-mobile-growth.png", "成长 · 活动参与与挑战进度"),
    ("04-mobile-charity.png", "公益透明账本 · 物资去向"),
]
admin = [
    ("05-admin-login.png", "后台登录 · 独立 8081 入口"),
    ("06-admin-dashboard.png", "社团概览 · 共享 API 已连通"),
]

width = 1600
pad = 40
mobile_w = 350
mobile_gap = 22
admin_w = 740
admin_gap = 40

mobile_images = [(fit(SHOTS / name, mobile_w), caption) for name, caption in mobile]
admin_images = [(fit(SHOTS / name, admin_w), caption) for name, caption in admin]

mobile_row_h = max(image.height for image, _ in mobile_images) + 58
admin_row_h = max(image.height for image, _ in admin_images) + 58
height = 82 + mobile_row_h + 28 + admin_row_h + 36

canvas = Image.new("RGB", (width, height), BG)
draw = ImageDraw.Draw(canvas)
draw.text((pad, 24), "青跑团 · 服务器部署冒烟", font=font(38, True), fill=INK)
draw.text((pad, 70), "本地生产态预览 8080/8081 · PWA + 同源 /api · 19 项浏览器检查通过", font=font(18), fill=MUTED)

def row(images, y, gap, start_x):
    x = start_x
    for image, caption in images:
        canvas.paste(image, (x, y))
        draw.rounded_rectangle((x, y, x + image.width, y + image.height), radius=10, outline=(226, 220, 208), width=1)
        draw.text((x, y + image.height + 12), caption, font=font(16), fill=INK)
        x += image.width + gap
    return x

y = 112
row(mobile_images, y, mobile_gap, pad)
y += mobile_row_h + 18
row(admin_images, y, admin_gap, pad)

canvas.save(OUT, optimize=True)
print(OUT, canvas.size)
