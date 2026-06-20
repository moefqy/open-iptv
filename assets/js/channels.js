// channels.js — Fetch, parse, filter, and paginate channel data
let _allChannels = [];
// Public API
// Load channels (from cache if fresh, otherwise fetch M3U).
async function loadChannels() {
  // Pre-load of external playlists removed to avoid copyright issues
  _allChannels = [];
  return _allChannels;
}
// Assign unique clean slugs to all channels.
function computeSlugs(channels) {
  const counts = {};
  for (const ch of channels) {
    const countrySlug = ch.country ? ch.country.toLowerCase() : 'xx';
    const nameSlug = (ch.name || 'unknown')
      .replace(/[^a-z0-9\s]/gi, '')
      .trim()
      .replace(/\s+/g, '_')
      .toLowerCase();
    const baseSlug = `${countrySlug}-${nameSlug}`;

    if (counts[baseSlug]) {
      counts[baseSlug]++;
      ch.slug = `${baseSlug}-${counts[baseSlug]}`;
    } else {
      counts[baseSlug] = 1;
      ch.slug = baseSlug;
    }
  }
}
// Return all loaded channels.
function getAllChannels() {
  return _allChannels;
}
// Derive unique category list from loaded channels.
function getCategories(channelsList = _allChannels) {
  const counts = {};
  for (const ch of channelsList) {
    for (const cat of ch.categories) {
      if (!cat) continue;
      counts[cat] = (counts[cat] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([id, count]) => ({ id, label: formatCategory(id), count }))
    .sort((a, b) => {
      if (a.id === 'undefined') return 1;
      if (b.id === 'undefined') return -1;
      return b.count - a.count;
    });
}
// Derive unique country list from loaded channels.
function getCountries(userCountry = null, channelsList = _allChannels) {
  const counts = {};
  for (const ch of channelsList) {
    const c = ch.country || 'XX';
    counts[c] = (counts[c] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => {
      if (userCountry) {
        if (a.id === userCountry) return -1;
        if (b.id === userCountry) return 1;
      }
      if (a.id === 'XX') return 1;
      if (b.id === 'XX') return -1;
      return b.count - a.count;
    });
}
// Normalize raw M3U quality tags into clean categories.
function normalizeQuality(tag) {
  if (!tag) return null;
  const t = tag.toLowerCase();
  if (!/^(\d{3,4}[pi]|4k|8k|uhd|fhd|hd|sd)$/i.test(t)) return null;
  if (t.includes('4k') || t.includes('8k') || t.includes('uhd') || t.includes('2160')) return 'UHD';
  if (t.includes('108') || t.includes('fhd')) return 'FHD';
  if (t.includes('720') || t.includes('hd')) return 'HD';
  if (t.includes('576') || t.includes('480') || t.includes('sd')) return 'SD';
  if (t.includes('360') || t.includes('240') || t.includes('144')) return 'LQ';
  return null;
}
// Derive unique quality list from loaded channels.
function getQualities(channelsList = _allChannels) {
  const counts = {};
  for (const ch of channelsList) {
    let hasBucket = false;
    if (ch.tags) {
      // Track seen buckets so a channel doesn't count twice for the same quality tier
      const seenBuckets = new Set();
      for (const tag of ch.tags) {
        const bucket = normalizeQuality(tag);
        if (bucket && !seenBuckets.has(bucket)) {
          seenBuckets.add(bucket);
          counts[bucket] = (counts[bucket] || 0) + 1;
          hasBucket = true;
        }
      }
    }
    if (!hasBucket) {
      counts['Unknown'] = (counts['Unknown'] || 0) + 1;
    }
  }

  const order = { 'UHD': 5, 'FHD': 4, 'HD': 3, 'SD': 2, 'LQ': 1, 'Unknown': 0 };

  return Object.entries(counts)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => (order[b.id] || 0) - (order[a.id] || 0));
}
// Filter channels by category, country, quality, and/or search string.
function filterChannels({ channelsList = _allChannels, category = 'all', country = 'all', quality = 'all', search = '' }) {
  let result = channelsList;
  if (category !== 'all') {
    const categories = Array.isArray(category) ? category : [category];
    if (categories.length > 0) {
      const targetCats = categories.map(c => c.toLowerCase());
      result = result.filter(ch =>
        ch.categories.some(c => targetCats.includes(c))
      );
    }
  }
  if (country !== 'all') {
    const countries = Array.isArray(country) ? country : [country];
    if (countries.length > 0) {
      result = result.filter(ch => {
        const c = ch.country ? ch.country.toUpperCase() : 'XX';
        return countries.some(co => co.toUpperCase() === c);
      });
    }
  }
  if (quality !== 'all') {
    const qualities = Array.isArray(quality) ? quality : [quality];
    if (qualities.length > 0) {
      result = result.filter(ch => {
        let channelBuckets = [];
        if (ch.tags) {
          channelBuckets = ch.tags.map(normalizeQuality).filter(Boolean);
        }
        if (channelBuckets.length === 0) channelBuckets = ['Unknown'];

        return qualities.some(q => channelBuckets.some(b => b.toLowerCase() === q.toLowerCase()));
      });
    }
  }
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    result = result.filter(ch =>
      (ch.searchName && ch.searchName.includes(q)) ||
      (ch.country && ch.country.toLowerCase().includes(q)) ||
      ch.categories.some(c => c.includes(q))
    );
  }
  return result;
}
// Slice a channel array into a page.
function paginate(channels, page = 1, perPage = 48) {
  const total = channels.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;
  return {
    items: channels.slice(start, start + perPage),
    totalPages,
    currentPage: safePage,
    total,
  };
}
// clearCache is now defined at the bottom with IndexedDB
// Title-case a category id string.
function formatCategory(cat) {
  return cat.split(/[-_\s]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
// M3U Fetching & Parsing
async function fetchFromM3U() {
  const [resM3u, resApi] = await Promise.all([
    fetch(M3U_URL),
    fetch(API_URL).catch(() => null)
  ]);

  if (!resM3u.ok) throw new Error(`Failed to fetch channel list (HTTP ${resM3u.status})`);
  const text = await resM3u.text();
  let apiMap = new Map();
  if (resApi && resApi.ok) {
    try {
      const apiData = await resApi.json();
      for (const ch of apiData) {
        if (ch.id) apiMap.set(ch.id, ch);
      }
      console.info(`[channels] Loaded ${apiMap.size} metadata records from API.`);
    } catch (e) {
      console.warn('[channels] Failed to parse API data', e);
    }
  }

  const channels = await new Promise((resolve, reject) => {
    const worker = new Worker('/assets/js/data-worker.js');
    worker.onmessage = (e) => {
      resolve(e.data.channels);
      worker.terminate();
    };
    worker.onerror = (err) => {
      reject(new Error('Web Worker failed to parse M3U.'));
      worker.terminate();
    };
    worker.postMessage({ text, apiMapArray: Array.from(apiMap.entries()) });
  });
  console.info(`[channels] Parsed ${channels.length} channels from M3U via Web Worker.`);
  return channels;
}

// -------------------------------------------------------
// Cache helpers (IndexedDB)
const DB_NAME = 'OpenIPTV_Cache';
const DB_VERSION = 1;
const STORE_NAME = 'channels';

function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getCache() {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(CACHE_KEY);
      req.onsuccess = () => {
        if (!req.result) return resolve(null);
        const { ts, data } = req.result;
        if (Date.now() - ts > CACHE_TTL) {
          clearCache(); // invalidate
          resolve(null);
        } else {
          resolve(data);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setCache(data) {
  try {
    const slim = data.map(ch => ({
      id: ch.id,
      name: ch.name,
      logo: ch.logo,
      tags: ch.tags,
      categories: ch.categories,
      country: ch.country,
      languages: ch.languages,
      url: ch.url,
      isCustom: ch.isCustom,
      slug: ch.slug,
    }));

    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ ts: Date.now(), data: slim }, CACHE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[channels] IndexedDB write failed:', e);
  }
}

async function clearCache() {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(CACHE_KEY);
  } catch (e) { }
}
export {
  loadChannels,
  getAllChannels,
  getCategories,
  getCountries,
  getQualities,
  filterChannels,
  paginate,
  clearCache,
  formatCategory,
};