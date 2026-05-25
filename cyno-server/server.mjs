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

// jobId -> { progress, stage, status: queued|running|done|error, error?, outPath?, workDir? }
const jobs = new Map();

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
      if (size > MAX_BODY) { reject(new Error("Body too large")); req.destroy(); return; }
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

function newJobId() { return Math.random().toString(36).slice(2, 12); }

// Patch a console method to scrape progress markers for one job, restore on done.
function attachProgressListener(jobId) {
  const job = jobs.get(jobId);
  const orig = console.log;
  const update = (progress, stage) => {
    if (typeof progress === "number") job.progress = Math.max(job.progress, progress);
    if (stage) job.stage = stage;
  };
  console.log = (...args) => {
    const line = args.map(String).join(" ");
    try {
      let m;
      if ((m = line.match(/\[TTS PREFETCH\] Starting (\d+)/))) {
        update(5, `Preparing TTS (${m[1]} clips)`);
      } else if ((m = line.match(/\[TTS PREFETCH\] (\d+)\/(\d+)/))) {
        const cur = +m[1], tot = +m[2];
        update(5 + Math.round((cur / tot) * 30), `TTS ${cur}/${tot}`);
      } else if ((m = line.match(/\[TTS PREFETCH\] Done/))) {
        update(35, "TTS ready");
      } else if ((m = line.match(/\[FRAME GEN\] Starting generation for (\d+) scenes/))) {
        job.totalScenes = +m[1];
        update(38, `Generating frames (0/${m[1]})`);
      } else if ((m = line.match(/\[SCENE (\d+)\]/))) {
        const cur = +m[1];
        const tot = job.totalScenes || cur + 1;
        update(38 + Math.round((cur / tot) * 50), `Scene ${cur}/${tot}`);
      } else if (line.includes("Will save final video as:")) {
        update(90, "Encoding video");
      } else if (line.match(/final video:/i)) {
        update(98, "Finalizing");
      }
    } catch {}
    orig.apply(console, args);
  };
  return () => { console.log = orig; };
}

async function runJob(jobId, payload) {
  const job = jobs.get(jobId);
  const detach = attachProgressListener(jobId);
  try {
    const { script, settings = {}, assets = {}, apiKey = "", ttsProvider = "elevenlabs" } = payload;
    if (!script || typeof script !== "string") throw new Error("Missing 'script' string");

    const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), "cyno-job-"));
    job.workDir = workDir;
    console.log("[cyno-server] job dir:", workDir);

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

    for (const [name, dataUrl] of Object.entries(assets)) {
      const buf = dataUrlToBuffer(dataUrl);
      if (!buf) continue;
      const safe = path.basename(name);
      await fsp.writeFile(path.join(workDir, safe), buf);
    }

    const scriptPath = path.join(workDir, "script.txt");
    await fsp.writeFile(scriptPath, script, "utf8");

    setTtsProvider(ttsProvider);
    setSettings({
      theme: settings.theme,
      greenBubbles: false,
      revealAnim: settings.revealAnimation,
      posterEvery: settings.posterEveryPage,
      fontSize: settings.bubbleFontSize,
      cornerRadius: settings.cornerRadius,
      bottomReserveRatio: settings.bottomReserveRatio,
    });

    job.status = "running";
    job.stage = "Starting render";
    job.progress = 2;

    const sentSfx = path.join(workDir, "sent.mp3");
    const recvSfx = path.join(workDir, "received.mp3");
    const result = await runTextingVideo(
      scriptPath, workDir, apiKey,
      fs.existsSync(sentSfx) ? sentSfx : "sent.mp3",
      fs.existsSync(recvSfx) ? recvSfx : "received.mp3",
    );

    const outPath = Array.isArray(result) ? result[0] : result;
    if (!outPath || !fs.existsSync(outPath)) throw new Error("No output produced");
    job.outPath = outPath;
    job.status = "done";
    job.progress = 100;
    job.stage = "Complete";
  } catch (err) {
    console.error("[cyno-server] render failed:", err);
    job.status = "error";
    job.error = String(err?.message || err);
  } finally {
    detach();
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, "");

  if (req.method === "GET" && req.url === "/health") {
    return send(res, 200, JSON.stringify({ ok: true }), { "Content-Type": "application/json" });
  }

  // POST /render — enqueue job, return jobId
  if (req.method === "POST" && req.url === "/render") {
    try {
      const raw = await readBody(req);
      const payload = JSON.parse(raw.toString("utf8"));
      const jobId = newJobId();
      jobs.set(jobId, { progress: 0, stage: "Queued", status: "queued" });
      // Fire & forget
      runJob(jobId, payload);
      return send(res, 200, JSON.stringify({ jobId }), { "Content-Type": "application/json" });
    } catch (e) {
      return send(res, 400, JSON.stringify({ error: String(e?.message || e) }),
        { "Content-Type": "application/json" });
    }
  }

  // GET /progress/:jobId
  let m = /^\/progress\/([a-z0-9]+)$/i.exec(req.url || "");
  if (req.method === "GET" && m) {
    const job = jobs.get(m[1]);
    if (!job) return send(res, 404, JSON.stringify({ error: "Unknown jobId" }),
      { "Content-Type": "application/json" });
    return send(res, 200, JSON.stringify({
      progress: job.progress, stage: job.stage, status: job.status, error: job.error,
    }), { "Content-Type": "application/json" });
  }

  // GET /result/:jobId
  m = /^\/result\/([a-z0-9]+)$/i.exec(req.url || "");
  if (req.method === "GET" && m) {
    const job = jobs.get(m[1]);
    if (!job) return send(res, 404, "Unknown jobId");
    if (job.status !== "done" || !job.outPath) return send(res, 409, "Not ready");
    const stat = await fsp.stat(job.outPath);
    res.writeHead(200, {
      ...CORS,
      "Content-Type": "video/mp4",
      "Content-Length": stat.size,
      "Content-Disposition": `attachment; filename="${path.basename(job.outPath)}"`,
    });
    fs.createReadStream(job.outPath).pipe(res);
    return;
  }

  return send(res, 404, "Not found");
});

server.listen(PORT, () => {
  console.log(`[cyno-server] listening on http://localhost:${PORT}`);
});
