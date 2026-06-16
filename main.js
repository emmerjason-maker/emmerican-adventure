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

  function openMobileNav() {
    nav.classList.add('mobile-open');
    nav.style.cssText = 'display:flex; flex-direction:column; position:fixed; top:70px; left:0; right:0; background:var(--paper); border-top:2px solid var(--red); border-bottom:1px solid var(--paper-dark); padding:1.25rem 2rem; gap:0; z-index:9999; box-shadow: 0 8px 24px rgba(0,0,0,0.12);';
    // Style each nav link for mobile
    nav.querySelectorAll('.nav-link').forEach(l => {
      l.style.cssText = 'display:block; padding:0.85rem 0; border-bottom:1px solid var(--paper-dark); border-radius:0; width:100%; color:inherit; text-decoration:none;';
    });
    menuBtn.textContent = '✕';
    menuBtn.setAttribute('aria-label', 'Close menu');
  }

  function closeMobileNav() {
    nav.classList.remove('mobile-open');
    nav.style.cssText = '';
    nav.querySelectorAll('.nav-link').forEach(l => { l.style.cssText = ''; });
    menuBtn.textContent = '☰';
    menuBtn.setAttribute('aria-label', 'Menu');
  }

  if (menuBtn && nav) {
    menuBtn.addEventListener('click', () => {
      nav.classList.contains('mobile-open') ? closeMobileNav() : openMobileNav();
    });

    // Dismiss when any nav link is tapped
    nav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => closeMobileNav());
    });

    // Dismiss when tapping outside
    document.addEventListener('click', e => {
      if (nav.classList.contains('mobile-open') &&
          !nav.contains(e.target) &&
          e.target !== menuBtn) {
        closeMobileNav();
      }
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

  // ── Post image lightbox ──────────────────────────────────────
  // Collect all post images for prev/next navigation
  window.openPostLightbox = function(imgEl) {
    const allImgs = Array.from(document.querySelectorAll(
      '.post-photo img, .gallery-item img'
    ));
    const idx = allImgs.indexOf(imgEl);
    window._lightboxItems = allImgs.map(i => ({
      src: i.src,
      caption: i.closest('figure')?.querySelector('figcaption')?.textContent
             || i.getAttribute('alt') || ''
    }));
    window._lightboxIndex = idx >= 0 ? idx : 0;

    const lb = document.getElementById('lightbox');
    const lbImg = document.getElementById('lightboxImg');
    const lbCap = document.getElementById('lightboxCaption');
    if (!lb || !lbImg) return;

    const item = window._lightboxItems[window._lightboxIndex];
    lbImg.src = item.src;
    lbImg.alt = item.caption;
    if (lbCap) lbCap.textContent = item.caption;
    lb.classList.add('open');
  };


  // ── Header search toggle ──────────────────────────────────────
  const searchBtn  = document.querySelector('.search-toggle');
  const searchBar  = document.querySelector('.header-search-bar');
  const searchInput = document.querySelector('.header-search-input');

  if (searchBtn && searchBar && searchInput) {
    searchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = searchBar.classList.contains('open');
      if (isOpen) {
        closeSearch();
      } else {
        openSearch();
      }
    });

    function openSearch() {
      searchBar.classList.add('open');
      searchBtn.setAttribute('aria-label', 'Close search');
      searchBtn.setAttribute('aria-expanded', 'true');
      // On mobile, close nav if open
      if (nav?.classList.contains('mobile-open')) closeMobileNav();
      setTimeout(() => searchInput.focus(), 50);
    }

    function closeSearch() {
      searchBar.classList.remove('open');
      searchBtn.setAttribute('aria-label', 'Search');
      searchBtn.setAttribute('aria-expanded', 'false');
      searchInput.value = '';
    }

    // X button inside the search bar
    const searchClose = document.querySelector('.header-search-close');
    if (searchClose) searchClose.addEventListener('click', closeSearch);

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        if (q) {
          // Resolve search.html relative to site root, works from any subdirectory
          const depth = window.location.pathname.split('/').filter(Boolean).length;
          const prefix = window.location.pathname.startsWith('/posts/') ? '../' : '';
          window.location.href = `${prefix}search.html?q=${encodeURIComponent(q)}`;
        }
      }
      if (e.key === 'Escape') closeSearch();
    });

    // Dismiss on outside click
    document.addEventListener('click', (e) => {
      if (searchBar.classList.contains('open') &&
          !searchBar.contains(e.target) &&
          e.target !== searchBtn) {
        closeSearch();
      }
    });
  }


  // ── Journal search ────────────────────────────────────────────
  const blogSearch = document.getElementById('blogSearch');
  if (blogSearch) {
    blogSearch.addEventListener('input', () => {
      const q = blogSearch.value.toLowerCase().trim();
      document.querySelectorAll('.post-index-card').forEach(card => {
        if (!q) {
          card.classList.remove('hidden-by-search');
          return;
        }
        const text = card.textContent.toLowerCase();
        card.classList.toggle('hidden-by-search', !text.includes(q));
      });
    });
  }

  // ── Show post-ad only when AdSense fills it ───────────────────
  const postAd = document.querySelector('.post-ad');
  if (postAd) {
    const adObserver = new MutationObserver(() => {
      const ins = postAd.querySelector('ins.adsbygoogle');
      if (ins && ins.getAttribute('data-ad-status') === 'filled') {
        postAd.classList.add('ad-loaded');
        adObserver.disconnect();
      }
    });
    adObserver.observe(postAd, { attributes: true, subtree: true, attributeFilter: ['data-ad-status'] });
  }
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

