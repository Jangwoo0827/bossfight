"""Packs the game for itch.io (HTML5 upload). Run: python tools/make_itch_zip.py -> dist/bossrush-itch.zip"""
import os, zipfile

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out_dir = os.path.join(root, 'dist')
os.makedirs(out_dir, exist_ok=True)
out = os.path.join(out_dir, 'bossrush-itch.zip')
include = ['index.html', 'style.css', 'favicon.svg', 'og.png', 'js', 'sounds']
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for item in include:
        path = os.path.join(root, item)
        if os.path.isfile(path):
            z.write(path, item)
        else:
            for folder, _, files in os.walk(path):
                for f in files:
                    full = os.path.join(folder, f)
                    z.write(full, os.path.relpath(full, root).replace(os.sep, '/'))
print(out, os.path.getsize(out) // 1024, 'KB')
