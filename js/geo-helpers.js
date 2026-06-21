// ── Shared geography helpers ────────────────────────────────────────
// Single source of truth for how UK nations are counted as separate
// "countries" for visit-counting purposes. Previously this exact list
// was copy-pasted in 6 different places across admin.js, adventures.js,
// and map.html — this file replaces all of those.
const UK_NATIONS = new Set(['Scotland', 'England', 'Wales', 'Northern Ireland']);

// Given an object with location_country / location_region (or country /
// region) fields, returns the "display country" — the UK nation itself
// if applicable, otherwise the country as-is.
function displayCountryFor(entry) {
  const country = entry.location_country || entry.country || '';
  const region  = entry.location_region  || entry.region  || '';
  return (country === 'United Kingdom' && UK_NATIONS.has(region)) ? region : country;
}
