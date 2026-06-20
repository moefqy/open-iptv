self.onmessage = function (e) {
  const { text, apiMapArray } = e.data;
  const apiMap = new Map(apiMapArray);
  const channels = parseM3U(text, apiMap);
  self.postMessage({ channels });
};
function parseM3U(text, apiMap) {
  const lines = text.split('\n');
  const channels = [];
  const seen = new Set();   // track tvg-ids to avoid duplicates
  let pending = null;
  let counter = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      pending = parseExtInf(line, counter++, apiMap);
    } else if (
      pending &&
      (line.startsWith('http') || line.startsWith('rtsp') || line.startsWith('rtp'))
    ) {
      pending.url = line;
      // Skip channels without a usable stream URL
      if (!pending.url) { pending = null; continue; }
      // Deduplicate by id
      if (pending.id && seen.has(pending.id)) { pending = null; continue; }
      if (pending.id) seen.add(pending.id);
      channels.push(pending);
      pending = null;
    }
  }
  return channels;
}
function parseExtInf(line, counter, apiMap) {
  let tvgId = '', tvgName = '', tvgLogo = '', tvgCountry = '', tvgLang = '', group = '';
  
  // Single pass attribute extraction
  const attrRegex = /([a-zA-Z0-9-]+)="([^"]*)"/g;
  let match;
  while ((match = attrRegex.exec(line)) !== null) {
    const key = match[1].toLowerCase();
    if (key === 'tvg-id') tvgId = match[2];
    else if (key === 'tvg-name') tvgName = match[2];
    else if (key === 'tvg-logo') tvgLogo = match[2];
    else if (key === 'tvg-country') tvgCountry = match[2];
    else if (key === 'tvg-language') tvgLang = match[2];
    else if (key === 'group-title') group = match[2];
  }

  tvgId = tvgId.trim();
  const baseTvgId = tvgId.split('@')[0];

  // Fallback name: text after last comma
  let name = tvgName;
  if (!name) {
    const ci = line.lastIndexOf(',');
    name = ci !== -1 ? line.substring(ci + 1).trim() : 'Unknown';
  }
  // Extract tags like (576p) or [Geo-blocked] from name
  const tags = [];
  name = name.replace(/\s*(\([^)]+\)|\[[^\]]+\])\s*/g, (match, tag) => {
    let cleanTag = tag.replace(/^[[(](.*)[\])]$/, '$1').trim();
    if (cleanTag) tags.push(cleanTag);
    return ' ';
  }).trim();
  // Try fetching extra metadata from API
  const apiMeta = apiMap ? apiMap.get(baseTvgId) : null;
  if (apiMeta && apiMeta.name) {
    const m3uNameLower = name.toLowerCase();
    const apiNameLower = apiMeta.name.toLowerCase();

    if (!m3uNameLower.startsWith(apiNameLower) || m3uNameLower === apiNameLower) {
      name = apiMeta.name;
    }
  }
  // Generate unique id if missing
  const id = tvgId ||
    `ch-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${counter}`;
  let country = (apiMeta && apiMeta.country) ? apiMeta.country : tvgCountry;
  country = country ? country.toUpperCase() : '';
  if (!country && baseTvgId) {
    const match = baseTvgId.match(/\.([a-z]{2,3})$/i);
    if (match) {
      country = match[1].toUpperCase();
    }
  }
  let categories = new Set();
  if (group) categories.add(group.split(';')[0].trim().toLowerCase());
  if (apiMeta && apiMeta.categories) {
    apiMeta.categories.forEach(c => categories.add(typeof c === 'string' ? c.toLowerCase() : (c.name || c.id || '').toLowerCase()));
  }
  // Generate slug
  const slug = (name + '-' + (country || 'xx')).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return {
    id,
    name,
    searchName: name.toLowerCase(),
    tags,
    logo: tvgLogo || (apiMeta ? apiMeta.logo : ''),
    categories: Array.from(categories).filter(Boolean),
    country: country,
    languages: tvgLang ? [tvgLang] : [],
    url: '',
    isCustom: false,
    slug: slug,
  };
}
