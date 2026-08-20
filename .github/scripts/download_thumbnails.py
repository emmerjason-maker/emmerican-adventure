#!/usr/bin/env python3
"""One-off script to download YouTube thumbnails for video-only posts and save to images/."""
import re, os, urllib.request

posts_dir = 'posts'
headers = {'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)'}
downloaded = []

for fn in os.listdir(posts_dir):
    if not fn.endswith('.html'): continue
    with open(f'{posts_dir}/{fn}', encoding='utf-8') as f:
        post = f.read()
    
    photos = re.findall(r'<img src="\.\./([^"]+)"', post)
    if photos: continue  # has photos, skip
    
    vids = re.findall(r'youtube\.com/embed/([a-zA-Z0-9_-]{11})', post)
    if not vids: continue
    
    vid_id = vids[0]
    local = f'images/thumb-{vid_id}.jpg'
    if os.path.exists(local):
        print(f'  Exists: {local}')
        continue
    
    for quality in ['maxresdefault', 'hqdefault']:
        try:
            url = f'https://img.youtube.com/vi/{vid_id}/{quality}.jpg'
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as r:
                data = r.read()
            if len(data) > 5000:
                with open(local, 'wb') as f:
                    f.write(data)
                print(f'✓ {fn[:40]} → {local} ({len(data)//1024}KB)')
                downloaded.append(local)
                break
        except Exception as e:
            print(f'  {quality} failed: {e}')

print(f'\nDownloaded {len(downloaded)} thumbnails')
