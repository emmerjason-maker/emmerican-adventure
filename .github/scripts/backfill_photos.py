#!/usr/bin/env python3
"""
Scans all published post files for photos and ensures:
1. The homepage photo grid shows the 6 most recent
2. photos.html archive has every photo

Reads photo order from blog.html card order (newest first).
Run manually or automatically after any publish:
  python3 .github/scripts/backfill_photos.py
"""
import re, os

def read(p):
    with open(p, encoding='utf-8') as f: return f.read()
def write(p, c):
    with open(p, 'w', encoding='utf-8') as f: f.write(c)
def esc(s):
    return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;')

blog = read('blog.html')
live_slugs = re.findall(r'href="posts/([^"]+\.html)"', blog)

# Collect all photos from published posts, preserving newest-first order
all_photos = []  # list of (img_path, post_title)
for slug in live_slugs:
    path = f'posts/{slug}'
    if not os.path.exists(path): continue
    post = read(path)
    title_m = re.search(r'<h1 class="post-entry-title">([^<]+)', post)
    title = title_m.group(1) if title_m else slug

    # Get photos from gallery blocks
    imgs = re.findall(r'<img src="\.\./([^"]+)"', post)
    for img in imgs:
        all_photos.append((img, title))

print(f"Found {len(all_photos)} photos across {len(live_slugs)} posts")

# --- Homepage grid (6 most recent) ---
idx = read('index.html')
marker    = '        <!-- ====== NEW PHOTOS INSERTED ABOVE THIS LINE ====== -->'
grid_open = '<div class="photo-grid">'
gs = idx.find(grid_open)
mp = idx.find(marker)

top6 = all_photos[:6]
grid_items = '\n'.join(
    f'        <div class="photo-item" data-caption="{esc(title)}">\n'
    f'          <img src="{esc(img)}" alt="{esc(title)}" />\n'
    f'        </div>'
    for img, title in top6
)
new_grid = f'{grid_open}\n{grid_items}\n        {marker}'
idx_new = idx[:gs] + new_grid + idx[mp + len(marker):]
write('index.html', idx_new)
print(f"✓ Homepage grid rebuilt ({len(top6)} photos)")

# --- photos.html archive (all, newest first) ---
ph = read('photos.html')
ph_marker = '        <!-- ====== NEW PHOTOS INSERTED ABOVE THIS LINE ====== --></div>'
added = 0
for img, title in all_photos:
    if img in ph: continue
    new_item = (
        f'        <div class="photo-item" data-caption="{esc(title)}">\n'
        f'          <img src="{esc(img)}" alt="{esc(title)}" />\n'
        f'        </div>\n'
        f'        {ph_marker}'
    )
    ph = ph.replace(ph_marker, new_item, 1)
    added += 1

write('photos.html', ph)
total = ph.count('class="photo-item"')
print(f"✓ photos.html updated ({added} added, {total} total)")
