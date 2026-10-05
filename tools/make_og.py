"""Builds og.png (1200x630 link preview image). Run: python tools/make_og.py"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, random

W, H = 1200, 630
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
img = Image.new('RGB', (W, H), '#07050c')
d = ImageDraw.Draw(img)
# vertical gradient
for y in range(H):
    t = y / H
    d.line([(0, y), (W, y)], fill=(int(24 - 14 * t), int(10 - 6 * t), int(36 - 26 * t)))
# arena tiles
random.seed(7)
for ty in range(140, 560, 60):
    for tx in range(80, 1120, 60):
        c = random.randint(26, 36)
        d.rectangle([tx, ty, tx + 56, ty + 56], fill=(c, c - 4, c + 8))
# glow blobs
glow = Image.new('RGB', (W, H), (0, 0, 0))
g = ImageDraw.Draw(glow)
g.ellipse([760, 170, 1080, 490], fill=(170, 20, 60))
g.ellipse([200, 360, 330, 490], fill=(20, 120, 150))
glow = glow.filter(ImageFilter.GaussianBlur(70))
img = Image.blend(img, Image.composite(glow, img, glow.convert('L')), 0.8)
d = ImageDraw.Draw(img)
# boss + player silhouettes
d.ellipse([850, 260, 990, 400], fill=(30, 6, 18), outline=(255, 61, 127), width=6)
d.ellipse([893, 303, 947, 357], fill=(246, 230, 236))
d.ellipse([908, 318, 932, 342], fill=(255, 61, 127))
d.ellipse([250, 410, 280, 440], fill=(20, 48, 58), outline=(94, 231, 255), width=4)
# telegraph cone
d.pieslice([700, 150, 1140, 590], 150, 210, outline=(255, 52, 72), width=4)

def font(names, size):
    for n in names:
        p = os.path.join('C:/Windows/Fonts', n)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

title = font(['georgiab.ttf', 'georgia.ttf', 'arialbd.ttf'], 120)
sub = font(['malgunbd.ttf', 'malgun.ttf', 'arial.ttf'], 34)
small = font(['malgun.ttf', 'arial.ttf'], 26)
d.text((80, 150), 'BOSS RUSH', font=title, fill=(255, 255, 255))
d.text((84, 300), '12종의 보스 · 3명의 캐릭터 · 매일 새로운 도전', font=sub, fill=(255, 140, 160))
d.text((84, 356), '패턴을 읽고, 빌드를 쌓고, 다시 도전하라.', font=small, fill=(210, 200, 230))
d.text((84, 540), 'jangwoo0827.github.io/bossfight', font=small, fill=(150, 140, 175))
img.save(os.path.join(root, 'og.png'), optimize=True)
print('og.png written')
