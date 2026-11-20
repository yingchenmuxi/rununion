from PIL import Image, ImageDraw, ImageFont
import glob, os

out = r'E:/QPTapp/admin/shots/checkin'
files = sorted(f for f in glob.glob(out + '/*.png') if 'contact-sheet' not in f)
font_path = r'C:/Windows/Fonts/msyh.ttc'
title_font = ImageFont.truetype(font_path, 30)
sub_font = ImageFont.truetype(font_path, 16)
label_font = ImageFont.truetype(font_path, 15)

cols, tw, th, gap = 3, 480, 334, 24
rows = (len(files) + cols - 1) // cols
head = 84
sheet = Image.new('RGB', (cols * tw, head + rows * (th + gap)), '#f3f0e8')
d = ImageDraw.Draw(sheet)
d.text((24, 18), '社团后台 · 赛后签到与出勤', fill='#172621', font=title_font)
d.text((24, 54), '12 张证据图 · 1440×1000 · 32 项断言全部通过', fill='#5b6b64', font=sub_font)

for i, f in enumerate(files):
    im = Image.open(f).convert('RGB')
    im.thumbnail((tw, th))
    x = (i % cols) * tw
    y = head + (i // cols) * (th + gap)
    sheet.paste(im, (x, y + 24))
    label = os.path.basename(f).replace('.png', '')
    d.text((x + 8, y + 4), label, fill='#172621', font=label_font)

sheet.save(out + '/contact-sheet.png')
print(len(files), sheet.size)
