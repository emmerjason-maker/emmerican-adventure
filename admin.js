/* ===============================================================
   Japan Move - Admin Panel JS
   Multi-image support, rich text editor, YouTube, GitHub publish
   =============================================================== */

// -- Config --------------------------------------------------------
// Password stored as SHA-256 hash - plain text never in source
const CONFIG = {
  passwordHash: 'b181ca2307e6900f3d218dcabd221d64d0296cffbac6fa70a89815e67a3a49b1',  // SHA-256 of password
  owner:     'emmerjason-maker',
  repo:      'emmerican-adventure',
  branch:    'main',
  blogFile:  'blog.html',
  maxImages: 10,
  maxSizeMB: 5,
};

// -- State ---------------------------------------------------------
// images = array of { id, file, dataUrl, name, caption }
let images      = [];
let githubToken = null;

const $ = id => document.getElementById(id);

// -- Startup -------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  $('postDate').value = new Date().toISOString().split('T')[0];

  const saved = localStorage.getItem('jm_gh_token');
  if (saved) $('loginToken').value = saved;

  if (sessionStorage.getItem('jm_authed') === '1') {
    githubToken = localStorage.getItem('jm_gh_token') || '';
    showAdmin();
  }

  bindEvents();
});

// -- Events --------------------------------------------------------
function bindEvents() {
  // Login
  $('loginBtn').addEventListener('click', handleLogin);
  ['loginPassword', 'loginToken'].forEach(id =>
    $(id).addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); })
  );

  // New post YouTube add button
  if ($('ytAddBtn')) $('ytAddBtn').addEventListener('click', addYtVideo);
  if ($('photoInput')) $('photoInput').addEventListener('change', e => handlePhotoFiles(e.target.files));

  // Edit form YouTube add button
  if ($('editYtAddBtn')) $('editYtAddBtn').addEventListener('click', addEditYtVideo);
  if ($('editPhotoInput')) $('editPhotoInput').addEventListener('change', handleEditPhotoAdd);

  // Logout
  $('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('jm_authed');
    location.reload();
  });

  // Toolbar
  document.querySelectorAll('.toolbar-btn').forEach(btn =>
    btn.addEventListener('click', () => handleToolbar(btn.dataset.action))
  );

  // Primary photo input (drop zone)
  $('photoInput').addEventListener('change', e => addFiles(e.target.files));
  $('photoInputMore').addEventListener('change', e => addFiles(e.target.files));

  // Drag & drop on zone
  const zone = $('uploadZone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    addFiles(e.dataTransfer.files);
  });

  $('previewBtn').addEventListener('click', renderPreview);
  $('publishBtn').addEventListener('click', handlePublish);
}

// -- Login ---------------------------------------------------------
async function handleLogin() {
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

// -- Toolbar -------------------------------------------------------
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

// -- Multi-image handling ------------------------------------------
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
      alert(`"${file.name}" is over ${CONFIG.maxSizeMB}MB and was skipped.`);
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

// -- YouTube ID extraction -----------------------------------------
function extractYouTubeId(input) {
  if (!input) return null;
  input = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  const match = input.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

// -- Edit form YouTube management ----------------------------------
function addEditYtVideo() {
  const input = $('editYtVideoInput').value.trim();
  const label = $('editYtVideoLabel').value.trim();
  const id = extractYouTubeId(input);
  if (!id) { alert('Could not find a valid YouTube video ID in that URL.'); return; }
  if (editYtVideos.find(v => v.id === id)) { alert('That video is already added.'); return; }
  editYtVideos.push({ id, label });
  $('editYtVideoInput').value = '';
  $('editYtVideoLabel').value = '';
  renderEditYtVideoList();
}

function removeEditYtVideo(id) {
  editYtVideos = editYtVideos.filter(v => v.id !== id);
  renderEditYtVideoList();
}

function renderEditYtVideoList() {
  const list = $('editYtVideoList');
  if (!list) return;
  if (editYtVideos.length === 0) { list.innerHTML = ''; return; }
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

// -- Edit form Photo management ------------------------------------
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

function removeEditPhoto(idx) {
  editPhotos.splice(idx, 1);
  renderEditPhotoList();
}

function renderEditPhotoList() {
  const list = $('editPhotoList');
  if (!list) return;
  if (editPhotos.length === 0) {
    list.innerHTML = '<p class="field-hint" style="margin:0 0 0.5rem;">No photos yet.</p>';
    return;
  }
  list.innerHTML = editPhotos.map((p, i) => `
    <div class="yt-video-item" style="align-items:flex-start;margin-bottom:0.5rem;">
      <img src="${p.src}" style="width:80px;height:60px;object-fit:cover;border-radius:2px;flex-shrink:0;" alt="photo" />
      <div class="yt-video-meta" style="flex:1;">
        <span class="yt-video-id">${p.isNew ? 'New upload' : decodeURIComponent(p.src.split('/').pop()).substring(0,35)}</span>
        <input type="text" class="field-input" placeholder="Caption (optional)"
          style="margin-top:4px;padding:4px 8px;font-size:0.78rem;"
          value="${escHtml(p.caption || '')}"
          onchange="editPhotos[${i}].caption = this.value" />
      </div>
      <button type="button" class="img-btn remove" onclick="removeEditPhoto(${i})" title="Remove">✕</button>
    </div>`).join('');
}

// -- Multi-YouTube management (new post) ---------------------------
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

// -- Preview -------------------------------------------------------
function renderPreview() {
  const title    = $('postTitle').value.trim();
  const date     = $('postDate').value;
  const body     = $('postBody').innerHTML.trim();
  const ytId     = ytVideos.length > 0 ? ytVideos[0].id : null;
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

// -- Count existing posts -----------------------------------------
function countExistingPosts(html) {
  const matches = html.match(/class="post-index-card"/g);
  return matches ? matches.length : 0;
}

// -- Build post HTML for blog.html ---------------------------------
function buildPostHtml({ title, date, body, ytId, uploadedImages, linkUrl, linkText, postNumber }) {
  const fmtDate = date
    ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })
    : '';
  const tag = `Post #${postNumber}`;

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
      // Single image - use figure
      const img = uploadedImages[0];
      galleryBlock = `
      <figure class="post-photo">
        <img src="${escHtml(img.path)}" alt="${escHtml(img.caption || title)}" />
        ${img.caption ? `<figcaption>${escHtml(img.caption)}</figcaption>` : ''}
      </figure>`;
    } else {
      // Multiple images - gallery grid
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
    <!-- ====== POST: ${escHtml(title)} - ${fmtDate} ====== -->
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



// -- Build individual post page HTML ------------------------------
function buildPostPage({ title, slug, date, postNumber, location, body, ytId, uploadedImages, linkUrl, linkText, isScheduled, seoExcerpt, prevPostSlug, prevPostTitle }) {
  const fmtDate = date
    ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })
    : '';

  // Build prev post link if provided
  const prevPostHtml = (prevPostSlug && prevPostTitle)
    ? `<a href="../posts/\${escHtml(prevPostSlug)}.html" class="read-more small" style="margin-left:auto;">Next: \${escHtml(prevPostTitle)} →</a>`
    : '';

  // Build location HTML - supports plain text, URL, or "Label | URL" format
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

  let linkBlock = linkUrl ? `<p><a href="${escHtml(linkUrl)}" target="_blank" rel="noopener">${escHtml(linkText || linkUrl)}</a></p>` : '';
  const autoExcerpt = body.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().substring(0, 155);
  const plainExcerpt = (seoExcerpt && seoExcerpt.trim()) ? seoExcerpt.trim() : autoExcerpt;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(title)} - Emmerican Adventure</title>
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
  <meta property="og:title" content="${escHtml(title)} - Emmerican Adventure" />
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
  <header class="site-header">
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
        <a href="../index.html#videos" class="nav-link">Videos</a>
        <a href="../index.html#photos" class="nav-link">Photos</a>
        <a href="../index.html#timeline" class="nav-link">Timeline</a>
      </nav>
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
        \${prevPostHtml}
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
      <div class="footer-copy">© 2026 Emmerican Adventure - Made with 愛 in Jacksonville, FL | As an Amazon Associate I earn from qualifying purchases.</div>
      <div class="footer-links">
        <a href="https://www.youtube.com/@EmmericanAdventure" target="_blank">YouTube</a>
      </div>
    </div>
  </footer>
  <script src="../main.js"></script>
</body>
</html>`;
}


// -- Update publish button label based on date -----------------
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
// -- Generate URL slug from title ---------------------------------
function slugify(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// -- Publish -------------------------------------------------------
async function handlePublish() {
  const title    = $('postTitle').value.trim();
  const date     = $('postDate').value;
  const location = $('postLocation') ? $('postLocation').value.trim() : '';
  const body     = $('postBody').innerHTML.trim();
  const ytId     = ytVideos.length > 0 ? ytVideos[0].id : null;
  const linkUrl  = $('postLink').value.trim();
  const linkText = $('postLinkText').value.trim();

  if (!title) { alert('Please add a post title.'); return; }
  if (!body && ytVideos.length === 0 && images.length === 0) {
    alert('Please add some content - body text, a video, or at least one photo.'); return;
  }

  // Check if post is scheduled (future date)
  const isScheduled = date && new Date(date + 'T00:00:00') > new Date();

  setPublishing(true);
  showStatus(isScheduled ? 'Scheduling post…' : 'Uploading…', false, true);

  try {
    const slug = slugify(title);

    // 1. Upload all images to GitHub (compressed)
    const uploadedImages = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      showStatus(`Optimizing & uploading photo ${i + 1} of ${images.length}…`, false, true);
      const safeName = img.name.replace(/[^a-z0-9.]/gi, '-').toLowerCase().replace(/\.png$/i, '.jpg');
      const path = `images/${Date.now()}-${safeName}`;
      // Compress via canvas, preserving EXIF orientation
      const compressed = await new Promise((resolve) => {
        // Read EXIF orientation from raw file bytes
        const getOrientation = (dataUrl) => {
          try {
            const bin = atob(dataUrl.split(',')[1]);
            const view = new DataView(new ArrayBuffer(bin.length));
            for (let i = 0; i < bin.length; i++) view.setUint8(i, bin.charCodeAt(i));
            if (view.getUint16(0, false) !== 0xFFD8) return 1;
            let offset = 2;
            while (offset < view.byteLength) {
              if (view.getUint16(offset, false) === 0xFFE1) {
                if (view.getUint32(offset += 2, false) !== 0x45786966) return 1;
                const little = view.getUint16(offset += 6, false) === 0x4949;
                offset += view.getUint32(offset + 4, little);
                const tags = view.getUint16(offset, little);
                offset += 2;
                for (let i = 0; i < tags; i++) {
                  if (view.getUint16(offset + (i * 12), little) === 0x0112)
                    return view.getUint16(offset + (i * 12) + 8, little);
                }
              } else if ((view.getUint16(offset, false) & 0xFF00) !== 0xFF00) break;
              else offset += view.getUint16(offset + 2, false) + 2;
            }
          } catch(e) {}
          return 1;
        };

        const orientation = getOrientation(img.dataUrl);
        const image = new Image();
        image.onload = () => {
          const maxW = 1600;
          let w = image.width, h = image.height;
          // Swap dimensions for 90/270 degree rotations
          const rotated = orientation >= 5 && orientation <= 8;
          let tw = rotated ? h : w, th = rotated ? w : h;
          if (tw > maxW) { th = Math.round(th * maxW / tw); tw = maxW; }
          const canvas = document.createElement('canvas');
          canvas.width = tw; canvas.height = th;
          const ctx = canvas.getContext('2d');
          // Apply orientation transform
          switch (orientation) {
            case 2: ctx.transform(-1, 0, 0, 1, tw, 0); break;
            case 3: ctx.transform(-1, 0, 0, -1, tw, th); break;
            case 4: ctx.transform(1, 0, 0, -1, 0, th); break;
            case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
            case 6: ctx.transform(0, 1, -1, 0, th, 0); break;
            case 7: ctx.transform(0, -1, -1, 0, th, tw); break;
            case 8: ctx.transform(0, -1, 1, 0, 0, tw); break;
          }
          // Scale to fit
          const scaleW = rotated ? h / image.height * th / h : tw / w;
          const scaleH = rotated ? w / image.width * tw / w : th / h;
          ctx.drawImage(image, 0, 0, image.width * scaleW, image.height * scaleH);
          resolve(canvas.toDataURL('image/jpeg', 0.78).split(',')[1]);
        };
        image.src = img.dataUrl;
      });
      await uploadFile(path, compressed);
      uploadedImages.push({ path, caption: img.caption });
    }

    // 1b. Sanitize post body - strip inline styles/fonts from editor paste
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
    const cardMarker = '<!-- ====== NEW POST INDEX CARD - COPY FROM HERE ====== -->';
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

    // 10. Update search index
    showStatus('Updating search index…', false, true);
    await updateSearchIndex({ title, slug, date, category, uploadedImages, body });

    // 11. Update related posts on existing posts
    showStatus('Updating related posts…', false, true);
    await updateRelatedPosts({ title, slug, date, category, uploadedImages });

    // 12. Update sitemap
    showStatus('Updating sitemap…', false, true);
    await updateSitemap({ slug, date });

    showStatus(isScheduled ? `✓ Scheduled! Post will go live on ${new Date(date + 'T00:00:00').toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'})}` : '✓ Published! Your post will be live in ~60 seconds.', false);
    resetForm();

  } catch (err) {
    console.error(err);
    showStatus('✗ Error: ' + err.message, true);
  } finally {
    setPublishing(false);
  }
}



// -- Update sitemap.xml -------------------------------------------
async function updateSitemap({ slug, date }) {
  try {
    const today = date || new Date().toISOString().split('T')[0];
    const newUrl = `https://emmericanadventure.com/posts/${slug}.html`;

    // Fetch current sitemap
    const fileRes = await ghFetch('contents/sitemap.xml');
    if (!fileRes.ok) throw new Error('Could not fetch sitemap.xml');
    const fileJson = await fileRes.json();
    const currentXml = decodeURIComponent(escape(atob(fileJson.content.replace(/\n/g, ''))));
    const sha = fileJson.sha;

    // Check if URL already exists
    if (currentXml.includes(newUrl)) return;

    // Insert new URL entry before closing </urlset>
    // Also update lastmod on homepage and blog entries
    const newEntry = `
  <url>
    <loc>${newUrl}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>

</urlset>`;

    const updatedXml = currentXml
      .replace(/<loc>https:\/\/emmericanadventure\.com\/<\/loc>\s*<lastmod>[^<]+<\/lastmod>/,
               `<loc>https://emmericanadventure.com/</loc>
    <lastmod>${today}</lastmod>`)
      .replace(/<loc>https:\/\/emmericanadventure\.com\/blog\.html<\/loc>\s*<lastmod>[^<]+<\/lastmod>/,
               `<loc>https://emmericanadventure.com/blog.html</loc>
    <lastmod>${today}</lastmod>`)
      .replace('</urlset>', newEntry);

    await ghFetch('contents/sitemap.xml', 'PUT', {
      message: `Update sitemap: add ${slug}`,
      content: btoa(unescape(encodeURIComponent(updatedXml))),
      sha,
      branch: CONFIG.branch,
    });
  } catch (err) {
    console.warn('Could not update sitemap:', err.message);
  }
}

// -- Update homepage featured post --------------------------------
async function updateHomepageFeatured({ title, date, postNumber, uploadedImages, ytId, slug }) {
  try {
    const fmtDate = date
      ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })
      : '';

    // Pick the best image - first uploaded image or a YouTube thumbnail
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


// -- Update photo grids on index.html and photos.html -------------
async function updatePhotoGrids({ title, uploadedImages }) {
  try {
    if (!uploadedImages || uploadedImages.length === 0) return;

    const newItems = uploadedImages.map(img => `
        <div class="photo-item" data-caption="${escHtml(title)}">
          <img src="${escHtml(img.path)}" alt="${escHtml(title)}" />
        </div>`).join('\n');

    const marker = '        <!-- ====== NEW PHOTOS INSERTED ABOVE THIS LINE ====== -->';

    // -- Update index.html (keep 6 most recent) --------------------
    const indexRes = await ghFetch('contents/index.html');
    if (!indexRes.ok) throw new Error('Could not fetch index.html');
    const indexJson = await indexRes.json();
    const indexHtml = decodeURIComponent(escape(atob(indexJson.content.replace(/\n/g, ''))));
    const indexSha = indexJson.sha;

    if (indexHtml.includes(marker)) {
      let updated = indexHtml.replace(marker, newItems + '\n' + marker);

      // Trim to 6 most recent photo-items
      const gridStart = updated.indexOf('<!-- ====== PHOTO GRID');
      const gridEnd = updated.indexOf('<!-- ====== NEW PHOTOS INSERTED');
      const gridContent = updated.substring(gridStart, gridEnd);
      const itemMatches = [...gridContent.matchAll(/<div class="photo-item"[\s\S]*?<\/div>\s*<\/div>/g)];
      if (itemMatches.length > 6) {
        // Remove oldest (they're at the bottom, we insert at top)
        const toRemove = itemMatches.slice(6);
        let trimmed = updated;
        for (const match of toRemove) {
          trimmed = trimmed.replace(match[0], '');
        }
        updated = trimmed;
      }

      await ghFetch('contents/index.html', 'PUT', {
        message: `Add photo to homepage grid: ${title}`,
        content: btoa(unescape(encodeURIComponent(updated))),
        sha: indexSha,
        branch: CONFIG.branch,
      });
    }

    // -- Update photos.html (keep all) ----------------------------
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


// -- Update search index in search.html ---------------------------
async function updateSearchIndex({ title, slug, date, category, uploadedImages, body }) {
  try {
    const searchRes = await ghFetch('contents/search.html');
    if (!searchRes.ok) return;
    const searchJson = await searchRes.json();
    const searchHtml = decodeURIComponent(escape(atob(searchJson.content.replace(/\n/g, ''))));
    const searchSha = searchJson.sha;

    const plainBody = body.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const excerpt = plainBody.substring(0, 120) + (plainBody.length > 120 ? '…' : '');
    const keywords = [title, category, ...plainBody.split(' ').slice(0, 20)].join(' ').toLowerCase();
    const img = (uploadedImages && uploadedImages.length > 0)
      ? `images/${uploadedImages[0].path.split('/').pop()}`
      : 'images/og-image.jpg';

    const newEntry = `      {
        slug: '${slug.replace(/'/g,"\\'")}',
        title: '${title.replace(/'/g,"\\'")}',
        excerpt: '${excerpt.replace(/'/g,"\\'").replace(/\n/g,' ')}',
        date: '${date}',
        tag: '${category}',
        img: '${img}',
        keywords: '${keywords.replace(/'/g,"\\'")}',
      },`;

    const marker = 'const POSTS = [';
    if (searchHtml.includes(marker)) {
      const updated = searchHtml.replace(marker, marker + '\n' + newEntry);
      await ghFetch('contents/search.html', 'PUT', {
        message: `feat: add ${title} to search index`,
        content: btoa(unescape(encodeURIComponent(updated))),
        sha: searchSha,
        branch: CONFIG.branch,
      });
    }
  } catch (err) {
    console.warn('Could not update search index:', err.message);
  }
}

// -- Auto-update related posts on existing post files -------------
async function updateRelatedPosts({ title, slug, date, category, uploadedImages }) {
  try {
    const blogRes = await ghFetch('contents/blog.html');
    if (!blogRes.ok) return;
    const blogJson = await blogRes.json();
    const blogHtml = decodeURIComponent(escape(atob(blogJson.content.replace(/\n/g, ''))));

    const slugMatches = [...blogHtml.matchAll(/href="posts\/([^"]+)\.html"/g)];
    const existingSlugs = slugMatches.map(m => m[1]).filter(s => s !== slug).slice(0, 4);
    if (existingSlugs.length === 0) return;

    const img = (uploadedImages && uploadedImages.length > 0)
      ? `../images/${uploadedImages[0].path.split('/').pop()}`
      : '../images/og-image.jpg';

    const newCard = `        <a href="../posts/${slug}.html" class="related-card">
          <div class="related-card-img"><img src="${img}" alt="${escHtml(title)}" loading="lazy" /></div>
          <div class="related-card-body">
            <div class="post-meta"><span class="post-tag">${escHtml(category)}</span><span class="post-date">${escHtml(date)}</span></div>
            <div class="related-card-title">${escHtml(title)}</div>
          </div>
        </a>`;

    for (const existingSlug of existingSlugs) {
      try {
        const postRes = await ghFetch(`contents/posts/${existingSlug}.html`);
        if (!postRes.ok) continue;
        const postJson = await postRes.json();
        let postHtml = decodeURIComponent(escape(atob(postJson.content.replace(/\n/g, ''))));
        const postSha = postJson.sha;

        const gridStart = postHtml.indexOf('<div class="related-grid">');
        if (gridStart === -1) continue;
        const gridEnd = postHtml.indexOf('</div>', gridStart) + 6;
        const gridContent = postHtml.substring(gridStart, gridEnd);
        const cardCount = (gridContent.match(/class="related-card"/g) || []).length;

        let newGrid;
        if (cardCount >= 2) {
          const lastIdx = gridContent.lastIndexOf('<a href="../posts/');
          newGrid = '<div class="related-grid">\n' + newCard + '\n' + gridContent.substring('<div class="related-grid">\n'.length, lastIdx) + '\n        </div>';
        } else {
          newGrid = gridContent.replace('<div class="related-grid">', '<div class="related-grid">\n' + newCard);
        }

        postHtml = postHtml.substring(0, gridStart) + newGrid + postHtml.substring(gridEnd);
        await ghFetch(`contents/posts/${existingSlug}.html`, 'PUT', {
          message: `feat: add ${title} to related posts`,
          content: btoa(unescape(encodeURIComponent(postHtml))),
          sha: postSha,
          branch: CONFIG.branch,
        });
      } catch(e) { console.warn('related posts error:', e.message); }
    }
  } catch (err) {
    console.warn('Could not update related posts:', err.message);
  }
}

// -- GitHub helpers ------------------------------------------------
async function uploadFile(path, base64Content) {
  // Auto-fetch existing SHA so re-publishing or re-uploading never fails
  let sha;
  try {
    const existing = await ghFetch(`contents/${path}`);
    if (existing.ok) {
      const data = await existing.json();
      sha = data.sha;
    }
  } catch(e) { /* new file, no SHA needed */ }

  const body = {
    message: `Upload: ${path}`,
    content: base64Content,
    branch: CONFIG.branch,
  };
  if (sha) body.sha = sha;

  const res = await ghFetch(`contents/${path}`, 'PUT', body);
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

// -- UI helpers ----------------------------------------------------
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
  ytVideos = []; if ($('ytVideoList')) renderYtVideoList();
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
// ===============================================================
// EDIT POSTS FEATURE
// ===============================================================

let editingSlug  = null;
let editingFileSha = null;
let editYtVideos  = [];
let editPhotos    = [];
let editBodyHtml  = '';

// -- Tab switching ---------------------------------------------
function switchTab(tab) {
  const panelNew  = $('panelNew');
  const panelEdit = $('panelEdit');
  const tabNew    = $('tabNew');
  const tabEdit   = $('tabEdit');

  if (tab === 'new') {
    panelNew.classList.remove('hidden');
    panelEdit.classList.add('hidden');
    tabNew.classList.add('active');
    tabEdit.classList.remove('active');
  } else {
    panelNew.classList.add('hidden');
    panelEdit.classList.remove('hidden');
    tabNew.classList.remove('active');
    tabEdit.classList.add('active');
    loadPostsList();
  }
}

// -- Load list of posts from /posts/ folder --------------------
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

    // Fetch each post to get real title, date, post number
    list.innerHTML = '<p class="preview-empty">Loading post details…</p>';
    const postDetails = await Promise.all(htmlFiles.map(async file => {
      try {
        const r = await ghFetch(`contents/posts/${file.name}`);
        if (!r.ok) return { file, title: file.name, date: '', postNum: '' };
        const j = await r.json();
        const html = decodeURIComponent(escape(atob(j.content.replace(/\n/g, ''))));
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const title = doc.querySelector('.post-entry-title')?.textContent?.trim()
          || file.name.replace('.html','').replace(/-/g,' ').replace(/\b\w/g, c => c.toUpperCase());
        const postNum = doc.querySelector('.post-tag')?.textContent?.trim() || '';
        const date = doc.querySelector('.post-date')?.textContent?.trim() || '';
        return { file, title, date, postNum };
      } catch(e) {
        return { file, title: file.name, date: '', postNum: '' };
      }
    }));

    // Sort newest first (by post number descending)
    postDetails.sort((a, b) => {
      const na = parseInt(a.postNum.replace('Post #','')) || 0;
      const nb = parseInt(b.postNum.replace('Post #','')) || 0;
      return nb - na;
    });

    list.innerHTML = postDetails.map(({ file, title, date, postNum }) => `
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

// -- Load a post for editing -----------------------------------
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
    editBodyHtml = bodyHtml;

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

    // Parse existing photos from post
    editPhotos = [];
    doc.querySelectorAll('.post-photo img, .post-gallery img').forEach(img => {
      const src = img.getAttribute('src') || '';
      const caption = img.closest('figure')?.querySelector('figcaption')?.textContent?.trim()
                   || img.getAttribute('alt') || '';
      if (src && !src.includes('youtube')) {
        editPhotos.push({ src, caption, isNew: false });
      }
    });

    // Parse existing YouTube videos from post
    editYtVideos = [];
    const iframes = doc.querySelectorAll('.post-video iframe');
    iframes.forEach(iframe => {
      const src = iframe.getAttribute('src') || '';
      const idMatch = src.match(/embed\/([a-zA-Z0-9_-]{11})/);
      if (idMatch) {
        const vidId = idMatch[1];
        const caption = iframe.closest('.post-video')?.querySelector('.video-caption')?.textContent?.trim() || '';
        const label = caption === 'Watch on YouTube →' ? '' : caption;
        editYtVideos.push({ id: vidId, label });
      }
    });

    // Populate edit form
    $('editTitle').value = title;
    $('editBody').innerHTML = bodyHtml;
    if ($('editLocation')) $('editLocation').value = existingLocation;
    renderEditYtVideoList();
    renderEditPhotoList();
    $('editPostTitle').textContent = `Editing: ${title}`;

    // Show edit form, hide list
    $('postsList').classList.add('hidden');
    $('editForm').classList.remove('hidden');

    // Wire up buttons
    $('backToListBtn').onclick = () => {
      $('editForm').classList.add('hidden');
      $('postsList').classList.remove('hidden');
      $('statusBar').classList.add('hidden');
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

// -- Save edited post ------------------------------------------
async function savePostEdit(filename) {
  const newTitle    = $('editTitle').value.trim();
  const newBody     = $('editBody').innerHTML.trim();
  const newLocation = $('editLocation') ? $('editLocation').value.trim() : '';

  if (!newTitle) { alert('Title cannot be empty'); return; }

  // Use stored original if editor is empty
  const bodyToSave = (newBody && newBody.trim() && newBody.trim() !== '<br>')
    ? newBody : editBodyHtml;

  if (!bodyToSave || !bodyToSave.trim()) {
    alert('Body is empty — not saving to protect your content.');
    return;
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

    // Parse into DOM — do ALL changes through the DOM, no string regex on content
    const parser = new DOMParser();
    const doc = parser.parseFromString(originalHtml, 'text/html');

    // ── Title ────────────────────────────────────────────────────
    const titleEl = doc.querySelector('.post-entry-title');
    if (titleEl) titleEl.textContent = newTitle;
    const titleTag = doc.querySelector('title');
    if (titleTag) titleTag.textContent = newTitle + ' - Emmerican Adventure';
    // og:title
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', newTitle + ' - Emmerican Adventure');

    // ── Location ─────────────────────────────────────────────────
    const existingLoc = doc.querySelector('.post-location');
    if (newLocation) {
      let locHtml = '';
      if (newLocation.startsWith('http') || newLocation.startsWith('maps.')) {
        locHtml = `<div class="post-location"><a href="${newLocation}" target="_blank" rel="noopener">📍 View on Maps</a></div>`;
      } else if (newLocation.includes('|')) {
        const parts = newLocation.split('|').map(s => s.trim());
        locHtml = `<div class="post-location"><a href="${parts[1]}" target="_blank" rel="noopener">📍 ${parts[0]}</a></div>`;
      } else {
        locHtml = `<div class="post-location">📍 ${newLocation}</div>`;
      }
      const locDiv = parser.parseFromString(locHtml, 'text/html').body.firstChild;
      if (existingLoc) {
        existingLoc.replaceWith(locDiv);
      } else {
        titleEl?.insertAdjacentElement('afterend', locDiv);
      }
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
        editPhotos[i].src = `../${path}`;
        editPhotos[i].isNew = false;
      }
    }

    // ── Rebuild photos in DOM ────────────────────────────────────
    // Remove existing photo blocks
    doc.querySelectorAll('.post-photo, .post-gallery').forEach(el => el.remove());
    // Build new photo HTML and insert before post-body
    if (editPhotos.length > 0) {
      let photoHtml = '';
      if (editPhotos.length === 1) {
        const p = editPhotos[0];
        photoHtml = `<figure class="post-photo"><img src="${p.src}" alt="${p.caption || newTitle}" />${p.caption ? `<figcaption>${p.caption}</figcaption>` : ''}</figure>`;
      } else {
        const gc = editPhotos.length === 2 ? 'gallery-2' : editPhotos.length === 3 ? 'gallery-3' : 'gallery-4';
        const items = editPhotos.map(p =>
          `<figure class="gallery-item"><img src="${p.src}" alt="${p.caption || newTitle}" />${p.caption ? `<figcaption>${p.caption}</figcaption>` : ''}</figure>`
        ).join('');
        photoHtml = `<div class="post-gallery ${gc}">${items}</div>`;
      }
      const photoNode = parser.parseFromString(photoHtml, 'text/html').body.firstChild;
      bodyEl.parentNode.insertBefore(photoNode, bodyEl);
    }

    // ── Rebuild YouTube videos in DOM ────────────────────────────
    doc.querySelectorAll('.post-video, .post-videos-grid').forEach(el => el.remove());
    if (editYtVideos.length > 0) {
      const makeVidEdit = v => {
        const cap = v.label
          ? `<p class="video-caption">${v.label}</p>`
          : `<p class="video-caption">Watch on <a href="https://www.youtube.com/@EmmericanAdventure" target="_blank">YouTube →</a></p>`;
        return `<div class="post-video"><div class="video-embed-wrap"><iframe src="https://www.youtube.com/embed/${v.id}" title="${v.label || newTitle}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>${cap}</div>`;
      };
      const vidContainerHtml = editYtVideos.length > 1
        ? `<div class="post-videos-grid">${editYtVideos.map(makeVidEdit).join('')}</div>`
        : makeVidEdit(editYtVideos[0]);
      const vidNode = parser.parseFromString(vidContainerHtml, 'text/html').body.firstChild;
      bodyEl.parentNode.insertBefore(vidNode, bodyEl);
    }

    // ── Preserve footer links ────────────────────────────────────
    // (already preserved since we're editing the original DOM)

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


// -- Edit toolbar (for the edit body editor) -------------------
function editToolbar(action) {
  $('editBody').focus();
  if (action === 'bold')   document.execCommand('bold');
  if (action === 'italic') document.execCommand('italic');
  if (action === 'h3')     document.execCommand('formatBlock', false, 'h3');
}