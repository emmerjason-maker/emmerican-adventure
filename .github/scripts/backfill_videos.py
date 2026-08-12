#!/usr/bin/env python3
"""
Scans all published post files for YouTube embeds and ensures:
1. The video is in the homepage grid (most recent 6)
2. The video is in videos.html archive

Run manually after any publish that might have missed video grid updates:
  python3 .github/scripts/backfill_videos.py
"""
import re, os
from datetime import datetime

def read(p):
    with open(p, encoding='utf-8') as f: return f.read()
def write(p, c):
    with open(p, 'w', encoding='utf-8') as f: f.write(c)
def esc(s):
    return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;')

# Collect all videos from published posts, ordered by post date descending
post_videos = []
blog = read('blog.html')
live_slugs = re.findall(r'href="posts/([^"]+\.html)"', blog)

for slug in live_slugs:
    path = f'posts/{slug}'
    if not os.path.exists(path): continue
    post = read(path)
    vids = re.findall(r'youtube\.com/embed/([a-zA-Z0-9_-]{11})', post)
    if not vids: continue
    title_m = re.search(r'<h1 class="post-entry-title">([^<]+)', post)
    date_m  = re.search(r'<time class="post-date">([^<]+)', post)
    title = title_m.group(1) if title_m else slug
    date  = date_m.group(1)  if date_m  else ''
    post_videos.append({'id': vids[0], 'title': title, 'date': date, 'slug': slug})

print(f"Found {len(post_videos)} posts with videos")

# --- Homepage grid (6 most recent) ---
idx = read('index.html')
marker    = '        <!-- ====== NEW VIDEO INSERTED ABOVE THIS LINE ====== -->'
grid_open = '<div class="videos-grid">'
gs = idx.find(grid_open)
cs = idx.find('</div>\n      <div style="text-align:center', gs)

top6 = post_videos[:6]
cards_html = '\n'.join(f'''        <div class="video-card">
          <div class="video-embed-wrap">
            <iframe src="https://www.youtube.com/embed/{v['id']}" title="{esc(v['title'])}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
          </div>
          <div class="video-card-body">
            <span class="post-tag">Vlog</span>
            <h3 class="video-title">{esc(v['title'])}</h3>
            <p class="video-desc">{esc(v['date'])}</p>
          </div>
        </div>''' for v in top6)

idx_new = idx[:gs] + f'{grid_open}\n        {marker}\n{cards_html}\n      </div>' + idx[cs+6:]
write('index.html', idx_new)
print(f"✓ Homepage grid rebuilt ({len(top6)} videos)")

# --- videos.html archive (all, newest first) ---
vc = read('videos.html')
vm = '      <!-- ====== NEW VIDEO INSERTED ABOVE THIS LINE ====== -->'
added = 0
for v in post_videos:
    if v['id'] in vc: continue
    new_card = f'''{vm}
        <div class="video-card">
          <div class="video-embed-wrap">
            <iframe src="https://www.youtube.com/embed/{v['id']}?rel=0&modestbranding=1" title="{esc(v['title'])}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
          </div>
          <div class="video-card-body">
            <time class="video-date">{esc(v['date'])}</time>
            <h2 class="video-card-title">{esc(v['title'])}</h2>
            <p class="video-card-desc">{esc(v['date'])}</p>
          </div>
        </div>'''
    vc = vc.replace(vm, new_card, 1)
    added += 1
    print(f"  + Added to videos.html: {v['title'][:50]}")

write('videos.html', vc)
print(f"✓ videos.html updated ({added} added, {vc.count('class=\"video-card\"')} total)")
