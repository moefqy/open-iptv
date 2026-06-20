// player.js — Dedicated player page logic
import { initTheme, toggleTheme } from './theme.js';
import { getInitials, escHtml, showToast } from './ui.js';
import { formatCategory, loadChannels } from './channels.js';
import { getPlaylists, fetchAndParseM3U } from './playlist.js';
// DOM References
const $ = id => document.getElementById(id);
const DOM = {
  video: $('player-video'),
  iframe: $('player-iframe'),
  loadingOverlay: $('video-loading'),
  errorOverlay: $('video-error'),
  errorDesc: $('video-error-desc'),
  retryBtn: $('retry-btn'),
  themeToggle: $('theme-toggle'),
  // Header
  headerLogo: $('header-channel-logo'),
  headerInitials: $('header-channel-initials'),
  headerName: $('header-channel-name'),
  headerCountry: $('header-channel-country'),
  // Info panel
  infoLogo: $('info-channel-logo'),
  infoInitials: $('info-channel-initials'),
  infoName: $('info-channel-name'),
  infoBadges: $('info-channel-badges'),
  infoStreamUrl: $('info-stream-url'),
  copyUrlBtn: $('copy-url-btn'),
};
// Init
async function init() {
  initTheme();
  DOM.themeToggle?.addEventListener('click', () => toggleTheme());
  const slugMatch = window.location.pathname.match(/\/watch\/(.+)/);
  if (!slugMatch) {
    window.location.replace('/');
    return;
  }
  const fullSlug = slugMatch[1];

  // Check if it's a custom playlist route
  let isCustomRoute = false;
  let customPlaylistName = '';
  let channelSlug = fullSlug;
  const parts = fullSlug.split('/');
  if (parts.length === 2) {
    isCustomRoute = true;
    customPlaylistName = decodeURIComponent(parts[0]);
    channelSlug = parts[1];
  }
  showLoading();
  try {
    let allChannels = [];
    if (isCustomRoute) {
      const playlists = getPlaylists();
      const playlist = playlists.find(p => (p.name || 'Unnamed Playlist') === customPlaylistName);
      if (playlist && playlist.url) {
        allChannels = await fetchAndParseM3U(playlist.url).catch(() => []);
      }
    } else {
      allChannels = await loadChannels();
    }
    // Find the matching channel by slug
    const channel = allChannels.find(ch => ch.slug === channelSlug);
    if (!channel) {
      showPlayerError(`Channel not found for slug: ${escHtml(channelSlug)}`, false);
      return;
    }
    // Update page title
    document.title = `${channel.name} — Open IPTV`;
    // Populate UI
    populateHeader(channel);
    populateInfoPanel(channel);
    // Start playback
    startPlayback(channel);
    // Fetch EPG data
    fetchEpgData(channel.id);
    // Listeners
    if (DOM.copyUrlBtn) {
      DOM.copyUrlBtn.addEventListener('click', () => {
        if (!DOM.infoStreamUrl.textContent) return;
        navigator.clipboard.writeText(DOM.infoStreamUrl.textContent)
          .then(() => showToast('URL Copied!'))
          .catch(() => showToast('Failed to copy', true));
      });
    }
  } catch (err) {
    showPlayerError('Failed to load channel data.', false);
  }

  if (DOM.retryBtn) {
    DOM.retryBtn.addEventListener('click', () => {
      const video = DOM.video;
      if (video) video.play().catch(() => { });
      hideLoading();
    });
  }
}
function fetchEpgData(tvgId) {
  if (!tvgId) return;

  // Set up one-time listener
  const listener = (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.type === 'OPEN_IPTV_EPG_RESPONSE' && event.data.tvgId === tvgId) {
      window.removeEventListener('message', listener);
      renderEpg(event.data.response);
    }
  };

  window.addEventListener('message', listener);

  // Send request
  window.postMessage({ type: 'OPEN_IPTV_GET_EPG', tvgId }, '*');

  // Timeout in case extension isn't installed
  setTimeout(() => {
    window.removeEventListener('message', listener);
  }, 2000);
}
function renderEpg(res) {
  const epgPanel = document.getElementById('epg-panel');
  const epgCurrentTitle = document.getElementById('epg-current-title');
  const epgCurrentTime = document.getElementById('epg-current-time');
  const epgCurrentDesc = document.getElementById('epg-current-desc');
  const epgNext = document.getElementById('epg-next');
  const epgNextList = document.getElementById('epg-next-list');
  const hasNext = Array.isArray(res?.program?.next) ? res.program.next.length > 0 : !!res?.program?.next;
  if (!res || !res.success || !res.program || (!res.program.current && !hasNext)) {
    return;
  }
  epgPanel.style.display = 'block';

  const formatTime = (ts) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const current = res.program.current;
  const next = res.program.next;
  if (current) {
    epgCurrentTitle.textContent = current.title;
    epgCurrentTime.textContent = `${formatTime(current.start)} - ${formatTime(current.stop)}`;
    epgCurrentDesc.textContent = current.desc || '';
  } else {
    epgCurrentTitle.textContent = 'No Schedule Available';
    epgCurrentTime.textContent = '';
    epgCurrentDesc.textContent = '';
  }
  if (hasNext) {
    epgNext.style.display = 'block';
    if (epgNextList) {
      const nextArr = Array.isArray(next) ? next : [next];
      epgNextList.innerHTML = nextArr.map((p, idx) => `
        <div class="epg-next-program" style="${idx > 0 ? 'margin-top: 12px;' : ''}">
          <div class="epg-title">${escHtml(p.title)}</div>
          <div class="epg-time">${formatTime(p.start)} - ${formatTime(p.stop)}</div>
        </div>
      `).join('');
    }
  } else {
    epgNext.style.display = 'none';
  }
}
// Populate Header
function populateHeader(ch) {
  const initials = getInitials(ch.name);
  if (DOM.headerName) DOM.headerName.textContent = ch.name;
  if (ch.logo && DOM.headerLogo) {
    DOM.headerLogo.src = ch.logo;
    DOM.headerLogo.alt = `${ch.name} logo`;
    DOM.headerLogo.onerror = function () {
      this.classList.add('errored');
      if (DOM.headerInitials) {
        DOM.headerInitials.style.display = 'flex';
        DOM.headerInitials.textContent = initials;
      }
    };
  } else {
    if (DOM.headerLogo) DOM.headerLogo.style.display = 'none';
    if (DOM.headerInitials) {
      DOM.headerInitials.style.display = 'flex';
      DOM.headerInitials.textContent = initials;
    }
  }
}
// Populate Info Panel
function populateInfoPanel(ch) {
  const initials = getInitials(ch.name);
  
  let resolvedCountryName = null;
  if (ch.country) {
    resolvedCountryName = ch.country.toUpperCase();
    if (resolvedCountryName !== 'XX') {
      try {
        const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
        resolvedCountryName = regionNames.of(resolvedCountryName) || resolvedCountryName;
      } catch (e) {
        // fallback to code
      }
    } else {
      resolvedCountryName = 'Undefined';
    }
  }

  if (DOM.infoName) {
    let nameHtml = `<span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 1;">${escHtml(ch.name || 'Unnamed Channel')}</span>`;
    if (resolvedCountryName) {
      let mobileCountryId = ch.country ? ch.country.toUpperCase() : 'XX';
      nameHtml += `<span class="country-pin desktop-hidden" style="flex-shrink: 0;"><i class="fa-solid fa-location-dot fa-xs" aria-hidden="true" style="margin-right: 4px;"></i>${escHtml(mobileCountryId)}</span>`;
    }
    DOM.infoName.innerHTML = nameHtml;
    DOM.infoName.style.display = 'flex';
    DOM.infoName.style.alignItems = 'center';
    DOM.infoName.style.justifyContent = 'space-between';
    DOM.infoName.title = ch.name || 'Unnamed Channel';
  }
  // Logo
  if (ch.logo && DOM.infoLogo) {
    DOM.infoLogo.src = ch.logo;
    DOM.infoLogo.alt = `${ch.name} logo`;
    DOM.infoLogo.onerror = function () {
      this.classList.add('errored');
      if (DOM.infoInitials) {
        DOM.infoInitials.style.display = 'flex';
        DOM.infoInitials.textContent = initials;
      }
    };
  } else {
    if (DOM.infoLogo) DOM.infoLogo.style.display = 'none';
    if (DOM.infoInitials) {
      DOM.infoInitials.style.display = 'flex';
      DOM.infoInitials.textContent = initials;
    }
  }
  // Badges
  if (DOM.infoBadges) {
    const badges = [];
    for (const cat of ch.categories) {
      if (cat) {
        badges.push(`<span class="badge badge-category">
          <i class="fa-solid fa-tag fa-xs" aria-hidden="true"></i>${escHtml(formatCategory(cat))}
        </span>`);
      }
    }
    for (const tag of (ch.tags || [])) {
      badges.push(`<span class="badge badge-tag">${escHtml(tag)}</span>`);
    }
    if (resolvedCountryName) {
      badges.push(`<span class="country-pin mobile-hidden">
        <i class="fa-solid fa-location-dot fa-xs" aria-hidden="true"></i>${escHtml(resolvedCountryName)}
      </span>`);
    }
    DOM.infoBadges.innerHTML = badges.join('');
  }
  // Stream URL
  if (DOM.infoStreamUrl) {
    DOM.infoStreamUrl.textContent = ch.url;
    DOM.infoStreamUrl.title = ch.url;
  }
}
// HLS Playback
let hlsInstance = null;
function startPlayback(channel) {
  const video = DOM.video;
  const iframe = DOM.iframe;
  if (!video) return;
  showLoading();
  // Destroy any existing HLS instance
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  let url = channel.url;

  // Auto-upgrade insecure github.io URLs to https to avoid Mixed Content blocks
  if (url.startsWith('http://') && url.includes('github.io')) {
    url = url.replace(/^http:\/\//i, 'https://');
  }
  // Check for Twitch
  const twitchMatch = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
  if (twitchMatch) {
    video.style.display = 'none';
    video.pause();
    if (iframe) {
      iframe.style.display = 'block';
      const hostname = window.location.hostname;
      iframe.src = `https://player.twitch.tv/?channel=${twitchMatch[1]}&parent=${hostname}`;
    }
    hideLoading();
    return;
  }
  // Check for YouTube
  const ytMatch = url.match(/(?:youtube\.com|youtu\.be)/i);
  if (ytMatch) {
    video.style.display = 'none';
    video.pause();
    hideLoading();
    let embedUrl = null;
    // Try to extract standard VIDEO_ID
    const videoIdMatch = url.match(/(?:watch\?v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    if (videoIdMatch) {
      embedUrl = `https://www.youtube.com/embed/${videoIdMatch[1]}?autoplay=1`;
    } else {
      // Try to extract CHANNEL_ID for live streams
      const channelIdMatch = url.match(/channel\/([a-zA-Z0-9_-]+)/);
      if (channelIdMatch) {
        embedUrl = `https://www.youtube.com/embed/live_stream?channel=${channelIdMatch[1]}&autoplay=1`;
      }
    }
    if (embedUrl) {
      if (iframe) {
        iframe.style.display = 'block';
        iframe.src = embedUrl;
      }
    } else {
      // Handle-based (@username) or custom (/c/name) links cannot be embedded directly
      if (iframe) iframe.style.display = 'none';
      const extLink = `<br><br><a href="${escHtml(url)}" target="_blank" class="btn btn-primary" style="display:inline-flex; align-items:center; gap:8px; text-decoration:none;"><i class="fa-brands fa-youtube"></i> Watch on YouTube</a>`;
      showPlayerError(`This YouTube Live stream cannot be embedded directly.${extLink}`, false);
    }
    return;
  }
  // Fallback to video player
  if (iframe) {
    iframe.style.display = 'none';
    iframe.src = '';
  }
  video.style.display = 'block';
  // HLS.js supported
  if (window.Hls && Hls.isSupported()) {
    const hls = new Hls({
      enableWorker: false, // Disabled so CORS extensions can intercept requests
      lowLatencyMode: true,
      backBufferLength: 30,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      maxBufferSize: 50 * 1000 * 1000, // 50 MB hard cap
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      hideLoading();
      video.play().catch(() => { });
    });
    let networkErrorCount = 0;
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR) {
              hls.destroy();
              showPlayerError('Failed to load stream manifest...', true);
              diagnoseStream(url);
            } else {
              networkErrorCount++;
              if (networkErrorCount > 3) {
                hls.destroy();
                showPlayerError('Connection lost. The stream seems to be offline.', true);
              } else {
                showToast(`Network error, retrying... (${networkErrorCount}/3)`);
                hls.startLoad();
              }
            }
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            showToast('Media error, attempting to recover...');
            hls.recoverMediaError();
            break;
          default:
            hls.destroy();
            showPlayerError(
              'The stream could not be loaded. It may be geo-restricted, offline, or the URL has expired.',
              true
            );
        }
      }
    });
    hlsInstance = hls;
    // Safari native HLS support
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    video.addEventListener('loadedmetadata', () => {
      hideLoading();
      video.play().catch(() => { });
    }, { once: true });
    video.addEventListener('error', () => {
      showPlayerError('The stream could not be loaded...', true);
      diagnoseStream(url);
    }, { once: true });
  } else {
    showPlayerError('Your browser does not support HLS streaming. Try Chrome, Firefox, or Safari.', false);
  }
}
// Loading / Error Overlays
let loadingTimeout;
function showLoading() {
  DOM.loadingOverlay?.classList.remove('hidden');
  hideError();

  clearTimeout(loadingTimeout);
  loadingTimeout = setTimeout(() => {
    if (!DOM.loadingOverlay?.classList.contains('hidden')) {
      showToast('The stream is taking longer than usual to load. It might be offline.');
    }
  }, 10000);
}
function hideLoading() {
  DOM.loadingOverlay?.classList.add('hidden');
  clearTimeout(loadingTimeout);
}
function showPlayerError(message, showRetry = true) {
  hideLoading();
  if (DOM.errorOverlay) DOM.errorOverlay.classList.add('visible');
  if (DOM.errorDesc) DOM.errorDesc.innerHTML = message;
  if (DOM.retryBtn) DOM.retryBtn.style.display = showRetry ? '' : 'none';
}
async function diagnoseStream(url) {
  if (!DOM.errorDesc) return;
  DOM.errorDesc.innerHTML = 'Diagnosing stream...';

  try {
    // 1. Try a standard fetch first. This will fail if there is a strict CORS block.
    // If it succeeds, we can read the HTTP status code (like 403 Forbidden or 404 Not Found)
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    
    if (response.status === 403) {
      DOM.errorDesc.innerHTML = 'Stream Access Denied (403 Forbidden).<br><br>This channel is geo-blocked in your country or requires premium access.';
      return;
    }
    if (response.status === 404) {
      DOM.errorDesc.innerHTML = 'Stream Not Found (404).<br><br>The channel has moved or is no longer broadcasting at this address.';
      return;
    }
    if (!response.ok) {
      DOM.errorDesc.innerHTML = `Stream Error (${response.status}).<br><br>The server responded with an error.`;
      return;
    }
    
    // If we get here, the server says 200 OK, but hls.js still failed.
    DOM.errorDesc.innerHTML = 'Stream format is unsupported or encrypted (DRM).';

  } catch (err) {
    // 2. Standard fetch failed. This means either:
    //    a) The server is completely dead/offline.
    //    b) The server blocked the request due to CORS.
    try {
      // Try a no-cors fetch. If the server is alive, it will succeed (but give us an opaque response).
      await fetch(url, { mode: 'no-cors', cache: 'no-store' });
      
      // Server is alive! Therefore the previous failure was definitely a CORS block.
      DOM.errorDesc.innerHTML = 'Stream blocked by browser security (CORS).<br><br><strong>Fix:</strong> Turn ON the Companion extension to play.';
    } catch (deadErr) {
      // Server is completely unreachable
      DOM.errorDesc.innerHTML = 'This stream server is completely offline or dead.<br><br>The channel is no longer broadcasting at this address.';
    }
  }
}
function hideError() {
  DOM.errorOverlay?.classList.remove('visible');
}
// Boot
document.addEventListener('DOMContentLoaded', init);