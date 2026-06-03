/* ═══════════════════════════════════════════════════════════════
   Japan Move — Admin Panel JS
   Multi-image support, rich text editor, YouTube, GitHub publish
   ═══════════════════════════════════════════════════════════════ */

// ── Config ────────────────────────────────────────────────────────
const CONFIG = {
  password:  'japan2026',   // !! CHANGE THIS to your own password !!
  owner:     'emmerjason-maker',
  repo:      'emmerican-adventure',
  branch:    'main',
  blogFile:  'blog.html',
  maxImages: 10,
  maxSizeMB: 5,
};

// ── State ─────────────────────────────────────────────────────────
// images = array of { id, file, dataUrl, name, caption }
let images      = [];
let githubToken = null;

const $ = id => document.getElementById(id);

// ── Startup ───────────────────────────────────────────────────────
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

// ── Events ────────────────────────────────────────────────────────
function bindEvents() {
  // Login
  $('loginBtn').addEventListener('click', handleLogin);
  ['loginPassword', 'loginToken'].forEach(id =>
    $(id).addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); })
  );

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

// ── Login ─────────────────────────────────────────────────────────
function handleLogin() {
  const pw    = $('loginPassword').value.trim();
  const token = $('loginToken').value.trim();

  if (pw !== CONFIG.password) {
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

// ── Preview ───────────────────────────────────────────────────────
function renderPreview() {
  const title    = $('postTitle').value.trim();
  const date     = $('postDate').value;
  const body     = $('postBody').innerHTML.trim();
  const ytId     = extractYouTubeId($('postYoutube').value.trim());
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
  const matches = html.match(/class="post-entry"/g);
  return matches ? matches.length : 0;
}

// ── Build post HTML for blog.html ─────────────────────────────────
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
        <div id="disqus_thread"></div>
        <script>
          var disqus_config = function () {
            this.page.url = window.location.href;
            this.page.identifier = window.location.pathname + window.location.search;
          };
          (function() {
            var d = document, s = d.createElement('script');
            s.src = 'https://emmericanadventure.disqus.com/embed.js';
            s.setAttribute('data-timestamp', +new Date());
            (d.head || d.body).appendChild(s);
          })();
        </script>
        <noscript>Please enable JavaScript to view comments.</noscript>
      </footer>

    </article>`;
}

// ── Publish ───────────────────────────────────────────────────────
async function handlePublish() {
  const title    = $('postTitle').value.trim();
  const date     = $('postDate').value;
  const body     = $('postBody').innerHTML.trim();
  const ytId     = extractYouTubeId($('postYoutube').value.trim());
  const linkUrl  = $('postLink').value.trim();
  const linkText = $('postLinkText').value.trim();

  if (!title) { alert('Please add a post title.'); return; }
  if (!body && !ytId && images.length === 0) {
    alert('Please add some content — body text, a video, or at least one photo.'); return;
  }

  setPublishing(true);
  showStatus('Uploading…', false, true);

  try {
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

    // 2. Fetch current blog.html
    showStatus('Updating blog…', false, true);
    const fileRes = await ghFetch(`contents/${CONFIG.blogFile}`);
    if (!fileRes.ok) throw new Error(`Could not fetch ${CONFIG.blogFile}: ${fileRes.status}`);
    const fileJson = await fileRes.json();
    const currentContent = decodeURIComponent(escape(atob(fileJson.content.replace(/\n/g, ''))));
    const sha = fileJson.sha;

    // 3. Count existing posts to determine post number
    const postNumber = countExistingPosts(currentContent) + 1;

    // 4. Build new post
    const newPost = buildPostHtml({ title, date, body, ytId, uploadedImages, linkUrl, linkText, postNumber });

    // 5. Insert before the template marker (newest posts on top)
    const marker = '<!-- ====== NEW POST — COPY FROM HERE ====== -->';
    let updated;
    if (currentContent.includes(marker)) {
      updated = currentContent.replace(marker, newPost + '\n\n    ' + marker);
    } else {
      updated = currentContent.replace('<article class="post-entry">', newPost + '\n\n    <article class="post-entry">');
    }

    // 6. Push updated blog.html
    const pushRes = await ghFetch(`contents/${CONFIG.blogFile}`, 'PUT', {
      message: `New post: ${title}`,
      content: btoa(unescape(encodeURIComponent(updated))),
      sha,
      branch: CONFIG.branch,
    });

    if (!pushRes.ok) {
      const err = await pushRes.json();
      throw new Error(err.message || 'GitHub push failed');
    }

    // 7. Update homepage featured post
    showStatus('Updating homepage…', false, true);
    await updateHomepageFeatured({ title, date, postNumber, uploadedImages, ytId });

    showStatus('✓ Published! Your post will be live in ~60 seconds.', false);
    resetForm();

  } catch (err) {
    console.error(err);
    showStatus('✗ Error: ' + err.message, true);
  } finally {
    setPublishing(false);
  }
}


// ── Update homepage featured post ────────────────────────────────
async function updateHomepageFeatured({ title, date, postNumber, uploadedImages, ytId }) {
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

    const newSection = `<section class="featured-post" id="journal">
      <div class="section-tag">Latest Post</div>
      <article class="featured-card">
        <div class="featured-card-img">
          ${newImg}
        </div>
        <div class="featured-card-body">
          <div class="post-meta">
            <span class="post-tag">Post #${postNumber}</span>
            <span class="post-date">${escHtml(fmtDate)}</span>
          </div>
          <h2 class="featured-title">${escHtml(title)}</h2>
          <p class="featured-excerpt">${escHtml(excerpt)}</p>
          <a href="blog.html" class="read-more">Read More <span>→</span></a>
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
  $('postYoutube').value  = '';
  $('postLink').value     = '';
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