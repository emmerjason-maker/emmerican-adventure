/* ═══════════════════════════════════════════════════════════════
   Emmerican Adventure — Adventures Page JS
   Supabase read · filter · render
   ═══════════════════════════════════════════════════════════════ */

const SUPABASE_URL  = 'https://azjwuraxixuioeddkicq.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6and1cmF4aXh1aW9lZGRraWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTM4MTMsImV4cCI6MjA5Njk4OTgxM30._GuEJWGiRHktIeX6ukleM2s07V_W6pbMxIV8ntXjy44';

const $ = id => document.getElementById(id);

let allAdventures = [];
let adventuresLoaded = false;
let activeType    = 'all';
let lightboxPhotos = [];
let lightboxIndex  = 0;

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  bindFilters();
  bindSearch();
  bindLightbox();
  await loadAdventures();
});

// ── Supabase fetch ────────────────────────────────────────────────
let allPostLocations = [];

async function loadAdventures() {
  try {
    const headers = {
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
    };
    const [advRes, postRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/adventures?select=*&status=eq.visited&order=visited_date.desc`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/post_locations?select=*&order=created_at.desc`, { headers }),
    ]);

    if (!advRes.ok) throw new Error(`Supabase error: ${advRes.status}`);
    allAdventures    = await advRes.json();
    allPostLocations = postRes.ok ? await postRes.json() : [];
    console.log('[Adventures] rows:', allAdventures.length);
    console.log('[Adventures] statuses:', [...new Set(allAdventures.map(a => a.status))]);
    console.log('[Adventures] countries:', [...new Set(allAdventures.map(a => a.location_country).filter(Boolean))]);
    const loadEl = $('advLoading');
    if (loadEl) { loadEl.style.display = 'none'; loadEl.classList.add('hidden'); }
    adventuresLoaded = true;
    renderAll();
  } catch (err) {
    console.error('Failed to load adventures:', err);
    $('advLoading').innerHTML = '<p style="color:var(--red)">Failed to load adventures. Please refresh.</p>';
  }
}

// ── Filters ───────────────────────────────────────────────────────
function bindFilters() {
  document.querySelectorAll('.adv-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.adv-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeType = pill.dataset.type;
      renderAll();
    });
  });
}

function bindSearch() {
  const search = $('advSearch');
  if (!search) return;
  let debounce;
  search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(renderAll, 200);
  });
}

// ── Render ────────────────────────────────────────────────────────
function renderAll() {
  const query = ($('advSearch')?.value || '').toLowerCase().trim();

  // Filter
  let filtered = allAdventures.filter(a => {
    if (activeType !== 'all' && activeType !== 'country' && a.type !== activeType) return false;
    if (activeType === 'country') return false; // countries are derived, not a type
    if (query) {
      const haystack = [a.name, a.location_city, a.location_region, a.location_country, a.cuisine, a.notes, ...(a.tags || [])]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  // Update stats (always from full set, not filtered)
  updateStats(allAdventures);

  // Don't show empty state if data hasn't loaded yet
  if (!adventuresLoaded) return;

  const emptyEl = $('advEmpty');
  if (filtered.length === 0) {
    if (emptyEl) { emptyEl.style.display = ''; emptyEl.classList.remove('hidden'); }
    $('advGrid').innerHTML = '';
    return;
  }

  if (emptyEl) { emptyEl.style.display = 'none'; emptyEl.classList.add('hidden'); }

  // Group by country → city
  const groups = groupAdventures(filtered);
  $('advGrid').innerHTML = groups.map(renderGroup).join('');

  // Bind photo clicks after render
  bindPhotoClicks();
}

function updateStats(data) {
  const elR = document.getElementById('statRestaurants');
  const elP = document.getElementById('statPlaces');
  const elC = document.getElementById('statCountries');

  if (elR) elR.textContent = data.filter(a => a.type === 'restaurant').length;
  if (elP) elP.textContent = data.filter(a => a.type === 'place').length;

  // Derive countries — UK nations (Scotland/England/Wales/N.Ireland) each count separately
  const UK_NATIONS = new Set(['Scotland', 'England', 'Wales', 'Northern Ireland']);
  const countrySet = new Set();

  function addCountry(region, country) {
    if (!country) return;
    // If region is a UK nation, count it as the country
    if (country.trim() === 'United Kingdom' && region && UK_NATIONS.has(region.trim())) {
      countrySet.add(region.trim());
    } else {
      countrySet.add(country.trim());
    }
  }

  data.forEach(a => addCountry(a.location_region, a.location_country));
  (allPostLocations || []).forEach(p => addCountry(p.location_region, p.location_country));

  console.log('[updateStats] countrySet:', [...countrySet], 'size:', countrySet.size);
  if (elC) elC.textContent = countrySet.size;
}

function groupAdventures(data) {
  // Group by location_country → location_city
  const map = new Map();

  data.forEach(a => {
    const country = a.location_country || 'Location Unknown';
    const state   = a.location_state   || '';
    const city    = a.location_city    || '';
    const key     = city ? `${country}||${state}||${city}` : country;

    if (!map.has(key)) {
      map.set(key, { country, state, city, items: [] });
    }
    map.get(key).items.push(a);
  });

  // Sort groups: US first, then chronologically by newest entry
  return Array.from(map.values()).sort((a, b) => {
    // US entries first
    const aUs = a.country === 'United States' ? 0 : 1;
    const bUs = b.country === 'United States' ? 0 : 1;
    if (aUs !== bUs) return aUs - bUs;
    return a.country.localeCompare(b.country) || a.city.localeCompare(b.city);
  });
}

function renderGroup(group) {
  const parts = [group.city, group.state, group.country].filter(Boolean);
  const label = parts.length > 1 ? parts.join(', ') : group.country;
  const count = group.items.length;
  return `
    <div class="adv-group">
      <div class="adv-group-header">
        <h2 class="adv-group-label">${escHtml(label)}</h2>
        <span class="adv-group-count">${count} entr${count === 1 ? 'y' : 'ies'}</span>
      </div>
      <div class="adv-cards">
        ${group.items.map(renderCard).join('')}
      </div>
    </div>
  `;
}

function renderCard(a) {
  const typeEmoji = { restaurant: '🍜', place: '📍', country: '🌏' }[a.type] || '';
  // photos may come back as array or JSON string — parse safely
  let photos = a.photos || [];
  if (typeof photos === 'string') {
    try { photos = JSON.parse(photos); } catch(e) { photos = []; }
  }
  if (!Array.isArray(photos)) photos = [];
  const coverPhoto = photos[0] || null;
  if (a.name === 'St Patrick\'s Cathedral') {
    console.log('[photo debug]', a.name, 'raw:', JSON.stringify(a.photos), 'parsed:', photos, 'cover:', coverPhoto);
  }

  // Photo area
  let photoHtml;
  if (coverPhoto) {
    const photoData = JSON.stringify(photos).replace(/"/g, '&quot;');
    photoHtml = `
      <div class="adv-card-photo" data-photos="${photoData}" data-index="0">
        <img src="${escHtml(coverPhoto)}" alt="${escHtml(a.name)}" loading="lazy" />
        <span class="adv-type-badge ${a.type}">${escHtml(a.type)}</span>
        ${photos.length > 1 ? `<span class="adv-photo-count">+${photos.length - 1} photos</span>` : ''}
      </div>`;
  } else {
    photoHtml = `
      <div class="adv-card-no-photo">
        ${typeEmoji}
        <span class="adv-type-badge ${a.type}">${escHtml(a.type)}</span>
      </div>`;
  }

  // Stars — quarter-star SVG rendering
  let starsHtml = '';
  if (a.rating) {
    starsHtml = `<div class="adv-stars" aria-label="${a.rating} out of 5 stars">
      ${renderStarsSvg(parseFloat(a.rating))}
      <span class="adv-rating-num">${parseFloat(a.rating).toFixed(2).replace(/\.?0+$/, '')}</span>
    </div>`;
  }

  // Date
  const dateStr = a.visited_date
    ? new Date(a.visited_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '';

  // Tags
  const tagsHtml = (a.tags || []).length
    ? `<div class="adv-card-tags">${a.tags.map(t => `<span class="adv-tag">${escHtml(t)}</span>`).join('')}</div>`
    : '';

  // Notes
  const notesHtml = a.notes
    ? `<p class="adv-card-notes">${escHtml(a.notes)}</p>`
    : '';

  // Family reactions
  let reactionsHtml = '';
  if (a.family_reactions && Object.keys(a.family_reactions).length) {
    const pairs = Object.entries(a.family_reactions);
    reactionsHtml = `<div class="adv-reactions">
      ${pairs.map(([name, rating]) => `
        <span class="adv-reaction">
          <span class="adv-reaction-name">${escHtml(name)}</span>
          <span>${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</span>
        </span>`).join('')}
    </div>`;
  }

  // Footer badges
  const badges = [];
  if (a.kid_friendly === true)  badges.push(`<span class="adv-badge kid-yes">👶 Kid-friendly</span>`);
  if (a.would_return === true)  badges.push(`<span class="adv-badge would-return">↩ Would return</span>`);
  const priceLabels = {
    budget:   '🟢 Budget',
    moderate: '🟡 Moderate',
    splurge:  '🟠 Splurge',
    special:  '🔴 Special Occasion',
  };
  const priceHtml = a.price_range
    ? `<span class="adv-price">${escHtml(priceLabels[a.price_range] || a.price_range)}</span>`
    : '';
  const blogLinkHtml = a.post_url
    ? `<a href="${escHtml(a.post_url)}" class="adv-card-blog-link">Read post →</a>`
    : '';

  const hasFooter = badges.length || priceHtml || blogLinkHtml;
  const footerHtml = hasFooter ? `
    <div class="adv-card-footer">
      <div class="adv-badges">${badges.join('')}</div>
      ${priceHtml}
      ${blogLinkHtml}
    </div>` : '';

  // Location line
  const locParts = [a.location_city, a.location_region, a.location_country].filter(Boolean);
  const locUniq = locParts.filter((v, i, arr) => arr.indexOf(v) === i);
  const locHtml = locUniq.length
    ? `<p class="adv-card-location">${escHtml(locUniq.join(', '))}</p>`
    : '';

  // Cuisine
  const cuisineHtml = a.cuisine
    ? `<span class="adv-card-cuisine">${escHtml(a.cuisine)}</span>`
    : '';

  return `
    <article class="adv-card">
      ${photoHtml}
      <div class="adv-card-body">
        <div class="adv-card-meta">
          ${dateStr ? `<span class="adv-card-date">${dateStr}</span>` : ''}
          ${cuisineHtml}
        </div>
        <h3 class="adv-card-name">${escHtml(a.name)}</h3>
        ${locHtml}
        ${starsHtml}
        ${notesHtml}
        ${tagsHtml}
        ${reactionsHtml}
        ${footerHtml}
      </div>
    </article>`;
}

// ── Lightbox ──────────────────────────────────────────────────────
function bindPhotoClicks() {
  document.querySelectorAll('.adv-card-photo').forEach(el => {
    el.addEventListener('click', () => {
      const photos = JSON.parse(el.dataset.photos || '[]');
      const index  = parseInt(el.dataset.index || '0', 10);
      openLightbox(photos, index);
    });
  });
}

function bindLightbox() {
  $('advLightboxClose')?.addEventListener('click', closeLightbox);
  $('advLightboxPrev')?.addEventListener('click', () => shiftLightbox(-1));
  $('advLightboxNext')?.addEventListener('click', () => shiftLightbox(1));

  $('advLightbox')?.addEventListener('click', e => {
    if (e.target === $('advLightbox')) closeLightbox();
  });

  document.addEventListener('keydown', e => {
    if ($('advLightbox')?.classList.contains('hidden')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  shiftLightbox(-1);
    if (e.key === 'ArrowRight') shiftLightbox(1);
  });
}

function openLightbox(photos, index) {
  lightboxPhotos = photos;
  lightboxIndex  = index;
  updateLightboxImg();
  $('advLightbox').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  $('advLightbox').classList.add('hidden');
  document.body.style.overflow = '';
}

function shiftLightbox(dir) {
  lightboxIndex = (lightboxIndex + dir + lightboxPhotos.length) % lightboxPhotos.length;
  updateLightboxImg();
}

function updateLightboxImg() {
  const img = $('advLightboxImg');
  if (img) img.src = lightboxPhotos[lightboxIndex] || '';
  $('advLightboxPrev').style.display = lightboxPhotos.length > 1 ? '' : 'none';
  $('advLightboxNext').style.display = lightboxPhotos.length > 1 ? '' : 'none';
}

// ── Quarter-star SVG renderer ─────────────────────────────────────
function renderStarsSvg(rating) {
  const SIZE = 16;
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const fill = Math.min(1, Math.max(0, rating - (i - 1)));
    // fill: 0=empty, 0.25=quarter, 0.5=half, 0.75=three-quarter, 1=full
    const pct = Math.round(fill * 4) / 4; // snap to nearest quarter
    const fillPct = Math.round(pct * 100);

    stars.push(`
      <svg width="${SIZE}" height="${SIZE}" viewBox="0 0 16 16" class="adv-star-svg" aria-hidden="true">
        <defs>
          <linearGradient id="sg${i}r${Math.round(rating*100)}">
            <stop offset="${fillPct}%" stop-color="var(--gold)" />
            <stop offset="${fillPct}%" stop-color="var(--paper-dark)" />
          </linearGradient>
        </defs>
        <path fill="url(#sg${i}r${Math.round(rating*100)})"
          d="M8 1l1.8 3.6 4 .6-2.9 2.8.7 4L8 10 4.4 12l.7-4L2.2 5.2l4-.6z"/>
      </svg>`);
  }
  return stars.join('');
}

// ── Util ──────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


/* ── Embedded map on adventures page ────────────────────────────── */
let advEmbedMap    = null;
let advEmbedMarkers = [];
const ADV_PIN_COLORS = { restaurant: '#c0392b', place: '#b8922a', country: '#1a1714' };

function initAdvEmbedMap() {
  const el = document.getElementById('advEmbedMap');
  if (!el) return;

  advEmbedMap = new google.maps.Map(el, {
    zoom: 4,
    center: { lat: 30, lng: -80 },
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    zoomControl: true,
    styles: advMapStyles(),
  });

  // Wait for adventures to load, then place pins
  // allAdventures is populated by loadAdventures()
  const checkReady = setInterval(() => {
    if (allAdventures.length > 0 || document.getElementById('advLoading')?.classList.contains('hidden')) {
      clearInterval(checkReady);
      placeAdvEmbedMarkers();
    }
  }, 300);
}

function placeAdvEmbedMarkers() {
  advEmbedMarkers.forEach(m => m.setMap(null));
  advEmbedMarkers = [];

  const infoWindow = new google.maps.InfoWindow({ maxWidth: 240 });
  const mapped = allAdventures.filter(a => a.lat && a.lng);

  if (!mapped.length) {
    document.getElementById('advMapLoading').innerHTML =
      '<p style="font-family:var(--font-mono);font-size:0.7rem;">No mapped locations yet — add lat/lng in the admin panel.</p>';
    return;
  }

  document.getElementById('advMapLoading').style.display = 'none';

  mapped.forEach(a => {
    const marker = new google.maps.Marker({
      position: { lat: parseFloat(a.lat), lng: parseFloat(a.lng) },
      map: advEmbedMap,
      title: a.name,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: ADV_PIN_COLORS[a.type] || '#666',
        fillOpacity: 0.92,
        strokeColor: '#fff',
        strokeWeight: 1.5,
      },
    });

    marker.addListener('click', () => {
      const loc = [a.location_city, a.location_country].filter(Boolean).join(', ');
      infoWindow.setContent(
        '<div style="padding:0.75rem;min-width:160px;font-family:var(--font-body);">' +
        '<div style="font-family:var(--font-mono);font-size:0.58rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--ink-faint);margin-bottom:0.2rem;">' + (a.type || '') + '</div>' +
        '<div style="font-family:var(--font-display);font-size:1rem;color:var(--ink);margin-bottom:0.15rem;">' + esc(a.name) + '</div>' +
        (loc ? '<div style="font-family:var(--font-mono);font-size:0.6rem;color:var(--ink-faint);">' + esc(loc) + '</div>' : '') +
        '</div>'
      );
      infoWindow.open(advEmbedMap, marker);
    });

    advEmbedMarkers.push(marker);
  });

  // Fit to markers
  if (mapped.length === 1) {
    advEmbedMap.setCenter({ lat: parseFloat(mapped[0].lat), lng: parseFloat(mapped[0].lng) });
    advEmbedMap.setZoom(13);
  } else {
    const bounds = new google.maps.LatLngBounds();
    mapped.forEach(a => bounds.extend({ lat: parseFloat(a.lat), lng: parseFloat(a.lng) }));
    advEmbedMap.fitBounds(bounds, { padding: 40 });
  }
}

function advMapStyles() {
  return [
    { elementType: 'geometry', stylers: [{ color: '#f5f0e8' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#1a1714' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f0e8' }] },
    { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c9c0b0' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e8e0d0' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c0d4e8' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ];
}
