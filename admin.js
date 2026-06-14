/* ═══════════════════════════════════════════════════════════════
   Japan Move — Admin Panel JS
   Multi-image support, rich text editor, YouTube, GitHub publish
   ═══════════════════════════════════════════════════════════════ */

// ── Config ────────────────────────────────────────────────────────
// Password stored as SHA-256 hash — plain text never in source
const CONFIG = {
  passwordHash: 'b181ca2307e6900f3d218dcabd221d64d0296cffbac6fa70a89815e67a3a49b1',  // SHA-256 of password
  owner:     'emmerjason-maker',
  repo:      'emmerican-adventure',
  branch:    'main',
  blogFile:  'blog.html',
  maxImages: 10,
  maxSizeMB: 25,
};

// ── State ─────────────────────────────────────────────────────────
// images = array of { id, file, dataUrl, name, caption }
let images      = [];
let ytVideos    = [];
let githubToken = null;

const $ = id => document.getElementById(id);

// ── Startup ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();

  if ($('postDate')) {
    $('postDate').value = new Date().toISOString().split('T')[0];
  }

  const saved = localStorage.getItem('jm_gh_token');
  if (saved && $('loginToken')) $('loginToken').value = saved;

  if (sessionStorage.getItem('jm_authed') === '1') {
    githubToken = localStorage.getItem('jm_gh_token') || '';
    showAdmin();
  }
});

// ── Events ────────────────────────────────────────────────────────
function bindEvents() {
  // Login
  const loginBtn = $('loginBtn');
  if (loginBtn) loginBtn.addEventListener('click', handleLogin);

['loginPassword', 'loginToken'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  });

  // Logout
  const logoutBtn = $('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('jm_authed');
    location.reload();
  });

  // Toolbar
  document.querySelectorAll('.toolbar-btn').forEach(btn =>
    btn.addEventListener('click', () => handleToolbar(btn.dataset.action))
  );

  // Primary photo input (drop zone)
  if ($('photoInput')) $('photoInput').addEventListener('change', e => addFiles(e.target.files));
  if ($('photoInputMore')) $('photoInputMore').addEventListener('change', e => addFiles(e.target.files));

  // Drag & drop on zone
  const zone = $('uploadZone');
  if (zone) {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      addFiles(e.dataTransfer.files);
    });
  }

  if ($('previewBtn')) $('previewBtn').addEventListener('click', renderPreview);
  if ($('publishBtn')) $('publishBtn').addEventListener('click', handlePublish);
  if ($('ytAddBtn')) $('ytAddBtn').addEventListener('click', addYtVideo);
  if ($('editYtAddBtn')) $('editYtAddBtn').addEventListener('click', addEditYtVideo);
  if ($('editPhotoInput')) $('editPhotoInput').addEventListener('change', handleEditPhotoAdd);
  if ($('editYtAddBtn')) $('editYtAddBtn').addEventListener('click', addEditYtVideo);
  if ($('editPhotoInput')) $('editPhotoInput').addEventListener('change', handleEditPhotoAdd);
}

// ── Login ─────────────────────────────────────────────────────────
async function handleLogin() {
  if (!window.crypto || !crypto.subtle) {
    alert('Security Error: Password hashing requires a secure context (HTTPS or localhost). If you are testing locally, ensure you are using http://localhost.');
    return;
  }

  const pw    = $('loginPassword').value.trim();
  const token = $('loginToken').value.trim();

  // Hash the entered password and compare
  const pwBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  const pwHash = Array.from(new Uint8Array(pwBuffer)).map(b => b.toString(16).padStart(2,'0')).join('');
  if (pwHash !== CONFIG.passwordHash) {
    $('loginError').textContent = 'Incorrect password.';
    return;
  }
  if (!token || (!token.startsWith('ghp_') && !token.startsWith('github_pat_'))) {
    $('loginError').textContent = 'Please enter a valid GitHub token (starts with ghp_ or github_pat_).';
    return;
  }

  githubToken = token;
  localStorage.setItem('jm_gh_token', token);
  sessionStorage.setItem('jm_authed', '1');
  showAdmin();
}

function showAdmin() {
  $('loginScreen').classList.add('hidden');
  $('adminPanel').classList.remove('hidden');
}

// ── Toolbar ───────────────────────────────────────────────────────
function handleToolbar(action) {
  $('postBody').focus();
  if (action === 'bold')   { document.execCommand('bold');            return; }
  if (action === 'italic') { document.execCommand('italic');          return; }
  if (action === 'h3')     { document.execCommand('formatBlock', false, 'h3'); return; }
  if (action === 'para')   { document.execCommand('insertParagraph'); return; }
  if (action === 'link') {
    const sel  = window.getSelection();
    const text = sel && sel.toString().trim();
    const url  = prompt('Enter URL:', 'https://');
    if (!url) return;
    if (text) {
      document.execCommand('createLink', false, url);
    } else {
      const label = prompt('Link text:', url);
      document.execCommand('insertHTML', false,
        `<a href="${escHtml(url)}" target="_blank">${escHtml(label || url)}</a>`);
    }
  }
}

// ── Multi-image handling ──────────────────────────────────────────
function addFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  const remaining = CONFIG.maxImages - images.length;

  if (remaining <= 0) {
    alert(`Maximum ${CONFIG.maxImages} images per post.`);
    return;
  }

  const toAdd = files.slice(0, remaining);
  if (files.length > remaining) {
    alert(`Only ${remaining} more image(s) can be added (max ${CONFIG.maxImages}). Adding first ${remaining}.`);
  }

  toAdd.forEach(file => {
    if (file.size > CONFIG.maxSizeMB * 1024 * 1024) {
      alert(`"${file.name}" is over ${CONFIG.maxSizeMB}MB (original size) and was skipped.`);
      return;
    }
    const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const reader = new FileReader();
    reader.onload = ev => {
      images.push({ id, file, dataUrl: ev.target.result, name: file.name, caption: '' });
      renderImageList();
    };
    reader.readAsDataURL(file);
  });

  // Reset file inputs so same file can be re-added if needed
  $('photoInput').value = '';
  $('photoInputMore').value = '';
}

function removeImage(id) {
  images = images.filter(img => img.id !== id);
  renderImageList();
}

function moveImage(id, dir) {
  const idx = images.findIndex(img => img.id === id);
  if (idx < 0) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= images.length) return;
  [images[idx], images[newIdx]] = [images[newIdx], images[idx]];
  renderImageList();
}

function updateCaption(id, value) {
  const img = images.find(i => i.id === id);
  if (img) img.caption = value;
}

function renderImageList() {
  const list = $('imageList');
  const addMore = $('addMoreWrap');

  if (images.length === 0) {
    list.innerHTML = '';
    addMore.classList.add('hidden');
    return;
  }

  addMore.classList.remove('hidden');

  list.innerHTML = images.map((img, idx) => `
    <div class="image-item" data-id="${img.id}">
      <img class="image-thumb" src="${img.dataUrl}" alt="${escHtml(img.name)}" />
      <div class="image-item-body">
        <span class="image-name">${escHtml(img.name)}</span>
        <input
          type="text"
          class="image-caption-input"
          placeholder="Caption (optional)"
          value="${escHtml(img.caption)}"
          data-id="${img.id}"
        />
      </div>
      <div class="image-item-actions">
        ${idx > 0
          ? `<button class="img-btn up" data-id="${img.id}" title="Move up">↑</button>`
          : `<button class="img-btn" disabled style="opacity:0.2">↑</button>`
        }
        ${idx < images.length - 1
          ? `<button class="img-btn down" data-id="${img.id}" title="Move down">↓</button>`
          : `<button class="img-btn" disabled style="opacity:0.2">↓</button>`
        }
        <button class="img-btn remove" data-id="${img.id}" title="Remove">✕</button>
      </div>
    </div>
  `).join('');

  // Bind caption inputs
  list.querySelectorAll('.image-caption-input').forEach(input => {
    input.addEventListener('input', e => updateCaption(e.target.dataset.id, e.target.value));
  });

  // Bind action buttons
  list.querySelectorAll('.img-btn.up').forEach(btn =>
    btn.addEventListener('click', () => moveImage(btn.dataset.id, -1))
  );
  list.querySelectorAll('.img-btn.down').forEach(btn =>
    btn.addEventListener('click', () => moveImage(btn.dataset.id, 1))
  );
  list.querySelectorAll('.img-btn.remove').forEach(btn =>
    btn.addEventListener('click', () => removeImage(btn.dataset.id))
  );
}

// ── YouTube ID extraction ─────────────────────────────────────────
function extractYouTubeId(input) {
  if (!input) return null;
  input = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  const match = input.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}


// ── New post YouTube management ───────────────────────────────
function addYtVideo() {
  const input = $('ytVideoInput') ? $('ytVideoInput').value.trim() : '';
  const label = $('ytVideoLabel') ? $('ytVideoLabel').value.trim() : '';
  const id = extractYouTubeId(input);
  if (!id) { alert('Could not find a valid YouTube video ID in that URL.'); return; }
  if (ytVideos.find(v => v.id === id)) { alert('That video is already added.'); return; }
  ytVideos.push({ id, label });
  if ($('ytVideoInput')) $('ytVideoInput').value = '';
  if ($('ytVideoLabel')) $('ytVideoLabel').value = '';
  renderYtVideoList();
  renderPreview();
}

function removeYtVideo(id) {
  ytVideos = ytVideos.filter(v => v.id !== id);
  renderYtVideoList();
  renderPreview();
}

function renderYtVideoList() {
  const list = $('ytVideoList');
  if (!list) return;
  if (ytVideos.length === 0) { list.innerHTML = ''; return; }
  list.innerHTML = ytVideos.map(v => `
    <div class="yt-video-item">
      <img src="https://img.youtube.com/vi/${v.id}/mqdefault.jpg" class="yt-thumb" alt="thumbnail" />
      <div class="yt-video-meta">
        <span class="yt-video-id">${v.id}</span>
        ${v.label ? `<span class="yt-video-label">${escHtml(v.label)}</span>` : ''}
      </div>
      <button type="button" class="img-btn remove" onclick="removeYtVideo('${v.id}')">✕</button>
    </div>`).join('');
}

// ── Preview ───────────────────────────────────────────────────────
function renderPreview() {
  const title    = $('postTitle').value.trim();
  const date     = $('postDate').value;
  const body     = $('postBody').innerHTML.trim();
  const ytId     = (typeof ytVideos !== 'undefined' && ytVideos.length > 0) ? ytVideos[0].id : null;
  const linkUrl  = $('postLink').value.trim();
  const linkText = $('postLinkText').value.trim() || linkUrl;
  const fmtDate  = date
    ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })
    : '';

  let html = `
    <div class="p-meta">
      <span class="p-tag">Post #?</span>
      <span class="p-date">${escHtml(fmtDate)}</span>
    </div>
    <h2 class="p-title">${escHtml(title || 'Untitled Post')}</h2>
  `;

  if (ytId) {
    html += `
      <div class="p-video">
        <div class="p-video-wrap">
          <iframe src="https://www.youtube.com/embed/${ytId}" frameborder="0" allowfullscreen></iframe>
        </div>
      </div>`;
  }

  if (images.length > 0) {
    const countClass = images.length === 1 ? 'count-1'
                     : images.length === 2 ? 'count-2'
                     : images.length === 3 ? 'count-3'
                     : 'count-many';
    const items = images.map(img => `
      <figure class="p-gallery-item">
        <img src="${img.dataUrl}" alt="${escHtml(img.caption || img.name)}" />
        ${img.caption ? `<figcaption>${escHtml(img.caption)}</figcaption>` : ''}
      </figure>
    `).join('');
    html += `
      <div class="p-gallery">
        <div class="p-gallery-grid ${countClass}">${items}</div>
      </div>`;
  }

  if (body) html += `<div class="p-body">${body}</div>`;

  if (linkUrl) {
    html += `<a class="p-link" href="${escHtml(linkUrl)}" target="_blank">${escHtml(linkText)} →</a>`;
  }

  $('previewBox').innerHTML = html;

  if (window.innerWidth < 900) {
    $('previewPanel').scrollIntoView({ behavior: 'smooth' });
  }
}

// ── Count existing posts ─────────────────────────────────────────
function countExistingPosts(html) {
  const matches = html.match(/class="post-index-card"/g);
  return matches ? matches.length : 0;
}

// ── Build post HTML for blog.html ─────────────────────────────────
function buildPostHtml({ title, date, body, ytId, uploadedImages, linkUrl, linkText, postNumber }) {
  const fmtDate = date
    ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })
    : '';
  const tag = `Post #${postNumber}`;
  const category = ($('postCategory') ? $('postCategory').value : 'PCS') || 'PCS';

  // Video block
  let videoBlock = '';
  if (ytId) {
    videoBlock = `
      <div class="post-video">
        <div class="video-embed-wrap">
          <iframe
            src="https://www.youtube.com/embed/${ytId}"
            title="${escHtml(title)}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen>
          </iframe>
        </div>
        <p class="video-caption">Watch on <a href="https://www.youtube.com/@EmmericanAdventure" target="_blank">YouTube →</a></p>
      </div>`;
  }

  // Gallery block
  let galleryBlock = '';
  if (uploadedImages && uploadedImages.length > 0) {
    if (uploadedImages.length === 1) {
      // Single image — use figure
      const img = uploadedImages[0];
      galleryBlock = `
      <figure class="post-photo">
        <img src="${escHtml(img.path)}" alt="${escHtml(img.caption || title)}" />
        ${img.caption ? `<figcaption>${escHtml(img.caption)}</figcaption>` : ''}
      </figure>`;
    } else {
      // Multiple images — gallery grid
      const gridClass = uploadedImages.length === 2 ? 'gallery-2'
                      : uploadedImages.length === 3 ? 'gallery-3'
                      : 'gallery-many';
      const items = uploadedImages.map(img => `
        <figure class="gallery-item">
          <img src="${escHtml(img.path)}" alt="${escHtml(img.caption || title)}" />
          ${img.caption ? `<figcaption>${escHtml(img.caption)}</figcaption>` : ''}
        </figure>`).join('');
      galleryBlock = `
      <div class="post-gallery ${gridClass}">${items}
      </div>`;
    }
  }

  // Link block
  let linkBlock = '';
  if (linkUrl) {
    linkBlock = `\n        <p><a href="${escHtml(linkUrl)}" target="_blank" rel="noopener">${escHtml(linkText || linkUrl)}</a></p>`;
  }

  return `
    <!-- ====== POST: ${escHtml(title)} — ${fmtDate} ====== -->
    <article class="post-entry">

      <header class="post-entry-header">
        <div class="post-meta">
          <span class="post-tag">${tag}</span>
          <time class="post-date">${escHtml(fmtDate)}</time>
        </div>
        <h2 class="post-entry-title">${escHtml(title)}</h2>
      </header>
${videoBlock}${galleryBlock}
      <div class="post-body">
        ${body || ''}${linkBlock}
      </div>

      <footer class="post-entry-footer">
        <a href="blog.html" class="read-more small">← Back to Journal</a>
      </footer>

      <div class="post-comments">
        <div id="disqus_thread_post${postNumber}"></div>
        <script>
          (function() {
            var d = document, s = d.createElement('script');
            s.src = 'https://emmericanadventure.disqus.com/embed.js';
            s.setAttribute('data-timestamp', +new Date());
            s.setAttribute('data-page-identifier', 'post-${postNumber}');
            (d.head || d.body).appendChild(s);
          })();
        </script>
        <noscript>Please enable JavaScript to view comments.</noscript>
      </div>

    </article>`;
}



// ── Build individual post page HTML ──────────────────────────────
function buildPostPage({ title, slug, date, postNumber, location, body, ytId, uploadedImages, linkUrl, linkText, isScheduled, seoExcerpt, prevPostSlug, prevPostTitle }) {
  const fmtDate = date
    ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })
    : '';

  // Build prev post link if provided
  const prevPostHtml = (prevPostSlug && prevPostTitle)
    ? '<a href="../posts/' + escHtml(prevPostSlug) + '.html" class="read-more small" style="margin-left:auto;">Next: ' + escHtml(prevPostTitle) + ' →</a>'
    : '';

  // Build location HTML — supports plain text, URL, or "Label | URL" format
  let locationHtml = '';
  if (location) {
    if (location.startsWith('http') || location.startsWith('maps.')) {
      locationHtml = `<div class="post-location"><a href="${escHtml(location)}" target="_blank" rel="noopener">📍 View on Maps</a></div>`;
    } else if (location.includes('|')) {
      const parts = location.split('|').map(s => s.trim());
      locationHtml = `<div class="post-location"><a href="${escHtml(parts[1])}" target="_blank" rel="noopener">📍 ${escHtml(parts[0])}</a></div>`;
    } else {
      locationHtml = `<div class="post-location">📍 ${escHtml(location)}</div>`;
    }
  }

  let imgSrc = uploadedImages && uploadedImages.length > 0 ? uploadedImages[0].path
             : ytId ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg` : '';

  let mediaHtml = '';
  if (uploadedImages && uploadedImages.length === 1) {
    mediaHtml += `
      <figure class="post-photo">
        <img src="../${escHtml(uploadedImages[0].path)}" alt="${escHtml(uploadedImages[0].caption || title)}" />
        ${uploadedImages[0].caption ? `<figcaption>${escHtml(uploadedImages[0].caption)}</figcaption>` : ''}
      </figure>`;
  } else if (uploadedImages && uploadedImages.length > 1) {
    const gridClass = uploadedImages.length === 2 ? 'gallery-2' : uploadedImages.length === 3 ? 'gallery-3' : 'gallery-many';
    const items = uploadedImages.map(img => `
        <figure class="gallery-item">
          <img src="../${escHtml(img.path)}" alt="${escHtml(img.caption || title)}" />
          ${img.caption ? `<figcaption>${escHtml(img.caption)}</figcaption>` : ''}
        </figure>`).join('');
    mediaHtml += `<div class="post-gallery ${gridClass}">${items}</div>`;
  }
  if (ytId) {
    mediaHtml += `
      <div class="post-video">
        <div class="video-embed-wrap">
          <iframe src="https://www.youtube.com/embed/${ytId}" title="${escHtml(title)}"
            frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen></iframe>
        </div>
        <p class="video-caption">Watch on <a href="https://www.youtube.com/@EmmericanAdventure" target="_blank">YouTube →</a></p>
      </div>`;
  }
  let linkBlock = linkUrl ? `<p><a href="${escHtml(linkUrl)}" target="_blank" rel="noopener">${escHtml(linkText || linkUrl)}</a></p>` : '';
  const autoExcerpt = body.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().substring(0, 155);
  const plainExcerpt = (seoExcerpt && seoExcerpt.trim()) ? seoExcerpt.trim() : autoExcerpt;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(title)} — Emmerican Adventure</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400;700&family=DM+Serif+Display:ital@0;1&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../style.css" />
  <link rel="stylesheet" href="../blog.css" />
  <link rel="stylesheet" href="../darkmode.css" />
  <meta name="description" content="${escHtml(plainExcerpt)}" />
  <meta name="author" content="Emmerican Adventure" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://emmericanadventure.com/posts/${slug}.html" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Emmerican Adventure" />
  <meta property="og:title" content="${escHtml(title)} — Emmerican Adventure" />
  <meta property="og:description" content="${escHtml(plainExcerpt)}" />
  <meta property="og:url" content="https://emmericanadventure.com/posts/${slug}.html" />
  ${imgSrc ? `<meta property="og:image" content="https://emmericanadventure.com/${escHtml(imgSrc)}" />` : ''}
  <link rel="icon" type="image/x-icon" href="../favicon.ico" />
  <link rel="icon" type="image/svg+xml" href="../favicon.svg" />
  <link rel="apple-touch-icon" href="../apple-touch-icon.png" />
  <script src="../darkmode.js"></script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-KRCW4S3G9P"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-KRCW4S3G9P');</script>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3956728145959428" crossorigin="anonymous"></script>
</head>
<body>
  <div class="bg-kanji" aria-hidden="true">記</div>
  <header class="site-header" style="position:relative;">
      <div class="header-search-bar" id="headerSearchBar" role="search">
        <input type="search" class="header-search-input" id="headerSearchInput"
          placeholder="Search posts, places, adventures…"
          aria-label="Search site" />
        <span class="header-search-hint">Press Enter to search</span>
        <button class="header-search-close" id="headerSearchClose" aria-label="Close search">✕</button>
      </div>
    <div class="header-inner">
      <div class="logo">
        <a href="../index.html" style="display:flex;align-items:center;gap:0.75rem;text-decoration:none;">
          <span class="logo-kanji">日本</span>
          <div class="logo-text">
            <span class="logo-title">Emmerican Adventure</span>
            <span class="logo-sub">Chapter 1: Japan</span>
          </div>
        </a>
      </div>
      <nav class="nav">
        <a href="../index.html" class="nav-link">Home</a>
        <a href="../blog.html" class="nav-link active">Journal</a>
        <a href="../adventures.html" class="nav-link">Adventures</a>
        <a href="../index.html#videos" class="nav-link">Videos</a>
        <a href="../photos.html" class="nav-link">Photos</a>
        <a href="../about.html" class="nav-link">About</a>
      </nav>
      <button class="search-toggle" aria-label="Search" aria-expanded="false" aria-controls="headerSearchBar">🔍</button>
      <button class="theme-toggle" id="themeToggle" aria-label="Switch to dark mode">🌙</button>
      <button class="mobile-menu-btn" aria-label="Menu">☰</button>
    </div>
  </header>
  <main class="blog-main">
    <article class="post-entry post-full"${isScheduled ? ' data-scheduled="true"' : ''}>
      <header class="post-entry-header">
        <div class="post-meta">
          <span class="post-tag">Post #${postNumber}</span>
          <time class="post-date">${escHtml(fmtDate)}</time>
        </div>
        <h1 class="post-entry-title">${escHtml(title)}</h1>
        ${locationHtml}
      </header>
      <div class="post-ad">
        <ins class="adsbygoogle"
          style="display:block"
          data-ad-client="ca-pub-3956728145959428"
          data-ad-slot="auto"
          data-ad-format="auto"
          data-full-width-responsive="true"></ins>
        <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
      </div>
      ${mediaHtml}
      <div class="post-body">
        ${body}
        ${linkBlock}
      </div>
      <footer class="post-entry-footer">
        <a href="../blog.html" class="read-more small">← Back to Journal</a>
        ${prevPostHtml}
      </footer>
      <div class="post-comments">
        <div id="disqus_thread"></div>
        <script>
          var disqus_config = function () {
            this.page.url = 'https://emmericanadventure.com/posts/${slug}.html';
            this.page.identifier = '${slug}';
          };
          (function() {
            var d = document, s = d.createElement('script');
            s.src = 'https://emmericanadventure.disqus.com/embed.js';
            s.setAttribute('data-timestamp', +new Date());
            (d.head || d.body).appendChild(s);
          })();
        </script>
        <noscript>Please enable JavaScript to view comments.</noscript>
      </div>
    </article>
  </main>
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-left">
        <span class="footer-kanji">日本へ</span>
        <span class="footer-name">Emmerican Adventure</span>
      </div>
      <div class="footer-copy">© 2026 Emmerican Adventure — Made with 愛 in Jacksonville, FL | As an Amazon Associate I earn from qualifying purchases.</div>
      <div class="footer-links">
        <a href="https://www.youtube.com/@EmmericanAdventure" target="_blank">YouTube</a>
      </div>
    </div>
  </footer>
  <script src="../main.js"></script>
</body>
</html>`;
}


// ── Update publish button label based on date ─────────────────
function updatePublishLabel() {
  const date = $('postDate').value;
  const label = $('publishLabel');
  if (!label) return;
  if (date && new Date(date + 'T00:00:00') > new Date()) {
    label.textContent = 'Schedule Post →';
  } else {
    label.textContent = 'Publish Post →';
  }
}
// ── Generate URL slug from title ─────────────────────────────────
function slugify(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Publish ───────────────────────────────────────────────────────
async function handlePublish() {
  const title    = $('postTitle').value.trim();
  const date     = $('postDate').value;
  const location = $('postLocation') ? $('postLocation').value.trim() : '';
  const body     = $('postBody').innerHTML.trim();
  const ytId     = (typeof ytVideos !== 'undefined' && ytVideos.length > 0) ? ytVideos[0].id : null;
  const linkUrl  = $('postLink').value.trim();
  const linkText = $('postLinkText').value.trim();

  if (!title) { alert('Please add a post title.'); return; }
  if (!body && (!ytVideos || ytVideos.length === 0) && images.length === 0) {
    alert('Please add some content — body text, a video, or at least one photo.'); return;
  }

  // Check if post is scheduled (future date)
  const isScheduled = date && new Date(date + 'T00:00:00') > new Date();

  setPublishing(true);
  showStatus(isScheduled ? 'Scheduling post…' : 'Uploading…', false, true);

  try {
    const slug = slugify(title);

    // 1. Upload all images to GitHub
    const uploadedImages = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      showStatus(`Uploading photo ${i + 1} of ${images.length}…`, false, true);
      const safeName = img.name.replace(/\s+/g, '-').toLowerCase();
      const path = `images/${Date.now()}-${safeName}`;
      await uploadFile(path, img.dataUrl.split(',')[1]);
      uploadedImages.push({ path, caption: img.caption });
    }

    // 1b. Sanitize post body — strip inline styles/fonts from editor paste
    const bodyEditor = $('postBody');
    if (bodyEditor) {
      // Remove all style attributes from body content
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = bodyEditor.innerHTML;
      tempDiv.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
      tempDiv.querySelectorAll('span:not([class])').forEach(el => {
        el.replaceWith(...el.childNodes);
      });
      // Remove empty paragraphs
      tempDiv.querySelectorAll('p').forEach(p => {
        if (!p.textContent.trim() && !p.querySelector('img')) p.remove();
      });
      bodyEditor.innerHTML = tempDiv.innerHTML;
    }

    // 2. Fetch current blog.html to count posts
    showStatus('Publishing post…', false, true);
    const blogRes = await ghFetch(`contents/${CONFIG.blogFile}`);
    if (!blogRes.ok) throw new Error(`Could not fetch ${CONFIG.blogFile}: ${blogRes.status}`);
    const blogJson = await blogRes.json();
    const blogContent = decodeURIComponent(escape(atob(blogJson.content.replace(/\n/g, ''))));
    const blogSha = blogJson.sha;

    // 3. Count existing posts
    const postNumber = countExistingPosts(blogContent) + 1;

    // 4. Build and push individual post page
    showStatus('Creating post page…', false, true);
    const seoExcerpt = $('postSeoExcerpt') ? $('postSeoExcerpt').value.trim() : '';

    // Get previous post slug/title from blog.html (newest post at top = first card)
    let prevPostSlug = '', prevPostTitle = '';
    const prevMatch = blogContent.match(/href="posts\/([^"]+)\.html"[^>]*>[\s\S]*?post-index-title[^>]*>([^<]+)</);
    if (prevMatch) {
      prevPostSlug = prevMatch[1];
      prevPostTitle = prevMatch[2].trim();
    }

    const postPageHtml = buildPostPage({ title, slug, date, postNumber, location, body, ytId, uploadedImages, linkUrl, linkText, isScheduled, seoExcerpt, prevPostSlug, prevPostTitle });
    await uploadFile(`posts/${slug}.html`, btoa(unescape(encodeURIComponent(postPageHtml))));

    // 5. Build index card for blog.html
    const fmtDate = date ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }) : '';
    const plainText = $('postBody').innerText.trim();
    const excerpt = plainText.length > 140 ? plainText.substring(0, 140).replace(/\s+\S*$/, '') + '…' : plainText;
    const thumbSrc = uploadedImages.length > 0 ? uploadedImages[0].path
                   : ytId ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg` : '';

    const newCard = isScheduled ? `
    <article class="post-index-card post-scheduled" data-publish-date="${date}">
      <div class="post-index-link post-index-link-scheduled">
        <div class="post-index-img post-scheduled-img">
          ${thumbSrc ? `<img src="${escHtml(thumbSrc)}" alt="${escHtml(title)}" style="opacity:0.4;" />` : ''}
          <div class="scheduled-badge">🕐 Coming Soon</div>
        </div>
        <div class="post-index-body">
          <div class="post-meta">
            <span class="post-tag post-tag-scheduled">Scheduled</span>
            <time class="post-date">${escHtml(fmtDate)}</time>
          </div>
          <h2 class="post-index-title scheduled-title">${escHtml(title)}</h2>
          <p class="post-index-excerpt scheduled-excerpt">Going live on ${escHtml(fmtDate)}.</p>
        </div>
      </div>
    </article>` : `
    <article class="post-index-card">
      <a href="posts/${slug}.html" class="post-index-link">
        <div class="post-index-img">
          ${thumbSrc ? `<img src="${escHtml(thumbSrc)}" alt="${escHtml(title)}" />` : '<div class="img-placeholder"><span class="placeholder-kanji">記</span></div>'}
        </div>
        <div class="post-index-body">
          <div class="post-meta">
            <span class="post-tag">Post #${postNumber}</span>
            <time class="post-date">${escHtml(fmtDate)}</time>
          </div>
          <h2 class="post-index-title">${escHtml(title)}</h2>
          <p class="post-index-excerpt">${escHtml(excerpt)}</p>
          <span class="read-more small">Read Post <span>→</span></span>
        </div>
      </a>
    </article>`;

    // 6. Insert card at top of blog.html
    const cardMarker = '<!-- ====== NEW POST INDEX CARD — COPY FROM HERE ====== -->';
    let updatedBlog;
    if (blogContent.includes(cardMarker)) {
      updatedBlog = blogContent.replace(cardMarker, cardMarker + newCard);
    } else {
      updatedBlog = blogContent.replace('<article class="post-index-card">', newCard + '\n\n    <article class="post-index-card">');
    }

    // 7. Push updated blog.html
    const pushRes = await ghFetch(`contents/${CONFIG.blogFile}`, 'PUT', {
      message: `New post: ${title}`,
      content: btoa(unescape(encodeURIComponent(updatedBlog))),
      sha: blogSha,
      branch: CONFIG.branch,
    });

    if (!pushRes.ok) {
      const err = await pushRes.json();
      throw new Error(err.message || 'GitHub push failed');
    }

    // 8. Update homepage featured post
    showStatus('Updating homepage…', false, true);
    await updateHomepageFeatured({ title, date, postNumber, uploadedImages, ytId, slug });

    // 9. Update photo grids (index.html + photos.html)
    if (uploadedImages && uploadedImages.length > 0) {
      showStatus('Updating photo gallery…', false, true);
      await updatePhotoGrids({ title, uploadedImages });
    }

    // 9b. Update homepage video grid if post has YouTube
    if (ytVideos && ytVideos.length > 0) {
      showStatus('Updating video gallery…', false, true);
      await updateVideoGrid({ title, slug, ytVideos });
    }

    // 10. Update sitemap
    showStatus('Updating sitemap…', false, true);
    await updateSitemap({ slug, date });

    // 11. Update RSS feed
    showStatus('Updating RSS feed…', false, true);
    await updateRssFeed({ title, slug, fmtDate, excerpt });

    // 11. Update Search Index
    showStatus('Updating search index…', false, true);
    const thumbPath = uploadedImages.length > 0 ? uploadedImages[0].path : (ytId ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg` : '');
    await updateSearchIndex({ slug, title, date: fmtDate, excerpt, tag: 'Journal', img: thumbPath, keywords: title });

    showStatus(isScheduled ? `✓ Scheduled! Post will go live on ${new Date(date + 'T00:00:00').toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'})}` : '✓ Published! Your post will be live in ~60 seconds.', false);
    resetForm();

  } catch (err) {
    console.error(err);
    showStatus('✗ Error: ' + err.message, true);
  } finally {
    setPublishing(false);
  }
}



// ── Update sitemap.xml ───────────────────────────────────────────
async function updateSitemap({ slug, date }) {
  try {
    const today = date || new Date().toISOString().split('T')[0];
    const postUrl = `https://emmericanadventure.com/posts/${slug}.html`;

    // Fetch current sitemap
    const fileRes = await ghFetch('contents/sitemap.xml');
    if (!fileRes.ok) throw new Error('Could not fetch sitemap.xml');
    const fileJson = await fileRes.json();
    let xml = decodeURIComponent(escape(atob(fileJson.content.replace(/\n/g, ''))));
    const sha = fileJson.sha;

    if (xml.includes(postUrl)) {
      // Update existing entry lastmod
      const regex = new RegExp(`(<loc>${postUrl}</loc>\\s*<lastmod>).*?(</lastmod>)`, 's');
      xml = xml.replace(regex, `$1${today}$2`);
    } else {
      // Insert new URL entry before closing </urlset>
      const newEntry = `
  <url>
    <loc>${postUrl}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;
      xml = xml.replace('</urlset>', newEntry);
    }

    await ghFetch('contents/sitemap.xml', 'PUT', {
      message: `Update sitemap: add ${slug}`,
      content: btoa(unescape(encodeURIComponent(xml))),
      sha,
      branch: CONFIG.branch,
    });
  } catch (err) {
    console.warn('Could not update sitemap:', err.message);
  }
}

// ── Update search index in search.html ───────────────────────────
async function updateSearchIndex({ slug, title, date, excerpt, tag, img, keywords }) {
  try {
    const fileRes = await ghFetch('contents/search.html');
    if (!fileRes.ok) return;
    const fileJson = await fileRes.json();
    let html = decodeURIComponent(escape(atob(fileJson.content.replace(/\n/g, ''))));
    const sha = fileJson.sha;

    if (html.includes(`slug: '${slug}'`)) return;

    const newEntry = `      {
        slug: '${slug}',
        title: '${title}',
        excerpt: '${excerpt}',
        date: '${date}',
        tag: '${tag}',
        img: '${img}',
        keywords: '${keywords}'
      },
    ];`;

    const updatedHtml = html.replace('];', newEntry);

    await ghFetch('contents/search.html', 'PUT', {
      message: `Update search index: ${slug}`,
      content: btoa(unescape(encodeURIComponent(updatedHtml))),
      sha,
      branch: CONFIG.branch,
    });
  } catch (err) {
    console.warn('Could not update search index:', err.message);
  }
}

// ── Update homepage featured post ────────────────────────────────
async function updateHomepageFeatured({ title, date, postNumber, uploadedImages, ytId, slug }) {
  try {
    const fmtDate = date
      ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })
      : '';

    // Pick the best image — first uploaded image or a YouTube thumbnail
    let imgSrc = '';
    if (uploadedImages && uploadedImages.length > 0) {
      imgSrc = uploadedImages[0].path;
    } else if (ytId) {
      imgSrc = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
    }

    // Short excerpt from body
    const bodyEl = $('postBody');
    const plainText = bodyEl ? bodyEl.innerText.trim() : '';
    const excerpt = plainText.length > 120
      ? plainText.substring(0, 120).replace(/\s+\S*$/, '') + '…'
      : plainText;

    // Fetch current index.html
    const fileRes = await ghFetch('contents/index.html');
    if (!fileRes.ok) throw new Error('Could not fetch index.html');
    const fileJson = await fileRes.json();
    const currentHtml = decodeURIComponent(escape(atob(fileJson.content.replace(/\n/g, ''))));
    const sha = fileJson.sha;

    // Build new featured card image
    const newImg = imgSrc
      ? `<img src="${escHtml(imgSrc)}" alt="${escHtml(title)}" />`
      : `<div class="img-placeholder"><span class="placeholder-kanji">記</span></div>`;

    // Replace featured card using markers
    const startMarker = '<section class="featured-post" id="journal">';
    const endMarker   = '</section>';
    const startIdx = currentHtml.indexOf(startMarker);
    const endIdx   = currentHtml.indexOf(endMarker, startIdx) + endMarker.length;

    if (startIdx === -1) throw new Error('Could not find featured-post section in index.html');

    const postLink = slug ? `posts/${slug}.html` : 'blog.html';

    const newSection = `<section class="featured-post" id="journal">
      <a href="${postLink}" class="section-tag section-tag-link">Latest Post →</a>
      <article class="featured-card">
        <div class="featured-card-img">
          ${newImg}
        </div>
        <div class="featured-card-body">
          <div class="post-meta">
            <span class="post-tag">Post #${postNumber}</span>
            <span class="post-date">${escHtml(fmtDate)}</span>
          </div>
          <h2 class="featured-title"><a href="${postLink}" style="text-decoration:none;color:inherit;">${escHtml(title)}</a></h2>
          <p class="featured-excerpt">${escHtml(excerpt)}</p>
          <a href="${postLink}" class="read-more">Read More <span>→</span></a>
        </div>
      </article>
    </section>`;

    const updatedHtml = currentHtml.substring(0, startIdx) + newSection + currentHtml.substring(endIdx);

    // Push updated index.html
    const pushRes = await ghFetch('contents/index.html', 'PUT', {
      message: `Update homepage featured post: ${title}`,
      content: btoa(unescape(encodeURIComponent(updatedHtml))),
      sha,
      branch: CONFIG.branch,
    });

    if (!pushRes.ok) {
      const err = await pushRes.json();
      console.warn('Homepage update failed:', err.message);
    }
  } catch (err) {
    console.warn('Could not update homepage featured post:', err.message);
  }
}



// ── Update homepage video grid ────────────────────────────────
async function updateVideoGrid({ title, slug, ytVideos }) {
  try {
    const fileRes = await ghFetch('contents/index.html');
    if (!fileRes.ok) return;
    const fileJson = await fileRes.json();
    let html = decodeURIComponent(escape(atob(fileJson.content.replace(/\n/g, ''))));
    const sha = fileJson.sha;

    const marker = '<!-- ====== NEW VIDEO INSERTED ABOVE THIS LINE ====== -->';
    if (!html.includes(marker)) return;

    // Build video cards for each YouTube video
    const newCards = ytVideos.map(v => `
        <div class="video-card">
          <div class="video-embed-wrap">
            <iframe
              src="https://www.youtube.com/embed/${v.id}"
              title="${escHtml(v.label || title)}"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen>
            </iframe>
          </div>
          <div class="video-card-body">
            <h3 class="video-card-title">${escHtml(v.label || title)}</h3>
            <p class="video-card-desc">${escHtml(title)}</p>
          </div>
        </div>`).join('\n');

    // Insert before marker
    let updated = html.replace(marker, newCards + '\n        ' + marker);

    // Trim to 6 most recent video cards
    const parts = updated.split('<div class="video-card">');
    if (parts.length - 1 > 6) {
      updated = parts.slice(0, 7).join('<div class="video-card">') +
                updated.substring(updated.lastIndexOf(parts[7] || ''));
    }

    await ghFetch('contents/index.html', 'PUT', {
      message: `Update homepage videos: ${title}`,
      content: btoa(unescape(encodeURIComponent(updated))),
      sha,
      branch: CONFIG.branch,
    });
  } catch (err) {
    console.warn('Could not update video grid:', err.message);
  }
}

// ── Update photo grids on index.html and photos.html ─────────────
async function updatePhotoGrids({ title, uploadedImages }) {
  try {
    if (!uploadedImages || uploadedImages.length === 0) return;

    const newItems = uploadedImages.map(img => `
        <div class="photo-item" data-caption="${escHtml(title)}">
          <img src="${escHtml(img.path)}" alt="${escHtml(title)}" />
        </div>`).join('\n');

    const marker = '        <!-- ====== NEW PHOTOS INSERTED ABOVE THIS LINE ====== -->';

    // ── Update index.html (keep 6 most recent) ────────────────────
    const indexRes = await ghFetch('contents/index.html');
    if (!indexRes.ok) throw new Error('Could not fetch index.html');
    const indexJson = await indexRes.json();
    const indexHtml = decodeURIComponent(escape(atob(indexJson.content.replace(/\n/g, ''))));
    const indexSha = indexJson.sha;

    if (indexHtml.includes(marker)) {
      let updated = indexHtml.replace(marker, newItems + '\n' + marker);

      // Trim to exactly 6 most recent photo-items
      // Split on the photo-item divs, keep first 6, discard the rest
      const marker = '<!-- ====== NEW PHOTOS INSERTED ABOVE THIS LINE ====== -->';
      const markerIdx = updated.indexOf(marker);
      if (markerIdx !== -1) {
        const beforeMarker = updated.substring(0, markerIdx);
        const afterMarker = updated.substring(markerIdx);
        // Find all photo-item blocks by splitting on the opening tag
        const parts = beforeMarker.split('<div class="photo-item"');
        // parts[0] is everything before the first photo-item
        // parts[1..n] are each photo-item (without the opening tag)
        if (parts.length - 1 > 6) {
          // Keep only the first 6 photo-items (newest, since we insert at top)
          const kept = parts.slice(0, 7); // index 0 = prefix, 1-6 = 6 items
          updated = kept.join('<div class="photo-item"') + afterMarker;
        }
      }

      await ghFetch('contents/index.html', 'PUT', {
        message: `Add photo to homepage grid: ${title}`,
        content: btoa(unescape(encodeURIComponent(updated))),
        sha: indexSha,
        branch: CONFIG.branch,
      });
    }

    // ── Update photos.html (keep all) ────────────────────────────
    const photosRes = await ghFetch('contents/photos.html');
    if (!photosRes.ok) throw new Error('Could not fetch photos.html');
    const photosJson = await photosRes.json();
    const photosHtml = decodeURIComponent(escape(atob(photosJson.content.replace(/\n/g, ''))));
    const photosSha = photosJson.sha;

    if (photosHtml.includes(marker)) {
      const updatedPhotos = photosHtml.replace(marker, newItems + '\n' + marker);
      await ghFetch('contents/photos.html', 'PUT', {
        message: `Add photo to gallery: ${title}`,
        content: btoa(unescape(encodeURIComponent(updatedPhotos))),
        sha: photosSha,
        branch: CONFIG.branch,
      });
    }

  } catch (err) {
    console.warn('Could not update photo grids:', err.message);
  }
}


// ── Update RSS feed.xml ───────────────────────────────────────
async function updateRssFeed({ title, slug, fmtDate, excerpt }) {
  try {
    const fileRes = await ghFetch('contents/feed.xml');
    if (!fileRes.ok) return;
    const fileJson = await fileRes.json();
    let xml = decodeURIComponent(escape(atob(fileJson.content.replace(/\n/g, ''))));
    const sha = fileJson.sha;

    const url = `https://emmericanadventure.com/posts/${slug}.html`;

    // Don't add duplicate
    if (xml.includes(`<guid isPermaLink="true">${url}</guid>`)) return;

    // Build RFC 822 date
    const now = new Date().toUTCString();

    const newItem = `    <item>
      <title>${title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${now}</pubDate>
      <description>${excerpt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</description>
    </item>`;

    // Insert after <channel> opening tags, before first <item>
    const insertPoint = xml.indexOf('    <item>');
    if (insertPoint !== -1) {
      xml = xml.substring(0, insertPoint) + newItem + '\n' + xml.substring(insertPoint);
    } else {
      xml = xml.replace('  </channel>', newItem + '\n  </channel>');
    }

    // Update lastBuildDate
    xml = xml.replace(
      /<lastBuildDate>[^<]+<\/lastBuildDate>/,
      `<lastBuildDate>${now}</lastBuildDate>`
    );

    await ghFetch('contents/feed.xml', 'PUT', {
      message: `Update RSS feed: ${title}`,
      content: btoa(unescape(encodeURIComponent(xml))),
      sha,
      branch: CONFIG.branch,
    });
  } catch (err) {
    console.warn('Could not update RSS feed:', err.message);
  }
}

// ── GitHub helpers ────────────────────────────────────────────────
async function uploadFile(path, base64Content) {
  const res = await ghFetch(`contents/${path}`, 'PUT', {
    message: `Upload: ${path}`,
    content: base64Content,
    branch: CONFIG.branch,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Upload failed for ${path}: ${err.message || res.status}`);
  }
}

function ghFetch(endpoint, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Authorization': `token ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/${endpoint}`, opts);
}

// ── UI helpers ────────────────────────────────────────────────────
function setPublishing(on) {
  $('publishBtn').disabled = on;
  $('publishLabel').textContent = on ? 'Publishing…' : 'Publish Post →';
}

function showStatus(msg, isError, persist = false) {
  const bar = $('statusBar');
  bar.classList.remove('hidden', 'error');
  if (isError) bar.classList.add('error');
  $('statusMsg').textContent = msg;
  if (!persist && !isError) setTimeout(() => bar.classList.add('hidden'), 8000);
}

function resetForm() {
  $('postTitle').value    = '';
  $('postBody').innerHTML = '';
  if (typeof ytVideos !== 'undefined') { ytVideos = []; if ($('ytVideoList')) $('ytVideoList').innerHTML = ''; }
  $('postLink').value     = '';
  if ($('postLocation')) $('postLocation').value = '';
  $('postLinkText').value = '';
  $('postDate').value     = new Date().toISOString().split('T')[0];
  images = [];
  renderImageList();
  $('previewBox').innerHTML = '<p class="preview-empty">Fill in the form and click Preview to see your post.</p>';
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
// ═══════════════════════════════════════════════════════════════
// EDIT POSTS FEATURE
// ═══════════════════════════════════════════════════════════════

let editingSlug  = null;
let editingFileSha = null;
let editYtVideos  = [];
let editPhotos    = [];
let editBodyHtml  = '';

// ── Tab switching ─────────────────────────────────────────────
function switchTab(tab) {
  const panels = ['panelNew', 'panelEdit', 'panelAdventures', 'panelImages'];
  const tabs   = ['tabNew', 'tabEdit', 'tabAdventures', 'tabImages'];

  panels.forEach(id => $(id)?.classList.add('hidden'));
  tabs.forEach(id   => $(id)?.classList.remove('active'));

  if (tab === 'new') {
    $('panelNew')?.classList.remove('hidden');
    $('tabNew')?.classList.add('active');
  } else if (tab === 'edit') {
    $('panelEdit')?.classList.remove('hidden');
    $('tabEdit')?.classList.add('active');
    loadPostsList();
  } else if (tab === 'adventures') {
    $('panelAdventures')?.classList.remove('hidden');
    $('tabAdventures')?.classList.add('active');
    advAdminLoad();
  } else if (tab === 'images') {
    $('panelImages')?.classList.remove('hidden');
    $('tabImages')?.classList.add('active');
    imgAdminLoad();
  }
}

// ── Load list of posts from /posts/ folder ────────────────────
async function loadPostsList() {
  const list = $('postsList');
  list.innerHTML = '<p class="preview-empty">Loading posts…</p>';

  try {
    const res = await ghFetch('contents/posts');
    if (!res.ok) throw new Error('Could not fetch posts folder');
    const files = await res.json();

    const htmlFiles = files.filter(f => f.name.endsWith('.html'));

    if (htmlFiles.length === 0) {
      list.innerHTML = '<p class="preview-empty">No posts found yet.</p>';
      return;
    }

    // Fetch each post to read real title, post#, date
    list.innerHTML = '<p class="preview-empty">Loading post details…</p>';
    const details = await Promise.all(htmlFiles.map(async file => {
      try {
        const r = await ghFetch(`contents/posts/${file.name}`);
        if (!r.ok) return { file, title: file.name.replace('.html','').replace(/-/g,' '), postNum: '', date: '' };
        const j = await r.json();
        const html = decodeURIComponent(escape(atob(j.content.replace(/\n/g, ''))));
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const title = doc.querySelector('.post-entry-title')?.textContent?.trim()
          || file.name.replace('.html','').replace(/-/g,' ').replace(/\b\w/g, c => c.toUpperCase());
        const postNum = doc.querySelector('.post-tag')?.textContent?.trim() || '';
        const date = doc.querySelector('.post-date')?.textContent?.trim() || '';
        return { file, title, postNum, date };
      } catch(e) {
        return { file, title: file.name.replace('.html','').replace(/-/g,' '), postNum: '', date: '' };
      }
    }));

    // Sort newest first by post number
    details.sort((a, b) => {
      const na = parseInt(a.postNum.replace('Post #','')) || 0;
      const nb = parseInt(b.postNum.replace('Post #','')) || 0;
      return nb - na;
    });

    list.innerHTML = details.map(({ file, title, postNum, date }) => `
        <div class="post-list-item" onclick="loadPostForEditing('${file.name}', '${file.sha}')">
          <div class="post-list-meta">
            ${postNum ? `<span class="post-list-num">${postNum}</span>` : ''}
            ${date ? `<span class="post-list-date">${date}</span>` : ''}
          </div>
          <div class="post-list-title">${title}</div>
          <span class="post-list-arrow">Edit →</span>
        </div>`).join('');

  } catch (err) {
    list.innerHTML = `<p class="preview-empty" style="color:var(--red)">Error: ${err.message}</p>`;
  }
}

// ── Load a post for editing ───────────────────────────────────
async function loadPostForEditing(filename, sha) {
  editingSlug = filename.replace('.html', '');

  showStatus('Loading post…', false, true);

  try {
    const res = await ghFetch(`contents/posts/${filename}`);
    if (!res.ok) throw new Error('Could not fetch post');
    const json = await res.json();
    const html = decodeURIComponent(escape(atob(json.content.replace(/\n/g, ''))));
    editingFileSha = json.sha;

    // Parse the post
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const title = doc.querySelector('.post-entry-title')?.textContent?.trim() || '';
    const bodyEl = doc.querySelector('.post-body');
    const bodyHtml = bodyEl ? bodyEl.innerHTML : '';

    // Read existing location from fetched post HTML
    const locationEl = doc.querySelector('.post-location');
    let existingLocation = '';
    if (locationEl) {
      const link = locationEl.querySelector('a');
      if (link) {
        const label = link.textContent.replace('📍 ', '').trim();
        const href = link.getAttribute('href') || '';
        existingLocation = href && href !== '#' && label !== 'View on Maps'
          ? `${label} | ${href}`
          : href || label;
      } else {
        existingLocation = locationEl.textContent.replace('📍 ', '').trim();
      }
    }

    // ── Parse existing photos ──────────────────────────────────
    editPhotos = [];
    doc.querySelectorAll('.post-photo img, .gallery-item img').forEach(img => {
      const src = img.getAttribute('src') || '';
      const caption = img.closest('figure')?.querySelector('figcaption')?.textContent?.trim()
                   || img.getAttribute('alt') || '';
      if (src && !src.includes('youtube')) {
        // Normalize src — strip leading ../
        const normSrc = src.replace(/^\.\.\//, '');
        editPhotos.push({ src: normSrc, caption, isNew: false });
      }
    });

    // ── Parse existing YouTube videos ──────────────────────────
    editYtVideos = [];
    doc.querySelectorAll('.post-video iframe, .post-videos-grid iframe').forEach(iframe => {
      const src = iframe.getAttribute('src') || '';
      const idMatch = src.match(/embed\/([a-zA-Z0-9_-]{11})/);
      if (idMatch) {
        const vidId = idMatch[1];
        const caption = iframe.closest('.post-video')?.querySelector('.video-caption')?.textContent?.trim() || '';
        const label = (caption === 'Watch on YouTube →' || caption.includes('YouTube')) ? '' : caption;
        editYtVideos.push({ id: vidId, label });
      }
    });

    // Store original body as fallback
    editBodyHtml = bodyHtml;

    // ── Populate edit form ──────────────────────────────────────
    $('editTitle').value = title;
    setTimeout(() => { $('editBody').innerHTML = bodyHtml; }, 50);
    if ($('editLocation')) $('editLocation').value = existingLocation;
    $('editPostTitle').textContent = `Editing: ${title}`;

    // Render photo and video lists
    if (typeof renderEditPhotoList === 'function') renderEditPhotoList();
    if (typeof renderEditYtVideoList === 'function') renderEditYtVideoList();

    // Show edit form, hide list
    $('postsList').classList.add('hidden');
    $('editForm').classList.remove('hidden');

    // Wire up buttons
    $('backToListBtn').onclick = () => {
      $('editForm').classList.add('hidden');
      $('postsList').classList.remove('hidden');
      $('statusBar').classList.add('hidden');
      editPhotos = [];
      editYtVideos = [];
    };

    $('editPreviewBtn').onclick = () => {
      $('editPreviewBox').innerHTML = `
        <h2 class="p-title">${escHtml($('editTitle').value)}</h2>
        <div class="p-body">${$('editBody').innerHTML}</div>
      `;
    };

    $('saveEditBtn').onclick = () => savePostEdit(filename);

    $('statusBar').classList.add('hidden');

  } catch (err) {
    showStatus('✗ Error loading post: ' + err.message, true);
  }
}


// ── Edit photo management ─────────────────────────────────────
function renderEditPhotoList() {
  const list = $('editPhotoList');
  if (!list) return;
  if (editPhotos.length === 0) {
    list.innerHTML = '<p class="field-hint" style="margin:0 0 0.5rem;">No photos — add some below.</p>';
    return;
  }
  list.innerHTML = editPhotos.map((p, i) => `
    <div class="yt-video-item" style="align-items:flex-start;margin-bottom:0.5rem;">
      <img src="${p.isNew ? p.src : (p.src.startsWith('images/') ? '../' + p.src : p.src)}"
           style="width:80px;height:60px;object-fit:cover;border-radius:2px;flex-shrink:0;" alt="photo" />
      <div class="yt-video-meta" style="flex:1;">
        <span class="yt-video-id">${p.isNew ? 'New upload' : p.src.split('/').pop().substring(0,35)}</span>
        <input type="text" class="field-input" placeholder="Caption (optional)"
          style="margin-top:4px;padding:4px 8px;font-size:0.78rem;"
          value="${escHtml(p.caption || '')}"
          onchange="editPhotos[${i}].caption = this.value" />
      </div>
      <button type="button" class="img-btn remove" onclick="removeEditPhoto(${i})" title="Remove">✕</button>
    </div>`).join('');
}

function removeEditPhoto(idx) {
  editPhotos.splice(idx, 1);
  renderEditPhotoList();
}

function handleEditPhotoAdd(e) {
  const files = Array.from(e.target.files);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = ev => {
      editPhotos.push({ src: ev.target.result, caption: '', isNew: true, file, dataUrl: ev.target.result });
      renderEditPhotoList();
    };
    reader.readAsDataURL(file);
  });
  e.target.value = '';
}

// ── Edit YouTube management ───────────────────────────────────
function renderEditYtVideoList() {
  const list = $('editYtVideoList');
  if (!list) return;
  if (!editYtVideos || editYtVideos.length === 0) { list.innerHTML = ''; return; }
  list.innerHTML = editYtVideos.map(v => `
    <div class="yt-video-item">
      <img src="https://img.youtube.com/vi/${v.id}/mqdefault.jpg" class="yt-thumb" alt="thumbnail" />
      <div class="yt-video-meta">
        <span class="yt-video-id">${v.id}</span>
        ${v.label ? `<span class="yt-video-label">${escHtml(v.label)}</span>` : ''}
      </div>
      <button type="button" class="img-btn remove" onclick="removeEditYtVideo('${v.id}')">✕</button>
    </div>`).join('');
}

function addEditYtVideo() {
  const input = $('editYtVideoInput') ? $('editYtVideoInput').value.trim() : '';
  const label = $('editYtVideoLabel') ? $('editYtVideoLabel').value.trim() : '';
  const id = extractYouTubeId(input);
  if (!id) { alert('Could not find a valid YouTube video ID.'); return; }
  if (editYtVideos.find(v => v.id === id)) { alert('That video is already added.'); return; }
  editYtVideos.push({ id, label });
  if ($('editYtVideoInput')) $('editYtVideoInput').value = '';
  if ($('editYtVideoLabel')) $('editYtVideoLabel').value = '';
  renderEditYtVideoList();
}

function removeEditYtVideo(id) {
  editYtVideos = editYtVideos.filter(v => v.id !== id);
  renderEditYtVideoList();
}

// ── Save edited post ─────────────────────────────────────────
async function savePostEdit(filename) {
  const newTitle    = $('editTitle').value.trim();
  const newBody     = $('editBody').innerHTML.trim();
  const newLocation = $('editLocation') ? $('editLocation').value.trim() : '';

  if (!newTitle) { alert('Title cannot be empty'); return; }

  // Use stored body if editor is empty
  const bodyToSave = (newBody && newBody.trim() && newBody.trim() !== '<br>') ? newBody : editBodyHtml;
  if (!bodyToSave || !bodyToSave.trim()) {
    alert('Body is empty — not saving to protect content.'); return;
  }

  $('saveEditLabel').textContent = 'Saving…';
  $('saveEditBtn').disabled = true;
  showStatus('Fetching latest version…', false, true);

  try {
    // Always re-fetch latest from GitHub
    const latestFetch = await ghFetch(`contents/posts/${filename}`);
    if (!latestFetch.ok) throw new Error('Could not fetch latest post');
    const latestJson = await latestFetch.json();
    const originalHtml = decodeURIComponent(escape(atob(latestJson.content.replace(/\n/g, ''))));
    editingFileSha = latestJson.sha;

    // Parse into DOM — all changes through DOM, no string regex on content
    const parser = new DOMParser();
    const doc = parser.parseFromString(originalHtml, 'text/html');

    // ── Title ───────────────────────────────────────────────────
    const titleEl = doc.querySelector('.post-entry-title');
    if (titleEl) titleEl.textContent = newTitle;
    const titleTag = doc.querySelector('title');
    if (titleTag) titleTag.textContent = newTitle + ' — Emmerican Adventure';
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', newTitle + ' — Emmerican Adventure');

    // ── Location ─────────────────────────────────────────────────
    const existingLoc = doc.querySelector('.post-location');
    if (newLocation) {
      let locHtml = '';
      if (newLocation.startsWith('http') || newLocation.startsWith('maps.')) {
        locHtml = `<div class="post-location"><a href="${escHtml(newLocation)}" target="_blank" rel="noopener">📍 View on Maps</a></div>`;
      } else if (newLocation.includes('|')) {
        const parts = newLocation.split('|').map(s => s.trim());
        locHtml = `<div class="post-location"><a href="${escHtml(parts[1])}" target="_blank" rel="noopener">📍 ${escHtml(parts[0])}</a></div>`;
      } else {
        locHtml = `<div class="post-location">📍 ${escHtml(newLocation)}</div>`;
      }
      const locNode = parser.parseFromString(locHtml, 'text/html').body.firstChild;
      if (existingLoc) existingLoc.replaceWith(locNode);
      else titleEl?.insertAdjacentElement('afterend', locNode);
    } else if (existingLoc) {
      existingLoc.remove();
    }

    // ── Body ─────────────────────────────────────────────────────
    const bodyEl = doc.querySelector('.post-body');
    if (!bodyEl) throw new Error('Could not find post-body in HTML');
    bodyEl.innerHTML = '\n        ' + bodyToSave + '\n      ';

    // ── Upload new photos ─────────────────────────────────────────
    for (let i = 0; i < editPhotos.length; i++) {
      const p = editPhotos[i];
      if (p.isNew && p.file) {
        showStatus(`Uploading photo ${i+1}…`, false, true);
        const safeName = p.file.name.replace(/[^a-z0-9.]/gi, '-').toLowerCase().replace(/\.png$/i, '.jpg');
        const path = `images/${Date.now()}-${safeName}`;
        const compressed = await new Promise(resolve => {
          const image = new Image();
          image.onload = () => {
            const maxW = 1600;
            let w = image.width, h = image.height;
            if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(image, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.78).split(',')[1]);
          };
          image.src = p.dataUrl;
        });
        await uploadFile(path, compressed);
        editPhotos[i].src = path;
        editPhotos[i].isNew = false;
      }
    }

    // ── Rebuild photos in DOM ────────────────────────────────────
    doc.querySelectorAll('.post-photo, .post-gallery').forEach(el => el.remove());
    if (editPhotos.length > 0) {
      let photoHtml = '';
      if (editPhotos.length === 1) {
        const p = editPhotos[0];
        const src = p.src.startsWith('images/') ? '../' + p.src : p.src;
        photoHtml = `<figure class="post-photo"><img src="${escHtml(src)}" alt="${escHtml(p.caption || newTitle)}" />${p.caption ? `<figcaption>${escHtml(p.caption)}</figcaption>` : ''}</figure>`;
      } else {
        const gc = editPhotos.length === 2 ? 'gallery-2' : editPhotos.length === 3 ? 'gallery-3' : 'gallery-many';
        const items = editPhotos.map(p => {
          const src = p.src.startsWith('images/') ? '../' + p.src : p.src;
          return `<figure class="gallery-item"><img src="${escHtml(src)}" alt="${escHtml(p.caption || newTitle)}" />${p.caption ? `<figcaption>${escHtml(p.caption)}</figcaption>` : ''}</figure>`;
        }).join('');
        photoHtml = `<div class="post-gallery ${gc}">${items}</div>`;
      }
      const photoNode = parser.parseFromString(photoHtml, 'text/html').body.firstChild;
      bodyEl.parentNode.insertBefore(photoNode, bodyEl);
    }

    // ── Rebuild YouTube videos in DOM ────────────────────────────
    doc.querySelectorAll('.post-video, .post-videos-grid').forEach(el => el.remove());
    if (editYtVideos && editYtVideos.length > 0) {
      const makeVid = v => {
        const cap = v.label
          ? `<p class="video-caption">${escHtml(v.label)}</p>`
          : `<p class="video-caption">Watch on <a href="https://www.youtube.com/@EmmericanAdventure" target="_blank">YouTube →</a></p>`;
        return `<div class="post-video"><div class="video-embed-wrap"><iframe src="https://www.youtube.com/embed/${v.id}" title="${escHtml(v.label || newTitle)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>${cap}</div>`;
      };
      const vidHtml = editYtVideos.length > 1
        ? `<div class="post-videos-grid">${editYtVideos.map(makeVid).join('')}</div>`
        : makeVid(editYtVideos[0]);
      const vidNode = parser.parseFromString(vidHtml, 'text/html').body.firstChild;
      bodyEl.parentNode.insertBefore(vidNode, bodyEl);
    }

    // ── Serialize and push ───────────────────────────────────────
    const updated = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
    showStatus('Saving to GitHub…', false, true);

    const pushRes = await ghFetch(`contents/posts/${filename}`, 'PUT', {
      message: `Edit post: ${newTitle}`,
      content: btoa(unescape(encodeURIComponent(updated))),
      sha: editingFileSha,
      branch: CONFIG.branch,
    });

    if (!pushRes.ok) {
      const err = await pushRes.json();
      throw new Error(err.message || 'Save failed');
    }

    showStatus('✓ Post saved! Changes will be live in ~60 seconds.', false);

  } catch (err) {
    showStatus('✗ Error: ' + err.message, true);
  } finally {
    $('saveEditLabel').textContent = 'Save Changes →';
    $('saveEditBtn').disabled = false;
  }
}

// ── Edit toolbar (for the edit body editor) ───────────────────
function editToolbar(action) {
  $('editBody').focus();
  if (action === 'bold')   document.execCommand('bold');
  if (action === 'italic') document.execCommand('italic');
  if (action === 'h3')     document.execCommand('formatBlock', false, 'h3');
}



/* ═══════════════════════════════════════════════════════════════
   Adventures Admin — Supabase CRUD
   ═══════════════════════════════════════════════════════════════ */

const ADV_SUPABASE_URL  = 'https://azjwuraxixuioeddkicq.supabase.co';
const ADV_SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6and1cmF4aXh1aW9lZGRraWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTM4MTMsImV4cCI6MjA5Njk4OTgxM30._GuEJWGiRHktIeX6ukleM2s07V_W6pbMxIV8ntXjy44';
const ADV_ADMIN_ID      = '3fd413d3-d92d-440f-b0ff-ca98b36cf251';

let advAllEntries    = [];
let advFilterType    = 'all';

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Type toggle — show/hide restaurant-only fields
  $('advType')?.addEventListener('change', toggleAdvFields);

  // Reactions checkboxes toggle their selects
  ['Jason','Megan','John','Kate'].forEach(name => {
    $(`reaction${name}On`)?.addEventListener('change', e => {
      const sel = $(`reaction${name}`);
      if (sel) sel.disabled = !e.target.checked;
    });
    // Init disabled
    const sel = $(`reaction${name}`);
    if (sel) sel.disabled = true;
  });

  $('advSaveBtn')?.addEventListener('click', advSave);
  $('advCancelBtn')?.addEventListener('click', advCancelEdit);

  // Set default date to today
  if ($('advDate')) $('advDate').value = new Date().toISOString().split('T')[0];
});

function toggleAdvFields() {
  const type = $('advType')?.value;
  const fields = $('advRestaurantFields');
  if (fields) fields.style.display = type === 'restaurant' ? '' : 'none';
}

// ── Load all entries ──────────────────────────────────────────────
async function advAdminLoad() {
  const list = $('advAdminList');
  if (!list) return;
  list.innerHTML = '<p class="preview-empty">Loading…</p>';

  try {
    const res = await fetch(
      `${ADV_SUPABASE_URL}/rest/v1/adventures?select=*&order=visited_date.desc`,
      { headers: { 'apikey': ADV_SUPABASE_ANON, 'Authorization': `Bearer ${ADV_SUPABASE_ANON}` } }
    );
    if (!res.ok) throw new Error('Failed to load');
    advAllEntries = await res.json();
    advRenderList();
  } catch (err) {
    list.innerHTML = `<p class="preview-empty" style="color:var(--red)">Error: ${err.message}</p>`;
  }
}

function filterAdvAdmin(btn, type) {
  document.querySelectorAll('.adv-admin-filter .adv-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  advFilterType = type;
  advRenderList();
}

function advRenderList() {
  const list = $('advAdminList');
  if (!list) return;

  const filtered = advFilterType === 'all'
    ? advAllEntries
    : advAllEntries.filter(a => a.type === advFilterType);

  if (filtered.length === 0) {
    list.innerHTML = '<p class="preview-empty">No entries yet.</p>';
    return;
  }

  list.innerHTML = filtered.map(a => {
    const typeEmoji = { restaurant: '🍜', place: '📍', country: '🌏' }[a.type] || '•';
    const date = a.visited_date
      ? new Date(a.visited_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
    const loc = [a.location_city, a.location_country].filter(Boolean).join(', ');
    return `
      <div class="adv-admin-entry">
        <div class="adv-admin-entry-info">
          <span class="adv-admin-type">${typeEmoji}</span>
          <div>
            <strong>${escHtmlAdmin(a.name)}</strong>
            <span class="adv-admin-meta">${loc ? loc + ' · ' : ''}${date}</span>
          </div>
        </div>
        <div class="adv-admin-actions">
          <button class="btn-ghost btn-sm" onclick="advEdit('${a.id}')">Edit</button>
          <button class="btn-ghost btn-sm btn-danger" onclick="advDelete('${a.id}', '${escHtmlAdmin(a.name)}')">Delete</button>
        </div>
      </div>`;
  }).join('');
}

// ── Save (insert or update) ───────────────────────────────────────
async function advSave() {
  const editId = $('advEditId')?.value;
  const isEdit = !!editId;

  const name    = $('advName')?.value.trim();
  const type    = $('advType')?.value;
  if (!name)    { showStatus('Name is required.', true); return; }
  if (!type)    { showStatus('Type is required.', true); return; }

  // Build family_reactions object — only checked members
  const reactions = {};
  ['jason','megan','john','kate'].forEach(n => {
    const cap = n.charAt(0).toUpperCase() + n.slice(1);
    if ($(`reaction${cap}On`)?.checked) {
      reactions[n] = parseInt($(`reaction${cap}`)?.value || '5', 10);
    }
  });

  // Photos — one URL per line
  const photosRaw = $('advPhotos')?.value || '';
  const photos = photosRaw.split('\n').map(s => s.trim()).filter(Boolean);

  // Tags — comma separated
  const tagsRaw = $('advTags')?.value || '';
  const tags = tagsRaw.split(',').map(s => s.trim()).filter(Boolean);

  const payload = {
    type,
    name,
    location_city:    $('advCity')?.value.trim()    || null,
    location_country: $('advCountry')?.value.trim() || null,
    visited_date:     $('advDate')?.value            || null,
    cuisine:          type === 'restaurant' ? ($('advCuisine')?.value.trim()  || null) : null,
    price_range:      type === 'restaurant' ? ($('advPrice')?.value           || null) : null,
    rating:           type === 'restaurant' ? (parseFloat($('advRating')?.value) || null) : null,
    kid_friendly:     type === 'restaurant' ? ($('advKidFriendly')?.checked ?? null) : null,
    would_return:     type === 'restaurant' ? ($('advWouldReturn')?.checked  ?? null) : null,
    notes:            $('advNotes')?.value.trim()    || null,
    tags:             tags.length ? tags : null,
    photos:           photos.length ? photos : null,
    lat:              parseFloat($('advLat')?.value)  || null,
    lng:              parseFloat($('advLng')?.value)  || null,
    post_url:         $('advPostUrl')?.value.trim()   || null,
    family_reactions: Object.keys(reactions).length ? reactions : null,
    created_by:       ADV_ADMIN_ID,
  };

  const btn = $('advSaveBtn');
  $('advSaveLabel').textContent = isEdit ? 'Saving…' : 'Saving…';
  btn.disabled = true;

  try {
    let res;
    if (isEdit) {
      res = await fetch(
        `${ADV_SUPABASE_URL}/rest/v1/adventures?id=eq.${editId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': ADV_SUPABASE_ANON,
            'Authorization': `Bearer ${ADV_SUPABASE_ANON}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify(payload),
        }
      );
    } else {
      res = await fetch(
        `${ADV_SUPABASE_URL}/rest/v1/adventures`,
        {
          method: 'POST',
          headers: {
            'apikey': ADV_SUPABASE_ANON,
            'Authorization': `Bearer ${ADV_SUPABASE_ANON}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify(payload),
        }
      );
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    showStatus(`✓ Adventure ${isEdit ? 'updated' : 'saved'}!`, false);
    advResetForm();
    advAdminLoad();

  } catch (err) {
    showStatus('✗ Error: ' + err.message, true);
  } finally {
    $('advSaveLabel').textContent = 'Save Adventure →';
    btn.disabled = false;
  }
}

// ── Edit ──────────────────────────────────────────────────────────
function advEdit(id) {
  const a = advAllEntries.find(e => e.id === id);
  if (!a) return;

  $('advEditId').value     = a.id;
  $('advFormTitle').textContent = 'Edit Adventure';
  $('advType').value       = a.type;
  $('advName').value       = a.name || '';
  $('advCity').value       = a.location_city || '';
  $('advCountry').value    = a.location_country || '';
  $('advDate').value       = a.visited_date || '';
  $('advCuisine').value    = a.cuisine || '';
  $('advPrice').value      = a.price_range || '';
  $('advRating').value     = a.rating || '';
  $('advKidFriendly').checked  = !!a.kid_friendly;
  $('advWouldReturn').checked  = !!a.would_return;
  $('advNotes').value      = a.notes || '';
  $('advTags').value       = (a.tags || []).join(', ');
  $('advPhotos').value     = (a.photos || []).join('\n');
  $('advLat').value        = a.lat || '';
  $('advLng').value        = a.lng || '';
  $('advPostUrl').value    = a.post_url || '';

  // Family reactions
  ['jason','megan','john','kate'].forEach(n => {
    const cap = n.charAt(0).toUpperCase() + n.slice(1);
    const val = a.family_reactions?.[n];
    const checkbox = $(`reaction${cap}On`);
    const select   = $(`reaction${cap}`);
    if (checkbox) checkbox.checked = !!val;
    if (select) {
      select.disabled = !val;
      select.value = val || '5';
    }
  });

  toggleAdvFields();
  $('advCancelBtn').style.display = '';
  $('advSaveLabel').textContent   = 'Update Adventure →';

  // Scroll form into view
  document.querySelector('#panelAdventures .editor-panel')?.scrollIntoView({ behavior: 'smooth' });
}

// ── Delete ────────────────────────────────────────────────────────
async function advDelete(id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

  try {
    const res = await fetch(
      `${ADV_SUPABASE_URL}/rest/v1/adventures?id=eq.${id}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': ADV_SUPABASE_ANON,
          'Authorization': `Bearer ${ADV_SUPABASE_ANON}`,
          'Prefer': 'return=minimal',
        },
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showStatus(`✓ "${name}" deleted.`, false);
    advAdminLoad();
  } catch (err) {
    showStatus('✗ Delete failed: ' + err.message, true);
  }
}

// ── Cancel Edit ───────────────────────────────────────────────────
function advCancelEdit() {
  advResetForm();
}

function advResetForm() {
  $('advEditId').value          = '';
  $('advFormTitle').textContent  = 'New Adventure';
  $('advSaveLabel').textContent  = 'Save Adventure →';
  $('advCancelBtn').style.display = 'none';
  $('advName').value             = '';
  $('advCity').value             = '';
  $('advCountry').value          = '';
  $('advDate').value             = new Date().toISOString().split('T')[0];
  $('advCuisine').value          = '';
  $('advPrice').value            = '';
  $('advRating').value           = '';
  $('advKidFriendly').checked    = false;
  $('advWouldReturn').checked    = false;
  $('advNotes').value            = '';
  $('advTags').value             = '';
  $('advPhotos').value           = '';
  $('advLat').value              = '';
  $('advLng').value              = '';
  $('advPostUrl').value          = '';
  ['jason','megan','john','kate'].forEach(n => {
    const cap = n.charAt(0).toUpperCase() + n.slice(1);
    const cb = $(`reaction${cap}On`);
    const sel = $(`reaction${cap}`);
    if (cb)  cb.checked = false;
    if (sel) { sel.disabled = true; sel.value = '5'; }
  });
  toggleAdvFields();
}

function escHtmlAdmin(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}



/* ═══════════════════════════════════════════════════════════════
   Images Admin — Supabase CRUD for post_images table
   ═══════════════════════════════════════════════════════════════ */

const IMG_SUPABASE_URL  = 'https://azjwuraxixuioeddkicq.supabase.co';
const IMG_SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6and1cmF4aXh1aW9lZGRraWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTM4MTMsImV4cCI6MjA5Njk4OTgxM30._GuEJWGiRHktIeX6ukleM2s07V_W6pbMxIV8ntXjy44';
const IMG_ADMIN_ID      = '3fd413d3-d92d-440f-b0ff-ca98b36cf251';

let imgAllEntries = [];
let imgSearchDebounce;

// ── Load ──────────────────────────────────────────────────────────
async function imgAdminLoad() {
  const list = $('imgAdminList');
  if (!list) return;
  list.innerHTML = '<p class="preview-empty">Loading…</p>';

  try {
    const res = await fetch(
      `${IMG_SUPABASE_URL}/rest/v1/post_images?select=*&order=taken_date.desc,sort_order.asc`,
      { headers: { 'apikey': IMG_SUPABASE_ANON, 'Authorization': `Bearer ${IMG_SUPABASE_ANON}` } }
    );
    if (!res.ok) throw new Error('Failed to load');
    imgAllEntries = await res.json();
    imgRenderList();
  } catch (err) {
    list.innerHTML = `<p class="preview-empty" style="color:var(--red)">Error: ${err.message}</p>`;
  }

  // Bind search
  $('imgSearch')?.addEventListener('input', () => {
    clearTimeout(imgSearchDebounce);
    imgSearchDebounce = setTimeout(imgRenderList, 200);
  });
}

function imgRenderList() {
  const list = $('imgAdminList');
  if (!list) return;

  const query = ($('imgSearch')?.value || '').toLowerCase().trim();

  const filtered = imgAllEntries.filter(img => {
    if (!query) return true;
    const hay = [img.alt_text, img.post_url, ...(img.tags || [])].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(query);
  });

  $('imgCount').textContent = `${filtered.length} of ${imgAllEntries.length}`;

  if (filtered.length === 0) {
    list.innerHTML = '<p class="preview-empty">No images match.</p>';
    return;
  }

  list.innerHTML = filtered.map(img => {
    const tags = (img.tags || []).map(t => `<span class="adv-tag">${escHtmlAdmin(t)}</span>`).join('');
    const featured = img.featured ? '<span class="img-featured-badge">★ cover</span>' : '';
    const altDisplay = img.alt_text || '<span style="color:rgba(255,255,255,0.25);font-style:italic;">no alt text</span>';
    return `
      <div class="img-admin-entry ${img.id === $('imgEditId')?.value ? 'active' : ''}" onclick="imgEdit('${img.id}')">
        <div class="img-admin-thumb">
          <img src="${escHtmlAdmin(img.url)}" alt="${escHtmlAdmin(img.alt_text || '')}" loading="lazy" />
        </div>
        <div class="img-admin-info">
          <div class="img-admin-alt">${altDisplay} ${featured}</div>
          <div class="img-admin-post">${escHtmlAdmin(img.post_url || '—')}</div>
          <div class="img-admin-tags">${tags}</div>
        </div>
      </div>`;
  }).join('');
}

// ── Edit ──────────────────────────────────────────────────────────
function imgEdit(id) {
  const img = imgAllEntries.find(i => i.id === id);
  if (!img) return;

  $('imgEditId').value    = img.id;
  $('imgAltText').value   = img.alt_text || '';
  $('imgTags').value      = (img.tags || []).join(', ');
  $('imgPostUrl').value   = img.post_url || '';
  $('imgAdventureId').value = img.adventure_id || '';
  $('imgFeatured').checked  = !!img.featured;
  $('imgFormTitle').textContent = 'Edit Image';
  $('imgSaveLabel').textContent = 'Save Changes →';
  $('imgSaveBtn').disabled = false;
  $('imgCancelBtn').style.display = '';

  // Show preview
  const wrap = $('imgPreviewWrap');
  if (wrap) {
    wrap.innerHTML = `<img src="${escHtmlAdmin(img.url)}" alt="${escHtmlAdmin(img.alt_text || '')}"
      style="max-width:100%;max-height:200px;object-fit:contain;display:block;" />`;
  }

  // Highlight active row
  document.querySelectorAll('.img-admin-entry').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.img-admin-entry').forEach(el => {
    if (el.onclick?.toString().includes(id)) el.classList.add('active');
  });
}

// ── Save ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  $('imgSaveBtn')?.addEventListener('click', imgSave);
  $('imgCancelBtn')?.addEventListener('click', imgCancelEdit);
});

async function imgSave() {
  const id = $('imgEditId')?.value;
  if (!id) return;

  const tagsRaw = $('imgTags')?.value || '';
  const tags = tagsRaw.split(',').map(s => s.trim()).filter(Boolean);
  const adventureId = $('imgAdventureId')?.value.trim() || null;

  const payload = {
    alt_text:     $('imgAltText')?.value.trim()  || null,
    tags:         tags.length ? tags : null,
    post_url:     $('imgPostUrl')?.value.trim()  || null,
    adventure_id: adventureId,
    featured:     $('imgFeatured')?.checked ?? false,
  };

  $('imgSaveLabel').textContent = 'Saving…';
  $('imgSaveBtn').disabled = true;

  try {
    const res = await fetch(
      `${IMG_SUPABASE_URL}/rest/v1/post_images?id=eq.${id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': IMG_SUPABASE_ANON,
          'Authorization': `Bearer ${IMG_SUPABASE_ANON}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    showStatus('✓ Image updated!', false);
    imgCancelEdit();
    imgAdminLoad();

  } catch (err) {
    showStatus('✗ Error: ' + err.message, true);
  } finally {
    $('imgSaveLabel').textContent = 'Save Changes →';
    $('imgSaveBtn').disabled = false;
  }
}

function imgCancelEdit() {
  $('imgEditId').value      = '';
  $('imgAltText').value     = '';
  $('imgTags').value        = '';
  $('imgPostUrl').value     = '';
  $('imgAdventureId').value = '';
  $('imgFeatured').checked  = false;
  $('imgFormTitle').textContent  = 'Edit Image';
  $('imgSaveLabel').textContent  = 'Select an image to edit';
  $('imgSaveBtn').disabled  = true;
  $('imgCancelBtn').style.display = 'none';
  const wrap = $('imgPreviewWrap');
  if (wrap) wrap.innerHTML = '<span style="color:rgba(255,255,255,0.2);font-size:0.75rem;font-family:var(--font-mono);">Select an image →</span>';
  document.querySelectorAll('.img-admin-entry').forEach(el => el.classList.remove('active'));
}
