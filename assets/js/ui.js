// ui.js — DOM rendering helpers
import { formatCategory } from './channels.js';
function getCountryFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '<i class="fa-solid fa-globe"></i>';
  return `<span class="fi fi-${countryCode.toLowerCase()}"></span>`;
}
// Channel Grid

function renderChannelGrid(grid, channels, customPlaylistName, hasPlaylists = true) {
  if (!grid) return;
  grid.innerHTML = '';
  if (!channels || channels.length === 0) {
    grid.appendChild(createEmptyState(hasPlaylists));
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const ch of channels) {
    fragment.appendChild(createChannelCard(ch, customPlaylistName));
  }
  grid.appendChild(fragment);
}
// Create a single channel card element.
function createChannelCard(ch, customPlaylistName) {
  const card = document.createElement('a');
  card.className = 'channel-card';
  if (ch.isCustom) {
    const pName = encodeURIComponent((ch.playlistName || customPlaylistName || 'Unnamed Playlist').trim());
    card.href = `./watch/${pName}/${ch.slug}`;
  } else {
    card.href = `./watch/${ch.slug}`;
  }
  card.setAttribute('data-channel-id', ch.id);
  card.setAttribute('aria-label', `Watch ${ch.name}`);
  const initials = getInitials(ch.name);
  const categoryLabel = ch.categories[0] ? formatCategory(ch.categories[0]) : '';
  card.innerHTML = `
    <div class="channel-card__logo-wrap">
      ${ch.logo
      ? `<img
            class="channel-card__logo"
            src="${escHtml(ch.logo)}"
            alt="${escHtml(ch.name)} logo"
            loading="lazy"
            onerror="this.classList.add('errored')"
          />
          <span class="channel-card__initials" aria-hidden="true">${escHtml(initials)}</span>`
      : `<span class="channel-card__initials" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;" aria-hidden="true">${escHtml(initials)}</span>`
    }
      <span class="channel-card__live-badge">Live</span>
      ${ch.tags && ch.tags.length > 0 ? `
        <div class="channel-card__img-tags">
          ${ch.tags.map(t => `<span class="channel-card__img-tag">${escHtml(t)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
    <div class="channel-card__body">
      <div class="channel-card__name" title="${escHtml(ch.name)}">${escHtml(ch.name)}</div>
      <div class="channel-card__meta">
        ${categoryLabel
      ? `<span class="channel-card__category">${escHtml(categoryLabel)}</span>`
      : ''
    }
        ${ch.country
      ? `<span class="channel-card__country" title="${escHtml(ch.country)}">
              <i class="fa-solid fa-location-dot fa-xs"></i>
              ${escHtml(ch.country.toUpperCase())}
            </span>`
      : ''
    }
      </div>
    </div>
  `;
  return card;
}
// Category Tabs
// Render custom filter tabs and sublist chips.
function renderFilterUI(modeContainer, sublistContainer, countries, categories, qualities, state, onFilterSelect) {
  if (!modeContainer || !sublistContainer) return;
  // 1. Update active state on mode buttons
  const modeBtns = modeContainer.querySelectorAll('.filter-mode-btn');
  modeBtns.forEach(btn => {
    if (btn.getAttribute('data-mode') === state.filterMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  // 2. Render sublist chips if not 'all'
  const wrap = document.getElementById('filter-sublist-wrap');
  if (wrap) wrap.style.display = 'block';
  sublistContainer.innerHTML = '';
  const frag = document.createDocumentFragment();
  const isPlaylistMode = state.filterMode.startsWith('playlist-');
  const primaryMode = 'country';

  // "All" chip for current mode to clear selection
  const clearChip = document.createElement('button');
  const isModeAllActive = state.country === 'all';
  clearChip.className = `filter-chip ${isModeAllActive ? 'active' : ''}`;
  clearChip.type = 'button';
  clearChip.textContent = 'All';
  clearChip.onclick = () => onFilterSelect(primaryMode, 'all');
  frag.appendChild(clearChip);
  if (primaryMode === 'country') {
    for (const c of countries) {
      const chip = document.createElement('button');
      const isActive = Array.isArray(state.country) ? state.country.includes(c.id) : state.country === c.id;
      chip.className = `filter-chip ${isActive ? 'active' : ''}`;
      chip.type = 'button';
      if (c.id === 'XX') {
        chip.innerHTML = `Undefined <span class="chip-count">${c.count}</span>`;
      } else {
        chip.innerHTML = `${getCountryFlag(c.id)} ${c.id.toUpperCase()} <span class="chip-count">${c.count}</span>`;
      }
      chip.onclick = () => onFilterSelect('country', c.id);
      frag.appendChild(chip);
    }
  } else if (primaryMode === 'category') {
    for (const c of categories) {
      const chip = document.createElement('button');
      const isActive = Array.isArray(state.category) ? state.category.includes(c.id) : state.category === c.id;
      chip.className = `filter-chip ${isActive ? 'active' : ''}`;
      chip.type = 'button';
      chip.innerHTML = `${escHtml(c.label)} <span class="chip-count">${c.count}</span>`;
      chip.onclick = () => onFilterSelect('category', c.id);
      frag.appendChild(chip);
    }
  } else if (primaryMode === 'quality') {
    for (const q of qualities) {
      const chip = document.createElement('button');
      const isActive = Array.isArray(state.quality) ? state.quality.includes(q.id) : state.quality === q.id;
      chip.className = `filter-chip ${isActive ? 'active' : ''}`;
      chip.type = 'button';
      chip.innerHTML = `${escHtml(q.id.toUpperCase())} <span class="chip-count">${q.count}</span>`;
      chip.onclick = () => onFilterSelect('quality', q.id);
      frag.appendChild(chip);
    }
  }
  sublistContainer.appendChild(frag);
  // 3. Secondary Filter
  const secWrap = document.getElementById('secondary-filter-wrap');
  const secBtn = document.getElementById('secondary-filter-btn');
  const secGrid = document.getElementById('secondary-filter-grid');

  if (secWrap && secBtn && secGrid) {
    secWrap.style.display = 'flex';
    secGrid.innerHTML = '';
      secGrid.className = 'secondary-filter-grid';
      let availableOptions = [];
      if (primaryMode === 'category') {
        availableOptions = [
          { val: 'country', label: 'Country' },
          { val: 'quality', label: 'Quality' }
        ];
      } else if (primaryMode === 'quality') {
        availableOptions = [
          { val: 'country', label: 'Country' },
          { val: 'category', label: 'Category' }
        ];
      } else {
        availableOptions = [
          { val: 'category', label: 'Category' },
          { val: 'quality', label: 'Quality' }
        ];
      }

      let secMode = state.secondaryFilterType;
      if (!secMode || !availableOptions.find(o => o.val === secMode)) {
        secMode = availableOptions[0].val;
        // Since we are changing it dynamically, we should ensure app.js is using this mode
        // But app.js will use state.secondaryFilterType, which might be null.
      }

      const secTypeSelect = document.getElementById('secondary-filter-type-select');
      if (secTypeSelect) {
        secTypeSelect.innerHTML = '';

        for (const opt of availableOptions) {
          const o = document.createElement('option');
          o.value = opt.val;
          o.textContent = opt.label;
          if (opt.val === secMode) o.selected = true;
          secTypeSelect.appendChild(o);
        }

        secTypeSelect.onchange = (e) => {
          onFilterSelect('change_secondary_type', e.target.value);
        };
      }

      const hasSecondary = state.secondaryFilters.country.length > 0 || state.secondaryFilters.category.length > 0 || state.secondaryFilters.quality.length > 0;

      if (hasSecondary) {
        secBtn.classList.add('active');
      } else {
        secBtn.classList.remove('active');
      }

      const df = document.createDocumentFragment();

      secGrid.classList.remove('grid-mode', 'flex-mode');
      if (secMode === 'country') {
        secGrid.classList.add('grid-mode');
        for (const c of countries) {
          const btn = document.createElement('button');
          const isSelected = state.secondaryFilters.country.includes(c.id);
          btn.className = `filter-chip ${isSelected ? 'active' : ''}`;
          btn.type = 'button';
          const label = c.id === 'XX' ? 'Undefined' : `${getCountryFlag(c.id)} ${c.id.toUpperCase()}`;
          btn.innerHTML = `${label} <span class="chip-count">${c.count}</span>`;
          btn.onclick = () => onFilterSelect('toggle_secondary', c.id);
          df.appendChild(btn);
        }
      } else if (secMode === 'category') {
        secGrid.classList.add('flex-mode');
        for (const c of categories) {
          const btn = document.createElement('button');
          const isSelected = state.secondaryFilters.category.includes(c.id);
          btn.className = `filter-chip ${isSelected ? 'active' : ''}`;
          btn.type = 'button';
          btn.innerHTML = `${escHtml(c.label)} <span class="chip-count">${c.count}</span>`;
          btn.onclick = () => onFilterSelect('toggle_secondary', c.id);
          df.appendChild(btn);
        }
      } else if (secMode === 'quality') {
        secGrid.classList.add('flex-mode');
        for (const q of qualities) {
          const btn = document.createElement('button');
          const isSelected = state.secondaryFilters.quality.includes(q.id);
          btn.className = `filter-chip ${isSelected ? 'active' : ''}`;
          btn.type = 'button';
          btn.innerHTML = `${escHtml(q.id.toUpperCase())} <span class="chip-count">${q.count}</span>`;
          btn.onclick = () => onFilterSelect('toggle_secondary', q.id);
          df.appendChild(btn);
        }
      }
      secGrid.appendChild(df);
  }
}
// Pagination

function renderPagination(container, total, current, onPage) {
  container.innerHTML = '';
  if (total <= 1) return;
  const frag = document.createDocumentFragment();
  // Prev button
  frag.appendChild(createPageBtn('', current <= 1, () => onPage(current - 1), 'Previous page', true, 'fa-chevron-left'));
  // Page numbers with ellipsis
  const pages = getPageRange(current, total);
  for (const p of pages) {
    if (p === '...') {
      const el = document.createElement('span');
      el.className = 'page-ellipsis';
      el.textContent = '...';
      frag.appendChild(el);
    } else {
      frag.appendChild(createPageBtn(p, false, () => onPage(p), `Page ${p}`, false, null, p === current));
    }
  }
  // Next button
  frag.appendChild(createPageBtn('', current >= total, () => onPage(current + 1), 'Next page', true, 'fa-chevron-right'));
  container.appendChild(frag);
}
function createPageBtn(label, disabled, onClick, ariaLabel, isIcon = false, iconClass = null, isActive = false) {
  const btn = document.createElement('button');
  btn.className = `page-btn${isActive ? ' active' : ''}`;
  btn.setAttribute('type', 'button');
  btn.setAttribute('aria-label', ariaLabel);
  if (disabled) btn.disabled = true;
  if (isIcon && iconClass) {
    btn.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
  } else {
    btn.textContent = label;
  }
  if (!disabled) btn.addEventListener('click', onClick);
  return btn;
}
// Generate a concise page range with ellipsis.
function getPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push('...');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}
// Stats Bar
function updateStatsBar(statsEl, { total, showing, page, perPage, filterMode, category, country, quality, secondaryFilters, search, onClearSearch, onClearCategory, onClearCountry, onClearQuality, onClearSecondary }) {
  statsEl.innerHTML = '';
  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  const span = document.createElement('span');
  span.innerHTML = `Showing <strong>${start}&ndash;${end}</strong> of <strong>${total}</strong> channels`;
  statsEl.appendChild(span);

  const createChip = (text, onClear) => {
    const chip = document.createElement('span');
    chip.className = 'stats-search-chip';
    chip.innerHTML = `<strong>${text}</strong>`;
    if (onClear) {
      const clearBtn = document.createElement('button');
      clearBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      clearBtn.className = 'stats-search-clear';
      clearBtn.type = 'button';
      clearBtn.onclick = onClear;
      chip.appendChild(clearBtn);
    }
    return chip;
  };
  // Primary filter
  if (country !== 'all') {
    const t = document.createElement('span'); t.innerHTML = ' in '; statsEl.appendChild(t);
    const arr = Array.isArray(country) ? country : [country];
    arr.forEach(c => statsEl.appendChild(createChip(c.toUpperCase(), () => onClearCountry(c))));
  }
  // Secondary filters
  const hasSec = secondaryFilters && (secondaryFilters.country.length > 0 || secondaryFilters.category.length > 0 || secondaryFilters.quality.length > 0);
  if (hasSec) {
    const t = document.createElement('span'); t.innerHTML = ' with '; statsEl.appendChild(t);
    
    secondaryFilters.country.forEach(sf => {
      statsEl.appendChild(createChip(sf.toUpperCase(), () => onClearSecondary(sf)));
    });
    secondaryFilters.category.forEach(sf => {
      statsEl.appendChild(createChip(formatCategory(sf), () => onClearSecondary(sf)));
    });
    secondaryFilters.quality.forEach(sf => {
      statsEl.appendChild(createChip(sf.toUpperCase(), () => onClearSecondary(sf)));
    });
  }
  // Search filter
  if (search) {
    const t = document.createElement('span'); t.innerHTML = ' matching '; statsEl.appendChild(t);
    statsEl.appendChild(createChip(escHtml(search), onClearSearch));
  }
}
// Skeleton Loaders
function showSkeletons(grid, count = 24) {
  grid.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const sk = document.createElement('div');
    sk.className = 'skeleton';
    sk.innerHTML = `
      <div class="skeleton__logo skeleton-shimmer"></div>
      <div class="skeleton__body">
        <div class="skeleton__line skeleton__line--title skeleton-shimmer"></div>
        <div class="skeleton__line skeleton__line--meta  skeleton-shimmer"></div>
      </div>
    `;
    frag.appendChild(sk);
  }
  grid.appendChild(frag);
}
// Empty / Error States
function createEmptyState(hasPlaylists = true) {
  const div = document.createElement('div');
  div.className = 'state-empty';
  div.style.gridColumn = '1 / -1';
  
  if (hasPlaylists) {
    div.innerHTML = `
      <div class="state-empty__icon"><i class="fa-solid fa-tv"></i></div>
      <div class="state-empty__title">No channels found</div>
      <div class="state-empty__desc">Try a different search or filter.</div>
    `;
  } else {
    div.style.minHeight = '60vh';

    div.innerHTML = `
      <div class="state-empty__icon"><img src="/assets/img/apple-touch-icon.png" alt="Open IPTV logo" width="72" height="72" /></div>
      <div class="state-empty__title">Welcome to Open IPTV</div>
      <div class="state-empty__desc">Add your first playlist to start watching live TV from around the world.</div>
      <button id="tutorial-add-btn" class="btn btn-primary" style="margin-top: 8px;">
        <i class="fa-solid fa-plus"></i> Add Your First Playlist
      </button>
      <div style="display:flex; align-items:center; gap:8px; margin-top:16px;">
        <span class="filter-chip" style="cursor:default; font-size: var(--fs-micro);">
          <i class="fa-solid fa-lightbulb"></i> Tip
        </span>
        <span style="font-size: var(--fs-sm); color: var(--text-muted);">Paste any <code>.m3u</code> or <code>.m3u8</code> playlist URL to get started</span>
      </div>
    `;
  }
  return div;
}
function showErrorState(grid, message) {
  grid.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'state-error';
  div.style.gridColumn = '1 / -1';
  div.innerHTML = `
    <div class="state-error__icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
    <div class="state-error__title">Failed to load channels</div>
    <div class="state-error__desc">${escHtml(message)}</div>
  `;
  grid.appendChild(div);
}
// Toast Notification
let toastTimer = null;
function showToast(message, type = 'default', duration = 3000) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast ${type}`;
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}
// Helpers
function getInitials(name) {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
export {
  renderChannelGrid,
  renderFilterUI,
  renderPagination,
  updateStatsBar,
  showSkeletons,
  showErrorState,
  showToast,
  getInitials,
  escHtml,
};
