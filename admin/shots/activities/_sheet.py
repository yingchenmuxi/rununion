from PIL import Image, ImageDraw
import os, glob
files = sorted(glob.glob(r'E:/QPTapp/admin/shots/activities/*.png'))
files = [f for f in files if 'contact-sheet' not in f]
print(len(files))
for f in files:
    print(os.path.basename(f), Image.open(f).size)
cols, rows, tw, th = 3, 6, 480, 334
sheet = Image.new('RGB', (cols*tw, rows*(th+24)), '#f3f0e8')
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB')
    im.thumbnail((tw, th))
    x = (i % cols) * tw
    y = (i // cols) * (th+24)
    sheet.paste(im, (x, y+24))
    d.text((x+8, y+5), os.path.basename(f).replace('.png',''), fill='#172621')
sheet.save(r'E:/QPTapp/admin/shots/activities/contact-sheet.png')
print('sheet', sheet.size)
