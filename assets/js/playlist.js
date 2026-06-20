// playlist.js — Custom M3U playlist URL management

const PLAYLIST_KEY = 'open-iptv-playlist-url';

// Get saved playlists array from localStorage
function getPlaylists() {
  const raw = localStorage.getItem(PLAYLIST_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    // Legacy support for single object
    if (parsed && parsed.url) {
      return [{ id: 'legacy-id', name: parsed.name || 'Unnamed Playlist', url: parsed.url }];
    }
  } catch {
    // Legacy support for plain url string
    if (raw.startsWith('http')) {
      return [{ id: 'legacy-id', name: 'Unnamed Playlist', url: raw }];
    }
  }
  return [];
}

// Save playlists array to localStorage
function savePlaylists(playlists) {
  localStorage.setItem(PLAYLIST_KEY, JSON.stringify(playlists));
}

function addPlaylist(name, url) {
  const playlists = getPlaylists();
  const id = `playlist-${Date.now()}`;
  playlists.push({ id, name: name.trim() || 'Unnamed Playlist', url: url.trim() });
  savePlaylists(playlists);
  return id;
}

function updatePlaylist(id, name, url) {
  const playlists = getPlaylists();
  const index = playlists.findIndex(p => p.id === id);
  if (index !== -1) {
    playlists[index] = { ...playlists[index], name: name.trim() || 'Unnamed Playlist', url: url.trim() };
    savePlaylists(playlists);
  }
}

function deletePlaylist(id) {
  let playlists = getPlaylists();
  playlists = playlists.filter(p => p.id !== id);
  savePlaylists(playlists);
}

async function fetchAndParseM3U(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch playlist (HTTP ${response.status})`);
  const text = await response.text();
  return parseM3U(text);
}

// Parse raw M3U text into channel objects.
function parseM3U(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const channels = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith('#EXTINF')) {
      current = parseExtInf(line);
    } else if (line.startsWith('http') || line.startsWith('rtsp')) {
      if (current) {
        current.url = line;

        const urlUpper = line.toUpperCase();
        const qualityKeywords = ['4K', 'UHD', '2160P', '1080P', 'FHD', '1080I', '720P', 'HD', '720I', '480P', 'SD', '576P', '360P', '240P', 'LQ'];
        for (const kw of qualityKeywords) {
          const regex = new RegExp(`[^A-Z0-9]${kw}([^A-Z0-9]|$)`);
          if (regex.test(urlUpper) && !current.tags.some(t => t.toUpperCase() === kw)) {
            current.tags.push(kw);
          }
        }

        current.id = `custom-${btoa(encodeURIComponent(line)).slice(0, 16)}`;
        current.slug = (current.name || 'unknown')
          .replace(/[^a-z0-9\s]/gi, '')
          .trim()
          .replace(/\s+/g, '_')
          .toLowerCase();
        current.isCustom = true;
        channels.push(current);
        current = null;
      }
    }
  }

  return channels;
}

// Parse a single #EXTINF line into a partial channel object.
function parseExtInf(line) {
  const channel = {
    id: '',
    name: 'Unknown Channel',
    logo: '',
    categories: [],
    country: '',
    url: '',
    isCustom: true,
  };

  let tvgName = '';
  let tvgId = '';

  // 1. Extract attributes
  const attrRegex = /([a-zA-Z0-9-]+)="([^"]*)"/g;
  let match;
  while ((match = attrRegex.exec(line)) !== null) {
    const key = match[1].toLowerCase();
    const val = match[2];

    switch (key) {
      case 'tvg-id':
        tvgId = val;
        break;
      case 'tvg-name':
        tvgName = val;
        break;
      case 'tvg-logo':
        channel.logo = val;
        break;
      case 'tvg-country':
        channel.country = val.toUpperCase();
        break;
      case 'group-title':
        channel.categories = val.toLowerCase().split(/[;,|]/).map(c => c.trim()).filter(Boolean);
        break;
    }
  }

  // 2. Resolve Channel Name
  const commaIdx = line.lastIndexOf(',');
  const fallbackName = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : 'Unknown Channel';
  channel.name = tvgName || fallbackName;

  // 3. Resolve Country (Fallback to tvg-id suffix)
  if (!channel.country && tvgId) {
    const suffix = tvgId.split('@')[0].split('.').pop();
    if (suffix?.length === 2) {
      channel.country = suffix.toUpperCase();
    }
  }

  // 4. Resolve Quality from Tags and Name
  const tags = [];
  channel.name = channel.name.replace(/\s*(\([^)]+\)|\[[^\]]+\])\s*/g, (match, tag) => {
    let cleanTag = tag.replace(/^[[(](.*)[\])]$/, '$1').trim();
    if (cleanTag) tags.push(cleanTag);
    return ' ';
  }).trim();

  // 5. Extract common quality markers from raw name words
  const nameWords = channel.name.toUpperCase().split(/[\s\-_]+/);
  const qualityKeywords = ['4K', 'UHD', '2160P', '1080P', 'FHD', '1080I', '720P', 'HD', '720I', '480P', 'SD', '576P', '360P', '240P', 'LQ'];
  for (const word of nameWords) {
    if (qualityKeywords.includes(word) && !tags.some(t => t.toUpperCase() === word)) {
      tags.push(word);
    }
  }

  channel.searchName = channel.name.toLowerCase();
  channel.tags = tags;

  return channel;
}

export { getPlaylists, addPlaylist, updatePlaylist, deletePlaylist, fetchAndParseM3U };