# Open IPTV: Live TV Browser & Player

## Introduction

A free, open-source IPTV channel browser and player built with pure HTML, CSS, and JavaScript. Add your own custom M3U/M3U8 playlists, browse your live TV channels, organize them by category, and watch using a built-in HLS player.

## Features

- **Custom Playlists**: Seamlessly add and manage your own custom M3U/M3U8 playlists.
- **Smart Aggregation**: View channels from individual playlists, or aggregate all of them into a master list.
- **Advanced Filtering**: Automatically parses channel qualities (UHD, FHD, HD, SD), countries, and categories for easy filtering and real-time search.
- **Live Stream Player**: HLS.js-powered live stream player on a dedicated page.
- **Premium Design**: Beautiful, modern aesthetic with dynamic micro-animations and system-aware light/dark themes.
- **Companion Extension**: Enhance your experience with the [Open IPTV Companion Extension](#) to resolve cross-origin (CORS) playback restrictions and load custom XMLTV guides for real-time schedules.
- **Zero Build Step**: Pure static files with no complex build processes.

## How to use?

### Local Development

Serve with any static file server:

```bash
# Using npx serve (recommended)
cd open-iptv
npx serve .

# Or Python
python3 -m http.server 8080
```

Then open `http://localhost:3000` (or `8080`).

> **Note:** Do NOT open `index.html` directly via `file://` — CORS restrictions will prevent the API from loading.


## Data Sources

- Open IPTV is strictly a standalone client-side media player.
- Users must provide their own M3U/M3U8 playlists.
- Open IPTV does not host, provide, or distribute any media content.
- **Disclaimer**: The author is not responsible for the content users choose to load into the player. Any use of this software to access private, copyrighted, or illegal content is done entirely at the user's own risk.

## Contact

For any inquiries or feedback, you can reach me at moefqy@rocketmail.com.
