// ── Scroll-based reveal animations ─────────────────────────────
const style = document.createElement('style');
style.textContent = `.visible { opacity: 1 !important; transform: translateY(0) !important; }`;
document.head.appendChild(style);

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

document.addEventListener('DOMContentLoaded', () => {
  const revealEls = document.querySelectorAll('.post-card, .featured-card, .timeline-item, .video-card, .photo-item');
  revealEls.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = `opacity 0.6s ease ${i * 0.05}s, transform 0.6s ease ${i * 0.05}s`;
    observer.observe(el);
  });

  // ── Active nav link on scroll ─────────────────────────────────
  const sections = document.querySelectorAll('section[id], footer[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => sectionObserver.observe(s));

  // ── Mobile menu ───────────────────────────────────────────────
  const menuBtn = document.querySelector('.mobile-menu-btn');
  const nav = document.querySelector('.nav');
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', () => {
      const isOpen = nav.classList.contains('mobile-open');
      nav.classList.toggle('mobile-open', !isOpen);
      nav.style.cssText = isOpen
        ? ''
        : 'display:flex; flex-direction:column; position:fixed; top:70px; left:0; right:0; background:var(--paper); border-bottom:1px solid var(--paper-dark); padding:1rem 2rem; gap:0.5rem; z-index:99;';
    });
  }

  // ── Photo lightbox ────────────────────────────────────────────
  const lightbox    = document.getElementById('lightbox');
  const lbImg       = document.getElementById('lightboxImg');
  const lbCaption   = document.getElementById('lightboxCaption');
  const lbClose     = document.getElementById('lightboxClose');
  const lbPrev      = document.getElementById('lightboxPrev');
  const lbNext      = document.getElementById('lightboxNext');

  // Collect only photo items that have a real <img> inside (not placeholders)
  let photoItems = [];
  let currentIdx = 0;

  function buildPhotoList() {
    photoItems = Array.from(document.querySelectorAll('.photo-item')).filter(item => item.querySelector('img'));
  }

  function openLightbox(idx) {
    buildPhotoList();
    if (photoItems.length === 0) return;
    currentIdx = idx;
    const img = photoItems[currentIdx].querySelector('img');
    lbImg.src = img.src;
    lbImg.alt = img.alt;
    lbCaption.textContent = photoItems[currentIdx].dataset.caption || img.alt;
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  function navigate(dir) {
    currentIdx = (currentIdx + dir + photoItems.length) % photoItems.length;
    const img = photoItems[currentIdx].querySelector('img');
    lbImg.src = img.src;
    lbCaption.textContent = photoItems[currentIdx].dataset.caption || img.alt;
  }

  // Click on photo items
  document.querySelectorAll('.photo-item').forEach((item, i) => {
    item.addEventListener('click', () => {
      buildPhotoList();
      // Find index among real photos
      const realIdx = photoItems.indexOf(item);
      if (realIdx > -1) openLightbox(realIdx);
    });
  });

  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lbPrev)  lbPrev.addEventListener('click', () => navigate(-1));
  if (lbNext)  lbNext.addEventListener('click', () => navigate(1));

  lightbox && lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', e => {
    if (!lightbox || !lightbox.classList.contains('open')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });
});

// ── Post Image Lightbox ───────────────────────────────────────────
(function() {
  let plbImages = [];
  let plbIdx = 0;

  function injectLightbox() {
    if (document.getElementById('postLightbox')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="post-lightbox" id="postLightbox">
        <button class="post-lightbox-close" id="plbClose">✕</button>
        <div class="post-lightbox-counter" id="plbCounter"></div>
        <button class="post-lightbox-prev" id="plbPrev">‹</button>
        <div class="post-lightbox-img-wrap">
          <img id="plbImg" src="" alt="" />
        </div>
        <button class="post-lightbox-next" id="plbNext">›</button>
        <div class="post-lightbox-caption" id="plbCaption"></div>
      </div>
    `);
    document.getElementById('plbClose').addEventListener('click', closePlb);
    document.getElementById('plbPrev').addEventListener('click', () => navPlb(-1));
    document.getElementById('plbNext').addEventListener('click', () => navPlb(1));
    document.getElementById('postLightbox').addEventListener('click', (e) => {
      if (e.target.id === 'postLightbox') closePlb();
    });
  }

  function collectImages(clickedImg) {
    const article = clickedImg.closest('article') || document.querySelector('.blog-main');
    if (article) {
      plbImages = Array.from(article.querySelectorAll('.gallery-item img, .post-photo img, figure img'));
    }
    if (plbImages.length === 0) plbImages = [clickedImg];
    return plbImages.indexOf(clickedImg);
  }

  function openPlb(img) {
    injectLightbox();
    const idx = collectImages(img);
    plbIdx = idx >= 0 ? idx : 0;
    showPlb();
    document.getElementById('postLightbox').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function showPlb() {
    const img = plbImages[plbIdx];
    document.getElementById('plbImg').src = img.src;
    document.getElementById('plbImg').alt = img.alt;
    document.getElementById('plbCaption').textContent =
      img.closest('figure')?.querySelector('figcaption')?.textContent || img.alt || '';
    document.getElementById('plbCounter').textContent =
      plbImages.length > 1 ? `${plbIdx + 1} / ${plbImages.length}` : '';
    document.getElementById('plbPrev').style.display = plbImages.length > 1 ? '' : 'none';
    document.getElementById('plbNext').style.display = plbImages.length > 1 ? '' : 'none';
  }

  function closePlb() {
    document.getElementById('postLightbox').classList.remove('open');
    document.body.style.overflow = '';
  }

  function navPlb(dir) {
    plbIdx = (plbIdx + dir + plbImages.length) % plbImages.length;
    showPlb();
  }

  document.addEventListener('click', (e) => {
    const img = e.target.closest('.gallery-item img, .post-photo img, figure img');
    if (img) { e.preventDefault(); openPlb(img); }
  });

  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('postLightbox')?.classList.contains('open')) return;
    if (e.key === 'Escape')     closePlb();
    if (e.key === 'ArrowLeft')  navPlb(-1);
    if (e.key === 'ArrowRight') navPlb(1);
  });
})();

// ── Scheduled Posts — auto-reveal when publish date arrives ──────
(function() {
  document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    document.querySelectorAll('.post-scheduled[data-publish-date]').forEach(card => {
      const publishDate = new Date(card.dataset.publishDate + 'T00:00:00');
      if (publishDate <= today) {
        // Date has arrived — convert to normal clickable card
        const slug = card.querySelector('a[href]')?.getAttribute('href');
        if (slug) {
          card.classList.remove('post-scheduled');
          card.removeAttribute('data-publish-date');
        }
      }
    });
  });
})();
