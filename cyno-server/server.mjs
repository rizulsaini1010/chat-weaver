// Sidecar HTTP server that wraps cyno6.js for the web editor.
// Run locally:  cd cyno-server && npm install && npm start
// Listens on http://localhost:8787

import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTextingVideo, setSettings, setTtsProvider } from "./cyno6.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8787;
const MAX_BODY = 200 * 1024 * 1024; // 200MB

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...CORS, ...headers });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function dataUrlToBuffer(dataUrl) {
  const m = /^data:[^;]+;base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return Buffer.from(m[1], "base64");
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, "");

  if (req.method === "GET" && req.url === "/health") {
    return send(res, 200, JSON.stringify({ ok: true }), {
      "Content-Type": "application/json",
    });
  }

  if (req.method !== "POST" || req.url !== "/render") {
    return send(res, 404, "Not found");
  }

  let workDir;
  try {
    const raw = await readBody(req);
    const payload = JSON.parse(raw.toString("utf8"));
    const {
      script,
      settings = {},
      assets = {}, // { filename: dataUrl } — images, sfx, avatars
      apiKey = "",
      ttsProvider = "elevenlabs",
    } = payload;

    if (!script || typeof script !== "string") {
      return send(res, 400, JSON.stringify({ error: "Missing 'script' string" }), {
        "Content-Type": "application/json",
      });
    }

    workDir = await fsp.mkdtemp(path.join(os.tmpdir(), "cyno-job-"));
    console.log("[cyno-server] job dir:", workDir);

    // Copy fonts + HTML templates next to the work dir's cyno6 expectations
    for (const f of [
      "SF-Pro-Display-Regular.otf",
      "SF-Pro-Display-RegularItalic.otf",
      "SF-Pro-Display-Semibold.otf",
      "plug.html",
      "rizz.html",
    ]) {
      const src = path.join(__dirname, f);
      if (fs.existsSync(src)) await fsp.copyFile(src, path.join(workDir, f));
    }

    // Write uploaded assets
    for (const [name, dataUrl] of Object.entries(assets)) {
      const buf = dataUrlToBuffer(dataUrl);
      if (!buf) continue;
      const safe = path.basename(name);
      await fsp.writeFile(path.join(workDir, safe), buf);
    }

    // Write script
    const scriptPath = path.join(workDir, "script.txt");
    await fsp.writeFile(scriptPath, script, "utf8");

    // Apply settings
    setTtsProvider(ttsProvider);
    setSettings({
      theme: settings.theme,
      greenBubbles: false, // frontend locked to blue
      revealAnim: settings.revealAnimation,
      posterEvery: settings.posterEveryPage,
      fontSize: settings.bubbleFontSize,
      cornerRadius: settings.cornerRadius,
      bottomReserveRatio: settings.bottomReserveRatio,
    });

    const sentSfx = path.join(workDir, "sent.mp3");
    const recvSfx = path.join(workDir, "received.mp3");

    const result = await runTextingVideo(
      scriptPath,
      workDir,
      apiKey,
      fs.existsSync(sentSfx) ? sentSfx : "sent.mp3",
      fs.existsSync(recvSfx) ? recvSfx : "received.mp3",
    );

    const outPath = Array.isArray(result) ? result[0] : result;
    if (!outPath || !fs.existsSync(outPath)) {
      return send(res, 500, JSON.stringify({ error: "No output produced" }), {
        "Content-Type": "application/json",
      });
    }

    const stat = await fsp.stat(outPath);
    res.writeHead(200, {
      ...CORS,
      "Content-Type": "video/mp4",
      "Content-Length": stat.size,
      "Content-Disposition": `attachment; filename="${path.basename(outPath)}"`,
    });
    fs.createReadStream(outPath).pipe(res);
  } catch (err) {
    console.error("[cyno-server] render failed:", err);
    if (!res.headersSent) {
      send(res, 500, JSON.stringify({ error: String(err?.message || err) }), {
        "Content-Type": "application/json",
      });
    }
  }
});

server.listen(PORT, () => {
  console.log(`[cyno-server] listening on http://localhost:${PORT}`);
});
