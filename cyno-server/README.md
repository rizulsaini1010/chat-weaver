# Cyno Render Server

This is the Node.js sidecar that runs `cyno6.js` to render the video.
It cannot run inside the web app (Cloudflare Workers can't host `canvas`/`sharp`/`ffmpeg`),
so it runs on your own machine and the editor frontend POSTs to it.

## Prerequisites

- Node.js 20+
- `ffmpeg` available on PATH
- Native build tools for `canvas`/`sharp` (Xcode CLT on macOS, build-essential on Linux)

## Install & run

```bash
cd cyno-server
npm install
npm start
```

Server listens on `http://localhost:8787`.

## How the frontend uses it

1. Open the editor, paste your ElevenLabs / AI33Pro key in Settings.
2. In Settings → "Render backend", set the URL to `http://localhost:8787`
   (this is the default).
3. Click **Render video** in the header. The frontend POSTs:
   - `script` — the serialized script text
   - `settings` — theme, font size, corner radius, etc.
   - `assets` — every uploaded SFX + avatar + image, as data URLs
   - `apiKey`, `ttsProvider`
4. The server writes everything to a temp dir, runs `runTextingVideo`,
   then streams the resulting `.mp4` back as a download.

## Endpoints

- `GET /health` → `{ ok: true }`
- `POST /render` → JSON in, `video/mp4` out
