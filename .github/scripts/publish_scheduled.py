#!/usr/bin/env python3
"""
Scheduled post publisher for Emmerican Adventure.

Scans blog.html for post-scheduled cards whose data-publish-date
has arrived, then for each one:
  1. Flips the blog.html card from "Coming Soon" to a live card
  2. Removes data-scheduled="true" from the post HTML file
  3. Updates the homepage featured post (index.html)
  4. Inserts photos into the homepage photo grid (6 most recent)
  5. Inserts photos into photos.html
  6. Inserts into sitemap.xml
  7. Inserts into feed.xml (RSS)
  8. Inserts into search.html
"""

import re
import sys
import os
from datetime import date, datetime, timezone, timedelta
from html import unescape
from urllib.parse import quote_plus

JST = timezone(timedelta(hours=9))
TODAY = datetime.now(JST).date()
print(f"Running scheduled publisher for {TODAY} (JST)")

# ── Load files ──────────────────────────────────────────────────────
def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()

def write(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def strip_tags(html):
    return re.sub(r'<[^>]+>', '', html)

def esc(s):
    return (s.replace('&', '&amp;').replace('<', '&lt;')
             .replace('>', '&gt;').replace('"', '&quot;'))

# ── Find due scheduled cards in blog.html ───────────────────────────
blog = read('blog.html')

scheduled_pattern = re.compile(
    r'<article class="post-index-card post-scheduled" data-publish-date="(\d{4}-\d{2}-\d{2})"[^>]*>(.*?)</article>',
    re.S
)

published_any = False

for match in scheduled_pattern.finditer(blog):
    publish_date_str = match.group(1)
    card_html        = match.group(0)
    publish_date     = date.fromisoformat(publish_date_str)

    if publish_date > TODAY:
        print(f"  Skipping {publish_date_str} — not yet due")
        continue

    print(f"  Publishing post scheduled for {publish_date_str}")

    # ── Extract metadata from the scheduled card ────────────────────
    title_m   = re.search(r'<h2[^>]*>(.*?)</h2>', card_html, re.S)
    img_m     = re.search(r'<img src="([^"]+)"', card_html)
    slug_m    = re.search(r'data-slug="([^"]+)"', match.group(0))

    title     = unescape(strip_tags(title_m.group(1))) if title_m else ''
    thumb_src = img_m.group(1) if img_m else ''
    slug      = slug_m.group(1) if slug_m else ''
    slug_file = slug + '.html' if slug else ''

    if not slug:
        print(f"  ERROR: could not determine slug from card, skipping")
        continue

    post_path = f'posts/{slug_file}'
    if not os.path.exists(post_path):
        print(f"  ERROR: post file {post_path} not found, skipping")
        continue

    # ── Read the post file for full metadata ────────────────────────
    post = read(post_path)

    post_num_m  = re.search(r'<span class="post-tag">(Post #\d+)</span>', post)
    excerpt_m   = re.search(r'<p class="post-index-excerpt[^"]*">([^<]+)</p>', card_html)
    og_img_m    = re.search(r'<meta property="og:image" content="([^"]+)"', post)

    post_num    = post_num_m.group(1) if post_num_m else ''
    fmt_date    = publish_date.strftime('%B %-d, %Y')
    og_image    = og_img_m.group(1) if og_img_m else (
                    thumb_src if thumb_src.startswith('http') else
                    f'https://emmericanadventure.com/{thumb_src}' if thumb_src else '')

    # Build excerpt from post body if not in card
    if excerpt_m and 'Going live on' not in excerpt_m.group(1):
        excerpt = excerpt_m.group(1).strip()
    else:
        body_m = re.search(r'<div class="post-body">(.*?)</div>', post, re.S)
        body_text = strip_tags(body_m.group(1)).strip() if body_m else ''
        body_text = re.sub(r'\s+', ' ', body_text)
        excerpt = body_text[:140].rsplit(' ', 1)[0] + '…' if len(body_text) > 140 else body_text

    # Collect photos from the post
    photo_imgs = re.findall(r'<img src="\.\./([^"]+)"', post)

    print(f"  Title:   {title}")
    print(f"  Slug:    {slug}")
    print(f"  PostNum: {post_num}")
    print(f"  Photos:  {len(photo_imgs)}")
    print(f"  Thumb:   {thumb_src}")

    # ── 1. Remove data-scheduled from post file ─────────────────────
    post_new = post.replace(
        '<article class="post-entry post-full" data-scheduled="true">',
        '<article class="post-entry post-full">'
    )
    write(post_path, post_new)
    print(f"  ✓ Post file updated")

    # ── 2. Flip blog.html card to live ──────────────────────────────
    thumb_html = (f'<img src="{esc(thumb_src)}" alt="{esc(title)}" />'
                  if thumb_src else
                  '<div class="img-placeholder"><span class="placeholder-kanji">記</span></div>')

    live_card = f'''<article class="post-index-card">
      <a href="posts/{slug_file}" class="post-index-link">
        <div class="post-index-img">
          {thumb_html}
        </div>
        <div class="post-index-body">
          <div class="post-meta">
            <span class="post-tag">{esc(post_num)}</span>
            <time class="post-date">{fmt_date}</time>
          </div>
          <h2 class="post-index-title">{esc(title)}</h2>
          <p class="post-index-excerpt">{esc(excerpt)}</p>
          <span class="read-more small">Read Post <span>→</span></span>
        </div>
      </a>
    </article>'''

    blog = blog.replace(card_html, live_card)

    # Re-sort all live cards by post number (descending) so publishing
    # out-of-order or multiple posts on the same day never leaves the
    # journal listing jumbled. Scheduled cards stay at the top as-is.
    all_scheduled = re.findall(r'    <article class="post-index-card post-scheduled".*?</article>\n', blog, re.S)
    all_live      = re.findall(r'    <article class="post-index-card">.*?</article>\n', blog, re.S)

    def card_num(card):
        m = re.search(r'Post #(\d+)', card)
        return int(m.group(1)) if m else 0

    all_live_sorted = sorted(all_live, key=card_num, reverse=True)

    # Find the block containing all cards and replace it
    first_card_start = re.search(r'    <article class="post-index-card', blog)
    last_card_end    = blog.rfind('    </article>\n') + len('    </article>\n')
    if first_card_start:
        before = blog[:first_card_start.start()]
        after  = blog[last_card_end:]
        blog   = before + ''.join(all_scheduled) + ''.join(all_live_sorted) + after

    write('blog.html', blog)
    print(f"  ✓ blog.html card flipped live (cards re-sorted)")

    # ── 3. Update homepage featured post ────────────────────────────
    idx = read('index.html')
    thumb_for_featured = (f'<img src="{esc(thumb_src)}" alt="{esc(title)}" />'
                          if thumb_src else
                          '<div class="img-placeholder"><span class="placeholder-kanji">記</span></div>')

    # Find and replace the featured-post section
    featured_new = f'''    <section class="featured-post" id="journal">
      <a href="posts/{slug_file}" class="section-tag section-tag-link">Latest Post →</a>
      <article class="featured-card">
        <div class="featured-card-img">
          {thumb_for_featured}
        </div>
        <div class="featured-card-body">
          <div class="post-meta">
            <span class="post-tag">{esc(post_num)}</span>
            <span class="post-date">{fmt_date}</span>
          </div>
          <h2 class="featured-title"><a href="posts/{slug_file}" style="text-decoration:none;color:inherit;">{esc(title)}</a></h2>
          <p class="featured-excerpt">{esc(excerpt)}</p>
          <a href="posts/{slug_file}" class="read-more">Read More <span>→</span></a>
        </div>
      </article>
    </section>'''

    idx = re.sub(
        r'    <section class="featured-post"[^>]*>.*?</section>',
        featured_new, idx, count=1, flags=re.S
    )

    # ── 4. Update homepage photo grid (6 most recent) ───────────────
    if photo_imgs:
        photo_marker = '<!-- ====== NEW PHOTOS INSERTED ABOVE THIS LINE ====== -->'
        grid_open    = '<div class="photo-grid">'
        if photo_marker in idx:
            # Extract existing photo paths from current grid
            grid_start  = idx.find(grid_open)
            marker_pos  = idx.find(photo_marker)
            grid_section = idx[grid_start:marker_pos]
            existing_paths = re.findall(r'<img src="([^"]+)"', grid_section)

            # Prepend new, dedup, keep 6
            seen = set()
            final_paths = []
            for p in list(photo_imgs) + existing_paths:
                if p not in seen:
                    seen.add(p)
                    final_paths.append(p)
            final_paths = final_paths[:6]

            # Rebuild grid
            grid_items = '\n'.join(
                f'        <div class="photo-item" data-caption="{esc(title)}">\n'
                f'          <img src="{esc(p)}" alt="{esc(title)}" />\n'
                f'        </div>'
                for p in final_paths
            )
            new_grid = f'{grid_open}\n{grid_items}\n        {photo_marker}'
            idx = idx[:grid_start] + new_grid + idx[marker_pos + len(photo_marker):]

    write('index.html', idx)
    print(f"  ✓ index.html updated")

    # ── 5. Update photos.html ────────────────────────────────────────
    if photo_imgs:
        photos_html = read('photos.html')
        photos_marker = '        <!-- ====== NEW PHOTOS INSERTED ABOVE THIS LINE ====== --></div>'
        new_photo_items = '\n'.join(
            f'        <div class="photo-item" data-caption="{esc(title)}">\n'
            f'          <img src="{esc(img)}" alt="{esc(title)}" />\n'
            f'        </div>'
            for img in photo_imgs
        )
        if photos_marker in photos_html:
            photos_html = photos_html.replace(
                photos_marker,
                new_photo_items + '\n' + photos_marker
            )
            write('photos.html', photos_html)
            print(f"  ✓ photos.html updated ({len(photo_imgs)} photos)")

    # ── 6. Update sitemap.xml ────────────────────────────────────────
    sitemap = read('sitemap.xml')
    post_url = f'https://emmericanadventure.com/posts/{slug_file}'
    if post_url not in sitemap:
        sitemap = sitemap.replace('</urlset>', f'''
  <url>
    <loc>{post_url}</loc>
    <lastmod>{publish_date_str}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>''')
        write('sitemap.xml', sitemap)
        print(f"  ✓ sitemap.xml updated")

    # ── 7. Update feed.xml (RSS) ─────────────────────────────────────
    feed = read('feed.xml')
    if post_url not in feed:
        pub_date = datetime.combine(publish_date, datetime.min.time()).strftime('%a, %d %b %Y 00:00:00 +0900')
        enclosure = (f'\n      <enclosure url="{og_image}" type="image/jpeg" length="204800" />'
                     if og_image else '')
        new_item = f'''    <item>
      <title>{esc(title)}</title>
      <link>{post_url}</link>
      <guid isPermaLink="true">{post_url}</guid>
      <pubDate>{pub_date}</pubDate>
      <description>{esc(excerpt)}</description>{enclosure}
    </item>'''
        insert_at = feed.find('    <item>')
        if insert_at != -1:
            feed = feed[:insert_at] + new_item + '\n' + feed[insert_at:]
        else:
            feed = feed.replace('  </channel>', new_item + '\n  </channel>')
        write('feed.xml', feed)
        print(f"  ✓ feed.xml updated")

    # ── 8. Update search.html ────────────────────────────────────────
    search = read('search.html')
    if f"slug: '{slug}'" not in search:
        thumb_path = thumb_src if thumb_src else (og_image.replace('https://emmericanadventure.com/', '') if og_image else '')
        new_entry = f"""      {{
        slug: '{slug}',
        title: '{title.replace("'", "\\'")}',
        excerpt: '{excerpt.replace("'", "\\'")}',
        date: '{fmt_date}',
        tag: 'Journal',
        img: '{thumb_path}',
        keywords: '{title.replace("'", "\\'")}',
      }},
    ];"""
        search = search.replace('];', new_entry, 1)
        write('search.html', search)
        print(f"  ✓ search.html updated")

    # ── 9. Update homepage video grid + videos.html ──────────────────
    yt_vids = re.findall(r'src="https://www\.youtube\.com/embed/([a-zA-Z0-9_-]{11})"', post)
    if yt_vids:
        vid_id = yt_vids[0]

        # Homepage video grid — clean rebuild, keep 6 most recent
        idx = read('index.html')
        vid_marker   = '<!-- ====== NEW VIDEO INSERTED ABOVE THIS LINE ====== -->'
        grid_open    = '<div class="videos-grid">'
        if vid_marker in idx and vid_id not in idx:
            grid_start = idx.find(grid_open)
            marker_pos = idx.find(vid_marker)
            grid_section = idx[grid_start:marker_pos]

            # Parse existing video IDs in order
            existing_ids = re.findall(
                r'src="https://www\.youtube\.com/embed/([a-zA-Z0-9_-]{11})"', grid_section
            )
            existing_titles = re.findall(r'<h3 class="video-title">([^<]+)</h3>', grid_section)
            existing_descs  = re.findall(r'<p class="video-desc">([^<]+)</p>', grid_section)

            # Prepend new, dedup, keep 6
            seen = set()
            cards_data = [{'id': vid_id, 'card_title': esc(title), 'desc': esc(excerpt[:80])}]
            for i, vid in enumerate(existing_ids):
                if vid not in seen:
                    seen.add(vid)
                    cards_data.append({
                        'id': vid,
                        'card_title': existing_titles[i] if i < len(existing_titles) else esc(title),
                        'desc': existing_descs[i] if i < len(existing_descs) else '',
                    })
            seen.add(vid_id)
            cards_data = [c for c in cards_data if c['id'] not in seen or c['id'] == vid_id][:6]

            # Rebuild
            cards_html = '\n'.join(f"""        <div class="video-card">
          <div class="video-embed-wrap">
            <iframe src="https://www.youtube.com/embed/{c['id']}"
              title="{c['card_title']}" frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen></iframe>
          </div>
          <div class="video-card-body">
            <span class="post-tag">Vlog</span>
            <h3 class="video-title">{c['card_title']}</h3>
            <p class="video-desc">{c['desc']}</p>
          </div>
        </div>""" for c in cards_data)

            new_grid = f'{grid_open}\n        {vid_marker}\n{cards_html}\n        '
            idx = idx[:grid_start] + new_grid + idx[marker_pos + len(vid_marker):]
            write('index.html', idx)
            print(f"  ✓ index.html video grid updated")

        # videos.html archive — just prepend if not already present
        vids_html = read('videos.html')
        vids_marker = '      <!-- ====== NEW VIDEO INSERTED ABOVE THIS LINE ====== -->'
        if vids_marker in vids_html and vid_id not in vids_html:
            new_vid_card = f"""{vids_marker}
        <div class="video-card">
          <div class="video-embed-wrap">
            <iframe src="https://www.youtube.com/embed/{vid_id}?rel=0&modestbranding=1"
              title="{esc(title)}" frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen loading="lazy"></iframe>
          </div>
          <div class="video-card-body">
            <time class="video-date">{fmt_date}</time>
            <h2 class="video-card-title">{esc(title)}</h2>
            <p class="video-card-desc">{esc(excerpt[:100])}</p>
          </div>
        </div>"""
            vids_html = vids_html.replace(vids_marker, new_vid_card, 1)
            write('videos.html', vids_html)
            print(f"  ✓ videos.html updated")

    published_any = True
    print(f"  ✅ Done: {title}")

if not published_any:
    print("No posts due for publishing today.")

sys.exit(0)
