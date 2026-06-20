// app.js — Home page entry point
import { initTheme, toggleTheme } from './theme.js';
import { loadChannels, getCategories, getCountries, getQualities, filterChannels, paginate } from './channels.js';
import { getPlaylists, addPlaylist, updatePlaylist, deletePlaylist, fetchAndParseM3U } from './playlist.js';
import {
  renderChannelGrid,
  renderFilterUI,
  renderPagination,
  updateStatsBar,
  showSkeletons,
  showErrorState,
  showToast,
} from './ui.js';
// App State
const state = {
  filterMode: 'all',
  country: 'all',
  category: 'all',
  quality: 'all',
  page: 1,
  perPage: 48,
  search: '',
  allChannels: [],
  customChannels: {},
  customPlaylistName: null,
  countries: [],
  categories: [],
  qualities: [],
  userCountry: null,
  secondaryFilterType: null,
  secondaryFilters: {
    country: [],
    category: [],
    quality: []
  },
};
// DOM References
const $ = id => document.getElementById(id);
const DOM = {
  grid: $('channel-grid'),
  filterModes: $('filter-modes'),
  filterSublist: $('filter-sublist'),
  pagination: $('pagination'),
  statsText: $('stats-text'),
  secBtn: $('secondary-filter-btn'),
  secDialog: $('secondary-filter-dialog'),
  secClose: $('secondary-filter-close'),
  secClearBtn: $('secondary-filter-clear-btn'),
  secApplyBtn: $('secondary-filter-apply-btn'),
  searchModalBtn: $('search-modal-btn'),
  searchDialog: $('search-dialog'),
  searchClose: $('search-close'),
  searchInput: $('search-input'),
  searchClear: $('search-clear'),
  searchExecute: $('search-execute-btn'),
  themeToggle: $('theme-toggle'),
  companionBtn: $('companion-modal-btn'),
  companionDialog: $('companion-dialog'),
  companionClose: $('companion-close'),
  addPlaylistBtn: $('add-playlist-btn'),
  playlistDialog: $('playlist-dialog'),
  playlistClose: $('playlist-close'),
  playlistName: $('playlist-name-input'),
  playlistInput: $('playlist-url-input'),
  playlistSave: $('playlist-save-btn'),
  playlistCancel: $('playlist-cancel-btn'),
  playlistListView: $('playlist-list-view'),
  playlistListContainer: $('playlist-list-container'),
  playlistFormView: $('playlist-form-view'),
  addNewPlaylistBtn: $('add-new-playlist-btn'),
  playlistIdInput: $('playlist-id-input'),
};
// Init
async function fetchUserCountry() {
  let uc = sessionStorage.getItem('open-iptv-user-country');
  if (uc) return uc;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2500);
    const res = await fetch('https://get.geojs.io/v1/ip/country.json', { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) throw new Error('API Error');
    const data = await res.json();
    if (data && data.country) {
      sessionStorage.setItem('open-iptv-user-country', data.country);
      return data.country;
    }
  } catch (e) {
    console.warn('Could not fetch user country:', e.message);
  }
  return null;
}
async function init() {
  // 1. Apply theme immediately
  initTheme();
  // 2. Purge any old-version cache keys
  ['open-iptv-channels-cache', 'open-iptv-channels-v2', 'open-iptv-channel-store'].forEach(k => {
    localStorage.removeItem(k);
  });
  // 3. Show skeletons while loading
  showSkeletons(DOM.grid, 24);
  // 3. Restore saved search/category from sessionStorage
  restoreSession();
  // 4. Wire up all event listeners
  bindEvents();
  // 5. Update playlist modal state
  refreshPlaylistModal();
  // 6. Fetch user location
  state.userCountry = await fetchUserCountry();
  // 7. Load channels
  await loadAndRender();
}
// Load & Render (called on init and after state changes)
async function loadAndRender(forceReload = false) {
  try {
    // Only re-fetch if we haven't loaded yet or forced
    if (state.allChannels.length === 0 || forceReload) {
      const playlists = getPlaylists();
      state.customChannels = {};

      const promises = playlists.map(async (p) => {
        try {
          const chs = await fetchAndParseM3U(p.url);
          chs.forEach(ch => ch.playlistName = p.name || 'Unnamed Playlist');
          state.customChannels[p.id] = chs;
        } catch (e) {
          console.warn(`Failed to load ${p.name}: ${e.message}`);
          state.customChannels[p.id] = [];
        }
      });

      await Promise.all(promises);
      state.allChannels = Object.values(state.customChannels).flat();
      state.countries = getCountries(state.userCountry, state.allChannels);
      state.categories = getCategories(state.allChannels);
      state.qualities = getQualities(state.allChannels);
    }
    render();
  } catch (err) {
    showErrorState(DOM.grid, err.message || 'Unknown error. Check your network connection.');
  }
}
// Render current state
function render() {
  let catFilter = state.category;
  let cntFilter = state.country;
  let qualFilter = state.quality;

  if (state.secondaryFilters.country.length > 0) {
    cntFilter = state.secondaryFilters.country;
  }
  if (state.secondaryFilters.category.length > 0) {
    catFilter = state.secondaryFilters.category;
  }
  if (state.secondaryFilters.quality.length > 0) {
    qualFilter = state.secondaryFilters.quality;
  }

  let filtered = [];
  let displayCountries = state.countries;
  let displayCategories = state.categories;
  let displayQualities = state.qualities;

  if (state.filterMode.startsWith('playlist-')) {
    const rawCustom = state.customChannels[state.filterMode] || [];

    filtered = filterChannels({
      channelsList: rawCustom,
      category: catFilter,
      country: cntFilter,
      quality: qualFilter,
      search: state.search
    });

    displayCategories = getCategories(rawCustom);
    displayCountries = getCountries(state.userCountry, rawCustom);
    displayQualities = getQualities(rawCustom);

    const playlists = getPlaylists();
    const p = playlists.find(p => p.id === state.filterMode);
    state.customPlaylistName = p ? p.name : 'Unnamed Playlist';
  } else {
    filtered = filterChannels({ channelsList: state.allChannels, category: catFilter, country: cntFilter, quality: qualFilter, search: state.search });
    state.customPlaylistName = null;
  }
  const { items, totalPages, currentPage, total } = paginate(filtered, state.page, state.perPage);
  // Render filters
  renderFilterUI(
    DOM.filterModes,
    DOM.filterSublist,
    displayCountries,
    displayCategories,
    displayQualities,
    state,
    (type, val) => {
      if (type === 'country') {
        if (val === 'all') {
          state.country = 'all';
        } else {
          let current = Array.isArray(state.country) ? state.country : [];
          if (current.includes(val)) current = current.filter(x => x !== val);
          else current.push(val);
          state.country = current.length > 0 ? current : 'all';
        }
        state.category = 'all';
        state.quality = 'all';
        state.secondaryFilters = { country: [], category: [], quality: [] };
      } else if (type === 'category') {
        if (val === 'all') {
          state.category = 'all';
        } else {
          let current = Array.isArray(state.category) ? state.category : [];
          if (current.includes(val)) current = current.filter(x => x !== val);
          else current.push(val);
          state.category = current.length > 0 ? current : 'all';
        }
        state.country = 'all';
        state.quality = 'all';
        state.secondaryFilters = { country: [], category: [], quality: [] };
      } else if (type === 'quality') {
        if (val === 'all') {
          state.quality = 'all';
        } else {
          let current = Array.isArray(state.quality) ? state.quality : [];
          if (current.includes(val)) current = current.filter(x => x !== val);
          else current.push(val);
          state.quality = current.length > 0 ? current : 'all';
        }
        state.country = 'all';
        state.category = 'all';
        state.secondaryFilters = { country: [], category: [], quality: [] };
      } else if (type === 'toggle_secondary') {
        const secType = state.secondaryFilterType || 'category';
        if (state.secondaryFilters[secType].includes(val)) {
          state.secondaryFilters[secType] = state.secondaryFilters[secType].filter(x => x !== val);
        } else {
          state.secondaryFilters[secType].push(val);
        }
      } else if (type === 'change_secondary_type') {
        state.secondaryFilterType = val;
        // Do not reset secondary filters when switching types
      }
      state.page = 1;
      saveSession();
      render();
      if (type !== 'toggle_secondary' && type !== 'change_secondary_type') {
        DOM.grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  );
  // Render channel cards
  const hasPlaylists = getPlaylists().length > 0;
  renderChannelGrid(DOM.grid, items, state.customPlaylistName, hasPlaylists);
  
  // Wire up the tutorial button if it exists
  const tutorialBtn = document.getElementById('tutorial-add-btn');
  if (tutorialBtn) {
    tutorialBtn.onclick = () => {
      refreshPlaylistModal();
      DOM.playlistDialog?.showModal();
    };
  }
  // Render pagination
  renderPagination(DOM.pagination, totalPages, currentPage, (p) => {
    state.page = p;
    saveSession();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  // Update stats bar
  const filtersBarWrap = document.querySelector('.filters-bar-wrap');
  if (DOM.statsText) {
    if (!hasPlaylists) {
      DOM.statsText.parentElement.style.display = 'none';
      DOM.pagination.style.display = 'none';
      if (filtersBarWrap) filtersBarWrap.style.display = 'none';
    } else {
      DOM.statsText.parentElement.style.display = 'flex';
      DOM.pagination.style.display = '';
      if (filtersBarWrap) filtersBarWrap.style.display = '';
      updateStatsBar(DOM.statsText, {
      total,
      page: currentPage,
      perPage: state.perPage,
      category: state.category,
      country: state.country,
      quality: state.quality,
      secondaryFilters: state.secondaryFilters,
      filterMode: state.filterMode,
      search: state.search,
      onClearSearch: () => {
        if (DOM.searchInput) {
          DOM.searchInput.value = '';
        }
        state.search = '';
        state.page = 1;
        saveSession();
        render();
      },
      onClearCategory: (val) => {
        if (val && Array.isArray(state.category)) {
          state.category = state.category.filter(x => x !== val);
          if (state.category.length === 0) state.category = 'all';
        } else {
          state.category = 'all';
        }
        state.page = 1;
        saveSession();
        render();
      },
      onClearCountry: (val) => {
        if (val && Array.isArray(state.country)) {
          state.country = state.country.filter(x => x !== val);
          if (state.country.length === 0) state.country = 'all';
        } else {
          state.country = 'all';
        }
        state.page = 1;
        saveSession();
        render();
      },
      onClearQuality: (val) => {
        if (val && Array.isArray(state.quality)) {
          state.quality = state.quality.filter(x => x !== val);
          if (state.quality.length === 0) state.quality = 'all';
        } else {
          state.quality = 'all';
        }
        state.page = 1;
        saveSession();
        render();
      },
      onClearSecondary: (val) => {
        state.secondaryFilters.country = state.secondaryFilters.country.filter(x => x !== val);
        state.secondaryFilters.category = state.secondaryFilters.category.filter(x => x !== val);
        state.secondaryFilters.quality = state.secondaryFilters.quality.filter(x => x !== val);
        state.page = 1;
        saveSession();
        render();
      }
    });
    }
  }
}
// Event Binding
function bindEvents() {
  // Filter modes
  DOM.filterModes.addEventListener('click', e => {
    const btn = e.target.closest('.filter-mode-btn');
    if (!btn) return;
    const newMode = btn.getAttribute('data-mode');

    if (newMode !== state.filterMode) {
      state.filterMode = newMode;

      if (state.filterMode === 'all') {
        state.country = 'all';
        state.category = 'all';
        state.quality = 'all';
        state.secondaryFilter = [];
      } else if (state.filterMode === 'country') {
        state.category = 'all';
        state.quality = 'all';
        state.secondaryFilter = [];
      } else if (state.filterMode === 'category') {
        state.country = 'all';
        state.quality = 'all';
        state.secondaryFilter = [];
      } else if (state.filterMode === 'quality') {
        state.country = 'all';
        state.category = 'all';
        state.secondaryFilter = [];
      } else if (state.filterMode === 'custom') {
        state.country = 'all';
        state.category = 'all';
        state.quality = 'all';
        state.secondaryFilter = [];
      } else if (state.filterMode.startsWith('playlist-')) {
        state.country = 'all';
        state.category = 'all';
        state.quality = 'all';
        state.secondaryFilter = [];
      }

      state.page = 1;
      saveSession();
      render();
    }
  });
  // Secondary Filter Modal Events
  if (DOM.secBtn && DOM.secDialog) {
    DOM.secBtn.addEventListener('click', () => {
      DOM.secDialog.showModal();
    });
    DOM.secClose?.addEventListener('click', () => {
      DOM.secDialog.close();
    });
    DOM.secClearBtn?.addEventListener('click', () => {
      state.secondaryFilters = { country: [], category: [], quality: [] };
      saveSession();
      render();
    });
    DOM.secApplyBtn?.addEventListener('click', () => {
      DOM.secDialog.close();
    });
    DOM.secDialog.addEventListener('click', (e) => {
      if (e.target === DOM.secDialog) {
        DOM.secDialog.close();
      }
    });
  }
  // Theme toggle
  DOM.themeToggle?.addEventListener('click', () => {
    const next = toggleTheme();
    showToast(next === 'dark' ? 'Dark mode enabled' : 'Light mode enabled');
  });
  // Companion
  if (DOM.companionBtn && DOM.companionDialog) {
    DOM.companionBtn.addEventListener('click', () => DOM.companionDialog.showModal());
    DOM.companionClose.addEventListener('click', () => DOM.companionDialog.close());
    DOM.companionDialog.addEventListener('click', (e) => {
      if (e.target === DOM.companionDialog) DOM.companionDialog.close();
    });
  }
  // Search Modal
  if (DOM.searchModalBtn && DOM.searchDialog) {
    DOM.searchModalBtn.addEventListener('click', () => {
      DOM.searchDialog.showModal();
      setTimeout(() => DOM.searchInput?.focus(), 50);
    });
    DOM.searchClose?.addEventListener('click', () => {
      DOM.searchDialog.close();
    });
    DOM.searchDialog.addEventListener('click', (e) => {
      if (e.target === DOM.searchDialog) {
        DOM.searchDialog.close();
      }
    });
    DOM.searchExecute?.addEventListener('click', () => {
      DOM.searchDialog.close();
    });
    DOM.searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        DOM.searchDialog.close();
      }
    });
  }
  // Search input (debounced)
  let searchTimer;
  DOM.searchInput?.addEventListener('input', (e) => {
    const val = e.target.value;
    if (DOM.searchClear) DOM.searchClear.style.display = val.length > 0 ? 'block' : 'none';
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = val;
      state.page = 1;
      saveSession();
      render();
    }, 250);
  });
  // Search clear button
  DOM.searchClear?.addEventListener('click', () => {
    if (DOM.searchInput) {
      DOM.searchInput.value = '';
      DOM.searchClear.style.display = 'none';
      DOM.searchInput.focus();
    }
    state.search = '';
    state.page = 1;
    saveSession();
    render();
  });
  // Add Playlist button
  DOM.addPlaylistBtn?.addEventListener('click', () => {
    refreshPlaylistModal();
    DOM.playlistDialog?.showModal();
  });
  // Playlist modal close
  DOM.playlistClose?.addEventListener('click', () => DOM.playlistDialog?.close());
  DOM.playlistCancel?.addEventListener('click', () => DOM.playlistDialog?.close());
  // Close dialog on backdrop click
  DOM.playlistDialog?.addEventListener('click', (e) => {
    if (e.target === DOM.playlistDialog) DOM.playlistDialog.close();
  });
  // Save playlist
  DOM.playlistSave.addEventListener('click', async () => {
    const url = DOM.playlistInput.value.trim();
    const name = DOM.playlistName ? DOM.playlistName.value.trim() : '';
    const id = DOM.playlistIdInput.value;

    if (!url) {
      showToast('Please enter a playlist URL', 'error');
      return;
    }
    if (!url.startsWith('http')) {
      showToast('URL must start with http:// or https://', 'error');
      return;
    }
    DOM.playlistSave.disabled = true;
    DOM.playlistSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
    try {
      if (id) {
        updatePlaylist(id, name, url);
        state.filterMode = id;
      } else {
        const newId = addPlaylist(name, url);
        state.filterMode = newId;
      }

      DOM.playlistDialog?.close();
      showSkeletons(DOM.grid, 24);
      await loadAndRender(true);
      showToast('Playlist saved successfully', 'success');
      refreshPlaylistModal();
    } catch (e) {
      showToast('Failed to save playlist: ' + e.message, 'error');
    } finally {
      DOM.playlistSave.disabled = false;
      DOM.playlistSave.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> Save Playlist';
    }
  });
  // Switch to Form View
  DOM.addNewPlaylistBtn?.addEventListener('click', () => {
    DOM.playlistListView.style.display = 'none';
    DOM.playlistFormView.style.display = 'block';
    DOM.playlistIdInput.value = '';
    DOM.playlistName.value = '';
    DOM.playlistInput.value = '';
  });
  // List View actions (Edit / Delete)
  DOM.playlistListContainer?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.playlist-action-btn');
    if (!btn) return;

    const id = btn.dataset.id;
    const playlists = getPlaylists();
    const playlist = playlists.find(p => p.id === id);

    if (btn.classList.contains('edit')) {
      if (!playlist) return;
      DOM.playlistListView.style.display = 'none';
      DOM.playlistFormView.style.display = 'block';
      DOM.playlistIdInput.value = playlist.id;
      DOM.playlistName.value = playlist.name;
      DOM.playlistInput.value = playlist.url;
    } else if (btn.classList.contains('delete')) {
      deletePlaylist(id);
      if (state.filterMode === id) {
        state.filterMode = 'all';
      }
      showSkeletons(DOM.grid, 24);
      await loadAndRender(true);
      showToast('Custom playlist removed');
      refreshPlaylistModal();
    }
  });
}
// Update custom tab text
function updateCustomTab() {
  const existingTabs = DOM.filterModes.querySelectorAll('[data-mode^="playlist-"]');
  existingTabs.forEach(t => t.remove());
  const playlists = getPlaylists();
  playlists.forEach(p => {
    const tab = document.createElement('button');
    tab.className = `filter-mode-btn ${state.filterMode === p.id ? 'active' : ''}`;
    tab.dataset.mode = p.id;
    tab.type = 'button';
    tab.textContent = p.name || 'Unnamed Playlist';
    DOM.filterModes.appendChild(tab);
  });
}
// Playlist Modal State
function refreshPlaylistModal() {
  const playlists = getPlaylists();
  updateCustomTab();

  if (DOM.playlistListView && DOM.playlistFormView) {
    DOM.playlistListView.style.display = 'block';
    DOM.playlistFormView.style.display = 'none';
  }

  if (DOM.playlistListContainer) {
    DOM.playlistListContainer.innerHTML = '';
    if (playlists.length === 0) {
      DOM.playlistListContainer.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.9rem;">No custom playlists saved yet.</div>';
    } else {
      playlists.forEach(p => {
        const item = document.createElement('div');
        item.className = 'saved-playlist-chip';
        item.style.marginBottom = '10px';

        const safeName = p.name ? p.name.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Unnamed Playlist';
        const safeUrl = p.url ? p.url.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';

        item.innerHTML = `
          <div style="display:flex; flex-direction:column; flex:1; overflow:hidden;">
            <div style="font-weight:800; color:var(--text); font-size:0.9rem; margin-bottom:2px;">${safeName}</div>
            <div class="chip-url" style="color:var(--text-muted); font-weight:normal;" title="${safeUrl}">${safeUrl}</div>
          </div>
          <button class="chip-remove playlist-action-btn edit" data-id="${p.id}" title="Edit" aria-label="Edit playlist">
            <i class="fa-solid fa-pen" aria-hidden="true"></i>
          </button>
          <button class="chip-remove playlist-action-btn delete" data-id="${p.id}" title="Delete" aria-label="Remove playlist">
            <i class="fa-solid fa-trash" aria-hidden="true"></i>
          </button>
        `;
        DOM.playlistListContainer.appendChild(item);
      });
    }
  }
}
// Session persistence (search + category across page nav)
function saveSession() {
  sessionStorage.setItem('open-iptv-session', JSON.stringify({
    filterMode: state.filterMode,
    country: state.country,
    category: state.category,
    quality: state.quality,
    search: state.search,
    page: state.page,
  }));
}
function restoreSession() {
  try {
    const raw = sessionStorage.getItem('open-iptv-session');
    if (!raw) return;
    const s = JSON.parse(raw);
    state.filterMode = s.filterMode || 'all';
    state.country = s.country || 'all';
    state.category = s.category || 'all';
    state.quality = s.quality || 'all';
    state.search = s.search || '';
    state.page = s.page || 1;
    if (DOM.searchInput) DOM.searchInput.value = state.search;
    if (state.search && DOM.searchClear) DOM.searchClear.classList.add('visible');
    if (state.search && DOM.searchWrap) DOM.searchWrap.classList.remove('collapsed');
  } catch { /* ignore */ }
}
// Boot
document.addEventListener('DOMContentLoaded', init);