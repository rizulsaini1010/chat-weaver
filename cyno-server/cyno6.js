import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCanvas, loadImage, registerFont } from "canvas";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const W = 1080;
const H = 1920;
const CHAT_W = Math.trunc(620 * 1.5);
let BG_COLOR = [0, 255, 0];
const TOPBAR_H = Math.trunc(150 * 1.5);
const FONT_PATH = "SF-Pro-Display-Regular.otf";
const FONT_FAMILY = "SF Pro Display";
const FONT_VARIANTS = [
  { file: "SF-Pro-Display-Regular.otf", weight: "400", alias: "SFProDisplayRegular" },
  { file: "SF-Pro-Display-Medium.otf", weight: "500", alias: "SFProDisplayMedium" },
  { file: "SF-Pro-Display-Semibold.otf", weight: "600", alias: "SFProDisplaySemibold" },
  { file: "SF-Pro-Display-Bold.otf", weight: "700", alias: "SFProDisplayBold" }
];
let BOTTOM_RESERVE_RATIO = 0.3;
let CORNER_RADIUS = Math.trunc(36 * 1.5);
let BUBBLE_FONT_SIZE = 40;
const BUBBLE_RADIUS_SCALE = 2.0; // increase above 1.0 to get rounder corners, e.g. 1.4


let IMAGE_BASE_DIR = ".";
let SENT_SFX = "sent.mp3";
let RECEIVED_SFX = "received.mp3";
let TTS_CACHE_DIR = "tts_cache";
let TTS_PROVIDER = "elevenlabs";
let ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";


let POSTER_EVERY_PAGE = false;
let REVEAL_ANIMATION_ENABLED = true;
let USE_GREEN_BUBBLES = false;
const GREEN_BUBBLE_COLOR = [52, 210, 89];

const PLUGAI_URL = process.env.PLUGAI_URL || path.resolve(__dirname, "plug.html");
const PLUGAI_SCALE = 0.60;
const RIZZ_URL = process.env.RIZZ_URL || "https://rizz-template.vercel.app/";
const RIZZ_SCALE = 1.15;
const RIZZ_REVEAL_RATIO = 0.65;

const IMAGE_EXT_RE = /\.(png|jpg|jpeg|gif|webp)$/i;

const THEMES = {
  dark: {
    chat_bg: [0, 0, 0],
    bubble_sent: [29, 119, 254],
    bubble_rcvd: [39, 39, 39],
    header_bg_hex: "#1b191c",
    name_fill_hex: "#e9e9e9",
    name_weight: "600",
    avatar_bg_rgba: [0, 0, 0, 0],
    rcvd_text_color: [255, 255, 255, 255],
    filename_tag: "dark"
  },
  light: {
    chat_bg: [254, 254, 254],
    bubble_sent: [32, 141, 246],
    bubble_rcvd: [232, 232, 232],
    header_bg_hex: "#F2F2F7",
    name_fill_hex: "#111111",
    name_weight: "400",
    avatar_bg_rgba: [242, 242, 247, 255],
    rcvd_text_color: [0, 0, 0, 255],
    filename_tag: "light"
  }
};
let THEME = THEMES.dark;

const EMOJI_BASE_SRC = [
  "[\\u{1F600}-\\u{1F64F}]",
  "[\\u{1F300}-\\u{1F5FF}]",
  "[\\u{1F680}-\\u{1F6FF}]",
  "[\\u{1F700}-\\u{1F77F}]",
  "[\\u{1F780}-\\u{1F7FF}]",
  "[\\u{1F800}-\\u{1F8FF}]",
  "[\\u{1F900}-\\u{1F9FF}]",
  "[\\u{1FA00}-\\u{1FA6F}]",
  "[\\u{1FA70}-\\u{1FAFF}]",
  "[\\u{2600}-\\u{26FF}]",
  "[\\u{2700}-\\u{27BF}]",
  "[\\u{1F1E0}-\\u{1F1FF}]"
].join("|");
const EMOJI_SEQUENCE_SRC =
  `(?:${EMOJI_BASE_SRC})(?:[\\u{1F3FB}-\\u{1F3FF}])?(?:\\uFE0F)?(?:\\u20E3)?` +
  `(?:(?:\\u200D(?:${EMOJI_BASE_SRC})(?:[\\u{1F3FB}-\\u{1F3FF}])?(?:\\uFE0F)?)*)`;
const STRAY_EMOJI_CTRL_RE = /[\uFE0F\u200D\u20E3\u{1F3FB}-\u{1F3FF}]/gu;
const EMOJI_CACHE_DIR = "emoji_cache";
const emojiImageCache = new Map();

const TAIL_PATH_D =
  "M16.8869 20.1846C11.6869 20.9846 6.55352 18.1212 4.88685 16.2879" +
  "C6.60472 12.1914 -4.00107 2.24186 2.99893 2.24148" +
  "C4.61754 2.24148 6 -1.9986 11.8869 1.1846" +
  "C11.9081 2.47144 11.8869 6.92582 11.8869 7.6842" +
  "C11.8869 18.1842 17.8869 19.5813 16.8869 20.1846Z";
const TAIL_VW = 17;
const TAIL_VH = 21;
const tailCache = new Map();

const AI33PRO_VOICE_MAP = {
  adam: "pNInz6obpgDQGcFmaJgB",
  bill: "pqHfZKP75CvOlQylNhV4",
  brian: "nPczCjzI2devNBz1zQrb",
  callum: "N2lVS1w4EtoT3dr4eOWO",
  charlie: "IKne3meq5aSn9XLyUdCD",
  chris: "iP95p4xoKVk53GoZ742B",
  daniel: "onwK4e9ZLuTAKqWW03F9",
  eric: "cjVigY5qzO86Huf0OWal",
  george: "JBFqnCBsd6RMkjVDRZzb",
  harry: "SOYHLrjzK2X1ezoPC6cr",
  krishna: "m5qndnI7u4OAdXhH0Mr5",
  liam: "TX3LPaxmHKxFdv7VOQHJ",
  mark: "UgBBYS2sOqTuMpoF3BR0",
  edward: "goT3UYdM9bhm0n2lmKQx",
  vincent: "uju3wxzG5OhpWcoi3SMy",
  andrew: "gUABw7pXQjhjt0kNFBTF",
  niraj: "zgqefOY5FPQ3bB7OZTVR",
  roger: "CwhRBWXzGAHq8TQ4Fs17",
  will: "bIHbv24MWmeRgasZH58o",
  antoine: "ErXwobaYiN019PkySvjV",
  alice: "Xb7hH8MSUJpSbSDYk0k2",
  bella: "hpp4J3VqNfWAUOO0d1Us",
  jessica: "cgSgspJ2msm6clMCkdW9",
  laura: "FGY2WhTYpPnrIDTdsKH5",
  zara: "jqcCZkN6Knx8BJ5TBdYR",
  lily: "pFZP5JQG7iQjIQuC4Bku",
  matilda: "XrExE9yKIg1WjnnlVkGX",
  jessa: "yj30vwTGJxSHezdAGsv9",
  muskan: "xoV6iGVuOGYHLWjXhVC7",
  sarah: "EXAVITQu4vr4xnSDxMaL",
  patrick: "qwaVDEGNsBllYcZO1ZOJ",
  cassidy: "56AoDkrOh6qfVPDXZ7Pt",
  river: "SAz9YHcvj6GT2YYXdXww",
  arnold: "VR6AewLTigWG4xSOukaG",
  clyde: "2EiwWnXFnvU5JabPnv8n",
  james: "ZQe5CZNOzWyzPSCn5a3c",
  josh: "TxGEqnHWrfWFTfGW9XjX",
  sam: "yoZ06aMxZJJ28mfd3POQ",
  thomas: "GBv7mTt0atIp3Br8iCZE",
  charlotte: "XB0fDUnXU5powFXDhCwa",
  dorothy: "ThT5KcBeYPX3keUQqHPh",
  emily: "LcfcDJNUP1GQjkzn1xUU",
  ella: "MF3mGyEYCl7XYWbV9V6O",
  nancy: "S9E1QZkJ9KpFqk6Gz7pB",
  rachel: "21m00Tcm4TlvDq8ikWAM",
  sophie: "bML4oZ8ZkR6kF5pQWZyN",
  robot: "D38z5RcWu1voky8WS1ja"
};

const MINIMAX_VOICE_MAP = {
  mx_friendly: "209533299589184"
};

function rgb(v) {
  return `rgb(${v[0]}, ${v[1]}, ${v[2]})`;
}

function rgba(v) {
  return `rgba(${v[0]}, ${v[1]}, ${v[2]}, ${(v[3] ?? 255) / 255})`;
}

function hexFromRgb(v) {
  return `#${v.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function ensureDirSync(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeText(text) {
  return String(text)
    .replace(/\u2019|\u2018/g, "'")
    .replace(/\u201c|\u201d/g, "\"")
    .replace(/\u2014|\u2013/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ");
}

function emojiRegex() {
  return new RegExp(EMOJI_SEQUENCE_SRC, "gu");
}

function emojiMatches(text) {
  return [...String(text).matchAll(emojiRegex())].map((m) => m[0]);
}

function stripBlurMarkers(text) {
  return String(text).replace(/\{([^}]*)\}/g, "$1");
}

function extractBlurRuns(text) {
  const runs = [];
  let last = 0;
  for (const m of String(text).matchAll(/\{([^}]*)\}/g)) {
    if (m.index > last) runs.push([text.slice(last, m.index), false]);
    runs.push([m[1], true]);
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push([text.slice(last), false]);
  return runs;
}

function stripEmojisForTts(text) {
  return String(text)
    .replace(emojiRegex(), " ")
    .replace(STRAY_EMOJI_CTRL_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isEmojiOnlyMessage(text) {
  let stripped = String(text).replace(emojiRegex(), "");
  stripped = stripped.replace(STRAY_EMOJI_CTRL_RE, "");
  stripped = stripped.replace(/\.{2,}|\u2026/g, "");
  stripped = stripped.replace(/[?!.,;:'"()[\]{}<>@#$%^&*+=_~`|\\/ \t\n\r-]+/g, "");
  return stripped.length === 0;
}

function tokenizeMixedText(text) {
  const tokens = [];
  let last = 0;
  for (const m of String(text).matchAll(emojiRegex())) {
    if (m.index > last) tokens.push([text.slice(last, m.index), false]);
    tokens.push([m[0], true]);
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push([text.slice(last), false]);
  return tokens;
}

function getEmojiCodepoints(emojiChar, stripFe0f = false) {
  return [...emojiChar]
    .filter((c) => {
      const cp = c.codePointAt(0);
      if (cp === 0x20e3) return false;
      if (stripFe0f && cp === 0xfe0f) return false;
      return true;
    })
    .map((c) => c.codePointAt(0).toString(16))
    .join("-");
}

async function fetchBuffer(url, options = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    const ab = await resp.arrayBuffer();
    return { resp, buffer: Buffer.from(ab), text: () => Buffer.from(ab).toString("utf8") };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAppleEmoji(emojiChar, size) {
  const cacheKey = `${emojiChar}|${size}`;
  if (emojiImageCache.has(cacheKey)) return emojiImageCache.get(cacheKey);

  ensureDirSync(EMOJI_CACHE_DIR);

  async function tryFetch(codepoints) {
    const diskPath = path.join(EMOJI_CACHE_DIR, `${codepoints}.png`);
    if (fs.existsSync(diskPath)) {
      try {
        return await loadImage(diskPath);
      } catch {
        // Refetch corrupt cache files.
      }
    }

    const url =
      `https://cdn.jsdelivr.net/npm/emoji-datasource-apple@latest/img/apple/64/${codepoints}.png`;
    try {
      const { resp, buffer } = await fetchBuffer(url, {}, 8000);
      if (resp.status === 200) {
        await fsp.writeFile(diskPath, buffer);
        console.log(`[EMOJI] Cached Apple emoji: ${emojiChar} (${codepoints})`);
        return await loadImage(buffer);
      }
    } catch (err) {
      console.log(`[EMOJI] Fetch error for ${emojiChar} (${codepoints}): ${err.message}`);
    }
    return null;
  }

  const cp = getEmojiCodepoints(emojiChar, false);
  let img = await tryFetch(cp);
  if (!img) {
    const cpNoFe0f = getEmojiCodepoints(emojiChar, true);
    if (cpNoFe0f !== cp) img = await tryFetch(cpNoFe0f);
  }
  if (img) {
    const out = createCanvas(size, size);
    out.getContext("2d").drawImage(img, 0, 0, size, size);
    img = out;
  }
  emojiImageCache.set(cacheKey, img);
  return img;
}

function resolveFontPath(file = FONT_PATH) {
  const candidates = [
    path.resolve(IMAGE_BASE_DIR, file),
    path.resolve(__dirname, file),
    path.resolve(process.cwd(), file)
  ];
  return candidates.find((p) => fs.existsSync(p));
}

function registerLocalFont() {
  let registered = false;
  for (const { file, weight, alias } of FONT_VARIANTS) {
    const p = resolveFontPath(file);
    if (!p) continue;
    try {
      registerFont(p, { family: alias, weight: "400", style: "normal" });
      registered = true;
    } catch {
      registered = true;
    }
    try {
      registerFont(p, { family: FONT_FAMILY, weight, style: "normal" });
      registered = true;
    } catch {
      // The canvas package throws if the same font is registered twice.
      registered = true;
    }
  }
  if (!registered) {
    console.log(`[FONT] WARNING: ${FONT_PATH} not found. Put it in the asset folder for the exact SF Pro look.`);
  }
}

const measureCanvas = createCanvas(16, 16);
const measureCtx = measureCanvas.getContext("2d");
const fontDataUriCache = new Map();
const textRasterCache = new Map();
const browserTextRasterCache = new Map();
let textRasterBrowser = null;
let textRasterPage = null;

function fontAliasForWeight(weight = "400") {
  const n = Number.parseInt(String(weight), 10);
  if (n >= 700) return "SFProDisplayBold";
  if (n >= 600) return "SFProDisplaySemibold";
  if (n >= 500) return "SFProDisplayMedium";
  return "SFProDisplayRegular";
}

function fontSpec(size, weight = "400") {
  const family = fontAliasForWeight(weight);
  return {
    size,
    weight,
    family,
    css: `${size}px "${family}", "${FONT_FAMILY}", "Segoe UI", sans-serif`
  };
}

function setFont(ctx, font) {
  ctx.font = font.css;
  ctx.textBaseline = "top";
}

function fontVariantForWeight(weight = "400") {
  const alias = fontAliasForWeight(weight);
  return FONT_VARIANTS.find((v) => v.alias === alias) || FONT_VARIANTS[0];
}

function fontDataUriForWeight(weight = "400") {
  const variant = fontVariantForWeight(weight);
  if (fontDataUriCache.has(variant.file)) return fontDataUriCache.get(variant.file);
  const p = resolveFontPath(variant.file);
  if (!p) return null;
  const ext = path.extname(p).toLowerCase();
  const mime = ext === ".ttf" ? "font/ttf" : "font/otf";
  const uri = `data:${mime};base64,${fs.readFileSync(p).toString("base64")}`;
  fontDataUriCache.set(variant.file, uri);
  return uri;
}

function cssColor(fill) {
  if (typeof fill === "string") return fill;
  if (Array.isArray(fill) && fill.length >= 4) return rgba(fill);
  if (Array.isArray(fill)) return rgb(fill);
  return "white";
}

async function renderSfTextRaster(text, font, fill, options = {}) {
  const lineH = options.height ?? Math.ceil(font.size * 1.35);
  const padX = options.padX ?? 3;
  const width = Math.max(1, Math.ceil(options.width ?? (measureTextWidth(font, text) + padX * 2)));
  const height = Math.max(1, Math.ceil(lineH));
  const anchor = options.anchor ?? "start";
  // Use "auto" (alphabetic) instead of "central" so SVG text baseline
  // matches the canvas alphabetic path — Python uses getbbox which is tight bounds
  const dominant = options.dominantBaseline ?? "auto";
  const x = options.x ?? (anchor === "middle" ? width / 2 : padX);
  // Position at ~78% of height (alphabetic baseline position in line cell)
  const y = options.y ?? Math.round(height * 0.78);
  const dataUri = fontDataUriForWeight(font.weight);
  const family = dataUri ? "EmbeddedSFProDisplay" : font.family;
  const face = dataUri
    ? `@font-face{font-family:'EmbeddedSFProDisplay';src:url('${dataUri}') format('opentype');font-weight:400;font-style:normal;}`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><style><![CDATA[${face} text{font-family:'${family}','${FONT_FAMILY}','Segoe UI',sans-serif;font-size:${font.size}px;font-weight:400;font-style:normal;}]]></style></defs>
<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="${dominant}" fill="${cssColor(fill)}">${escapeXml(text)}</text>
</svg>`;
  const key = `${font.weight}|${font.size}|${cssColor(fill)}|${width}|${height}|${anchor}|${dominant}|${x}|${y}|${text}`;
  if (textRasterCache.has(key)) return textRasterCache.get(key);
  try {
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const img = await loadImage(png);
    textRasterCache.set(key, img);
    return img;
  } catch {
    return null;
  }
}

async function getTextRasterPage() {
  if (textRasterPage) return textRasterPage;
  const { chromium } = await import("playwright");
  textRasterBrowser = await chromium.launch({ headless: true });
  textRasterPage = await textRasterBrowser.newPage({
    viewport: { width: 1200, height: 240 },
    deviceScaleFactor: 1
  });
  await textRasterPage.setContent(`<!doctype html>
<html>
<head>
<style id="font-style"></style>
<style>
  html, body {
    margin: 0;
    padding: 0;
    background: transparent;
    overflow: hidden;
  }
  #text {
    position: absolute;
    left: 0;
    top: 0;
    margin: 0;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    white-space: pre;
    background: transparent;
    font-feature-settings: "kern";
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
  }
</style>
</head>
<body><span id="text"></span></body>
</html>`);
  return textRasterPage;
}

async function closeTextRasterBrowser() {
  if (textRasterBrowser) {
    await textRasterBrowser.close().catch(() => {});
  }
  textRasterBrowser = null;
  textRasterPage = null;
}

async function renderSfTextBrowserRaster(text, font, fill, lineH) {
  if (!text) return null;
  const variant = fontVariantForWeight(font.weight);
  const fontUri = fontDataUriForWeight(font.weight);
  if (!fontUri) return null;
  const color = cssColor(fill);
  const key = `${variant.file}|${font.size}|${lineH}|${color}|${text}`;
  if (browserTextRasterCache.has(key)) return browserTextRasterCache.get(key);

  try {
    const page = await getTextRasterPage();
    const height = Math.max(8, Math.ceil(lineH));
    const result = await page.evaluate(async ({ fontUrl, fontSize, lineHeight, colorValue, content }) => {
      const family = "BubbleSFProRegular";
      if (!window.__bubbleSfLoaded) {
        const face = new FontFace(family, `url(${fontUrl})`);
        await face.load();
        document.fonts.add(face);
        window.__bubbleSfLoaded = true;
      }
      await document.fonts.ready;

      const measureCanvas = document.createElement("canvas");
      const measureCtx = measureCanvas.getContext("2d");
      measureCtx.font = `${fontSize}px ${family}`;
      const metrics = measureCtx.measureText(content);
      const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.78;
      const descent = metrics.actualBoundingBoxDescent || fontSize * 0.22;
      const advance = Math.max(1, Math.ceil(metrics.width));
      const padX = 2;
      const width = Math.max(1, advance + padX * 2);
      const height = Math.max(1, Math.ceil(lineHeight));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.font = `${fontSize}px ${family}`;
      ctx.fillStyle = colorValue;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.imageSmoothingEnabled = true;
      const y = (height + ascent - descent) / 2;
      ctx.fillText(content, padX, y);
      return { dataUrl: canvas.toDataURL("image/png"), advance, padX };
    }, {
      fontUrl: fontUri,
      fontSize: font.size,
      lineHeight: height,
      colorValue: color,
      content: text
    });
    const img = await loadImage(result.dataUrl);
    const raster = { img, advance: result.advance, padX: result.padX };
    browserTextRasterCache.set(key, raster);
    return raster;
  } catch (err) {
    console.log(`[FONT] Browser text raster fallback for '${text.slice(0, 30)}': ${err.message}`);
    return null;
  }
}

function measureTextWidth(font, text) {
  setFont(measureCtx, font);
  return measureCtx.measureText(text).width;
}

function lineHeight(font, lineSpacing) {
  setFont(measureCtx, font);
  const m = measureCtx.measureText("Ay");
  const ascent = m.actualBoundingBoxAscent ?? font.size * 0.78;
  const descent = m.actualBoundingBoxDescent ?? font.size * 0.22;
  // Use tight glyph bounds only — matches Python's getbbox("Ay")[3] - getbbox("Ay")[1]
  return Math.ceil(ascent + descent + lineSpacing);
}

function measureMixedLine(tokens, font, emojiSize) {
  return tokens.reduce((w, [seg, isEmoji]) => (
    w + (isEmoji ? emojiSize : Math.ceil(measureTextWidth(font, seg)))
  ), 0);
}


function fixTrailingEmojiLine(lines, font, emojiSize, maxWidth) {
  if (lines.length < 2) return;
  const lastLine = lines[lines.length - 1];
  const lastIsEmojiOnly = lastLine.every(([, isEmoji]) => isEmoji);
  if (!lastIsEmojiOnly) return;
  // Always absorb trailing emoji-only line regardless of width
  const prevLine = lines[lines.length - 2];
  lines[lines.length - 2] = [...prevLine, ...lastLine];
  lines.splice(lines.length - 1, 1);
}


function wrapMixedText(text, font, maxWidth, emojiSize) {
  const raw = tokenizeMixedText(text);
  const wordTokens = [];
  for (const [seg, isEmoji] of raw) {
    if (isEmoji) {
      wordTokens.push([seg, true]);
    } else {
      for (const p of seg.split(/(\s+)/)) {
        if (p) wordTokens.push([p, false]);
      }
    }
  }

  const lines = [];
  let current = [];
  let currentW = 0;
  for (const [seg, isEmoji] of wordTokens) {
    const segW = isEmoji ? emojiSize : measureTextWidth(font, seg);
    const isSpace = !isEmoji && seg.trim() === "";
    if (current.length === 0) {
      if (!isSpace) {
        current.push([seg, isEmoji]);
        currentW = segW;
      }
    } else if (currentW + segW <= maxWidth) {
      current.push([seg, isEmoji]);
      currentW += segW;
    } else if (!isSpace) {
      lines.push(current);
      current = [[seg, isEmoji]];
      currentW = segW;
    }
  }
  if (current.length) lines.push(current);
  return lines.length ? lines : [[["", false]]];
}

function measureMixedBlock(lines, font, emojiSize, spacing = 8) {
  const lh = lineHeight(font, spacing);
  const maxW = Math.max(0, ...lines.map((ln) => measureMixedLine(ln, font, emojiSize)));
  return [maxW, lh * lines.length, lh];
}


async function drawMixedLine(ctx, canvas, lineTokens, font, tx, ty, lh, textColor, emojiSizePx) {
  setFont(ctx, font);
  ctx.fillStyle = rgba(textColor);
  let cursorX = tx;
  let textRun = "";

  // Compute vertical centering offset for canvas fallback path.
  // Mirrors Python: text_dy = int((line_height - glyph_h) / 2) - ref[1]
  let textDy = 0;
  try {
    measureCtx.font = font.css;
    const ref = measureCtx.measureText("Ay");
    const ascent = ref.actualBoundingBoxAscent ?? font.size * 0.78;
    const descent = ref.actualBoundingBoxDescent ?? font.size * 0.22;
    const glyphH = ascent + descent;
    // alphabetic baseline: draw at ty + offset where offset centers the glyph
    textDy = Math.round((lh - glyphH) / 2 + ascent);
  } catch {
    textDy = Math.round(lh * 0.78);
  }

  const flushTextRun = async () => {
    if (!textRun) return;
    if (textRun.trim() === "") {
      cursorX += measureTextWidth(font, textRun);
      textRun = "";
      return;
    }
    const raster = await renderSfTextBrowserRaster(textRun, font, textColor, lh);
    if (raster) {
      // Browser raster already centers internally — draw at ty (top of line cell)
      ctx.drawImage(raster.img, cursorX - raster.padX, ty);
      cursorX += raster.advance;
    } else {
      // Canvas fallback: use alphabetic baseline + textDy for vertical centering
      ctx.textBaseline = "alphabetic";
      ctx.fillText(textRun, cursorX, ty + textDy);
      cursorX += measureTextWidth(font, textRun);
    }
    textRun = "";
  };

  for (const [seg, isEmoji] of lineTokens) {
    if (!seg) continue;
    if (isEmoji) {
      await flushTextRun();
      const emojiImg = await fetchAppleEmoji(seg, emojiSizePx);
      if (emojiImg) {
        const ey = Math.max(0, Math.trunc(ty + (lh - emojiSizePx) / 2));
        const ex = Math.max(0, Math.trunc(cursorX));
        if (ex < canvas.width && ey < canvas.height) {
          ctx.drawImage(emojiImg, ex, ey, emojiSizePx, emojiSizePx);
        }
      }
      cursorX += emojiSizePx;
    } else {
      textRun += seg;
    }
  }
  await flushTextRun();
}

function parseTtsOverride(text) {
  const marker = " == ";
  const idx = text.indexOf(marker);
  if (idx >= 0) {
    return [text.slice(0, idx).trim(), text.slice(idx + marker.length).trim()];
  }
  return [text, text];
}

async function tailSvgImage(sender, tailHPx, mirror = false) {
  const bubbleColor = sender === "me"
    ? (USE_GREEN_BUBBLES ? GREEN_BUBBLE_COLOR : THEME.bubble_sent)
    : THEME.bubble_rcvd;
  const cacheKey = JSON.stringify(["tail", sender, tailHPx, mirror, bubbleColor, USE_GREEN_BUBBLES]);
  if (tailCache.has(cacheKey)) return tailCache.get(cacheKey);

  const fillHex = hexFromRgb(bubbleColor);
  const tailWPx = Math.max(1, Math.trunc(tailHPx * TAIL_VW / TAIL_VH));
  const pathSvg = mirror
    ? `<g transform="scale(-1,1) translate(-${TAIL_VW},0)"><path d="${TAIL_PATH_D}" fill="${fillHex}"/></g>`
    : `<path d="${TAIL_PATH_D}" fill="${fillHex}"/>`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${tailWPx}" height="${tailHPx}" ` +
    `viewBox="0 0 ${TAIL_VW} ${TAIL_VH}">${pathSvg}</svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const img = await loadImage(png);
  tailCache.set(cacheKey, img);
  return img;
}

function roundedRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function pillRectPath(ctx, x, y, w, h) {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
}

function fillRoundedRect(ctx, x, y, w, h, r, fillStyle) {
  roundedRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function fillBubbleShape(ctx, x, y, w, h, r, fillStyle, isPill) {
  ctx.fillStyle = fillStyle;
  if (isPill) {
    pillRectPath(ctx, x, y, w, h);
  } else {
    roundedRectPath(ctx, x, y, w, h, r);
  }
  ctx.fill();
}

function applyRoundedCornersCanvas(src, radius) {
  const out = createCanvas(src.width, src.height);
  const ctx = out.getContext("2d");
  if (radius <= 0) {
    ctx.drawImage(src, 0, 0);
    return out;
  }
  roundedRectPath(ctx, 0, 0, src.width, src.height, radius);
  ctx.clip();
  ctx.drawImage(src, 0, 0);
  return out;
}

function wrapText(text, font, maxWidth) {
  const words = String(text).split(" ");
  const lines = [];
  let current = "";
  for (const w of words) {
    if (!current) current = w;
    else if (measureTextWidth(font, `${current} ${w}`) <= maxWidth) current += ` ${w}`;
    else {
      lines.push(current);
      current = w;
    }
    while (measureTextWidth(font, current) > maxWidth && current.length > 1) {
      let splitAt = -1;
      for (let i = 1; i < current.length; i += 1) {
        if (measureTextWidth(font, current.slice(0, i)) > maxWidth) {
          splitAt = i - 1;
          break;
        }
      }
      if (splitAt <= 0) break;
      lines.push(current.slice(0, splitAt));
      current = current.slice(splitAt);
    }
  }
  lines.push(current);
  return lines.join("\n");
}

function wrapTextPreservingBlur(text, font, maxWidth) {
  const displayParts = String(text).split(/(\s+)/).filter(Boolean);
  const lines = [];
  let currentLine = "";
  let currentDisplay = "";

  for (const part of displayParts) {
    const partDisplay = stripBlurMarkers(part);
    if (!currentLine) {
      currentLine = part;
      currentDisplay = partDisplay;
    } else {
      const testDisplay = currentDisplay + partDisplay;
      if (measureTextWidth(font, testDisplay) <= maxWidth) {
        currentLine += part;
        currentDisplay = testDisplay;
      } else if (partDisplay.trim()) {
        lines.push(currentLine.trimEnd());
        currentLine = part.trimStart();
        currentDisplay = partDisplay.trimStart();
      }
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trimEnd());
  return lines.join("\n");
}

function applyBlurRegion(canvas, x0, y0, x1, y1, color, blurRadius) {
  const bw = x1 - x0;
  const bh = y1 - y0;
  if (bw <= 0 || bh <= 0) return;

  // Crop source region
  const src = createCanvas(bw, bh);
  src.getContext("2d").drawImage(canvas, x0, y0, bw, bh, 0, 0, bw, bh);

  // Aggressive pixelation: downscale to fixed ~4px blocks regardless of region size
  const BLOCK_PX = 4;  // each output "pixel" = 4px block → strong pixelation
  const smallW = Math.max(1, Math.trunc(bw / BLOCK_PX));
  const smallH = Math.max(1, Math.trunc(bh / BLOCK_PX));

  const small = createCanvas(smallW, smallH);
  small.getContext("2d").drawImage(src, 0, 0, smallW, smallH);

  const pixelated = createCanvas(bw, bh);
  const pctx = pixelated.getContext("2d");
  pctx.imageSmoothingEnabled = false;
  pctx.drawImage(small, 0, 0, bw, bh);

  // Heavier color overlay to further obscure — 0.75 alpha matches strong censor look
  pctx.globalAlpha = 0.75;
  pctx.fillStyle = rgb(color);
  pctx.fillRect(0, 0, bw, bh);
  pctx.globalAlpha = 1;

  canvas.getContext("2d").drawImage(pixelated, x0, y0);
}

async function bubbleImg(text, sender, width = 650, fontSize = 48, showTail = true) {
  const bubbleFontWeight = "400";
  const font = fontSpec(fontSize, bubbleFontWeight);
  const padX = Math.trunc(24 * 1.5);
  const padTop = Math.trunc(16 * 1.5);
  const padBottom = Math.trunc(14 * 1.5);
  const maxTextWidth = width - padX * 2 - Math.trunc(30 * 1.5);
  const displayTextNoBlur = stripBlurMarkers(text);

  const emojiSize1x = fontSize;
  const scale = 2;
  const mixedLines = wrapMixedText(displayTextNoBlur, font, maxTextWidth, emojiSize1x);
  fixTrailingEmojiLine(mixedLines, font, emojiSize1x, maxTextWidth);
  const numLines = mixedLines.length;
  let [, textH] = measureMixedBlock(mixedLines, font, emojiSize1x, 8);
  textH = Math.trunc(textH);

  // Measure bubbleW from 2x pass so it matches actual drawing
  

  const regularFont = fontSpec(Math.trunc(fontSize * scale), bubbleFontWeight);
  const lineSpacing = Math.trunc(8 * scale);
  const lh = lineHeight(regularFont, lineSpacing);
  const emojiSize2x = Math.trunc(fontSize * scale);
  const mixedLines2x = wrapMixedText(displayTextNoBlur, regularFont, maxTextWidth * scale, emojiSize2x);
  fixTrailingEmojiLine(mixedLines2x, regularFont, emojiSize2x, maxTextWidth * scale);
  const textW2x = Math.trunc(Math.max(...mixedLines2x.map(ln => measureMixedLine(ln, regularFont, emojiSize2x))));
  
  // When any line ends with an emoji the right-side padding needs to match padX
  // (text segments have built-in advance slack but emoji is pixel-exact, leaving a gap).
  const anyLineEndsWithEmoji = mixedLines2x.some(ln => ln.length > 0 && ln[ln.length - 1][1] === true);
  const trailingEmojiPad = (anyLineEndsWithEmoji && numLines > 1) ? Math.trunc(emojiSize2x * 0.10) : 0;

  const tailH2x = 115;
  const tailW2x = Math.trunc(tailH2x * TAIL_VW / TAIL_VH);
  const tailTip2x = Math.max(4, Math.trunc(tailW2x * (5.0 / 17.0)));
  const tailOvr2x = tailW2x - tailTip2x;
  const safeMargin = tailTip2x + Math.trunc(5 * scale);

  const bubbleW = Math.trunc((textW2x + trailingEmojiPad) / scale) + padX * 2;

  let bubbleH = Math.trunc(textH + padTop + padBottom + Math.trunc(5 * 1.5));
  bubbleH = Math.max(bubbleH, Math.trunc(64 * 1.5));

  const imgW = bubbleW + Math.trunc(safeMargin / scale) + Math.trunc(5 * 1.5);
  const imgH = bubbleH + Math.trunc(10 * 1.5);
  const color = sender === "me"
    ? (USE_GREEN_BUBBLES ? GREEN_BUBBLE_COLOR : THEME.bubble_sent)
    : THEME.bubble_rcvd;
  const chatBg = THEME.chat_bg;

  const aa = createCanvas(imgW * scale, imgH * scale);
  const ctx = aa.getContext("2d");
  ctx.fillStyle = rgb(chatBg);
  ctx.fillRect(0, 0, aa.width, aa.height);

  let safeRadius;
  if (numLines === 1) safeRadius = Math.trunc((Math.min(bubbleW, bubbleH) * scale) / 2 * BUBBLE_RADIUS_SCALE);
  else if (numLines === 2) safeRadius = 105;
  else if (numLines === 3) safeRadius = 105;
  else safeRadius = 105;

  let ox;
  const oy = 0;
  if (sender === "me") {
    ox = Math.trunc(5 * 1.5) * scale;
    fillBubbleShape(ctx, ox, oy, bubbleW * scale, bubbleH * scale, safeRadius, rgb(color), numLines === 1);
    if (showTail) {
      const tail = await tailSvgImage(sender, tailH2x, false);
      const txTail = ox + bubbleW * scale - tailOvr2x + 2;
      const tyTail = oy + bubbleH * scale - tailH2x + Math.trunc(1 * scale) + 1;
      ctx.drawImage(tail, txTail, tyTail, tail.width, tail.height);
    }
  } else {
    ox = safeMargin;
    fillBubbleShape(ctx, ox, oy, bubbleW * scale, bubbleH * scale, safeRadius, rgb(color), numLines === 1);
    if (showTail) {
      const tail = await tailSvgImage(sender, tailH2x, true);
      const txTail = ox - tailTip2x - 1;
      const tyTail = oy + bubbleH * scale - tailH2x + Math.trunc(1 * scale) + 7;
      ctx.drawImage(tail, Math.max(0, txTail), tyTail, tail.width, tail.height);
    }
  }

  const tx = ox + Math.trunc(padX * scale);
  const textBlockH = mixedLines2x.length * lh;
  const ty = oy + Math.trunc((bubbleH * scale - textBlockH) / 2);

  const textColor = sender === "me" ? [255, 255, 255, 255] : THEME.rcvd_text_color;

  

  // ── TEXT + BLUR: draw non-blurred segments only; blurred positions get solid cover ──
  if (/\{[^}]+\}/.test(text)) {
    const wrapped = wrapTextPreservingBlur(text, regularFont, maxTextWidth * scale);
    const lines = wrapped.split("\n");
    while (lines.length < mixedLines2x.length) lines.push("");

    // Single pass: track cursorX via raster.advance (same as actual draw),
    // record blur boxes as we go, draw non-blurred text, then stamp blur boxes on top.
    let currentY = ty;
    for (let li = 0; li < lines.length; li++) {
      const runs = extractBlurRuns(lines[li]);
      let cursorX = tx;
      const blurBoxes = []; // collect {x0,x1} for this line using real advance

      for (const [segText, isBlurred] of runs) {
        const segTokens = tokenizeMixedText(segText);

        if (!isBlurred) {
          // Draw non-blurred tokens, advance cursorX by real raster advance
          for (const [s, isE] of segTokens) {
            if (!s) continue;
            if (isE) {
              const emojiImg = await fetchAppleEmoji(s, emojiSize2x);
              if (emojiImg) {
                const ey = Math.max(0, Math.trunc(currentY + (lh - emojiSize2x) / 2));
                ctx.drawImage(emojiImg, Math.max(0, Math.trunc(cursorX)), ey, emojiSize2x, emojiSize2x);
              }
              cursorX += emojiSize2x;
            } else {
              const raster = await renderSfTextBrowserRaster(s, regularFont, textColor, lh);
              if (raster) {
                ctx.drawImage(raster.img, cursorX - raster.padX, currentY);
                cursorX += raster.advance;
              } else {
                ctx.fillStyle = rgba(textColor);
                ctx.font = regularFont.css;
                ctx.textBaseline = "alphabetic";
                ctx.fillText(s, cursorX, currentY + Math.round(lh * 0.78));
                cursorX += measureTextWidth(regularFont, s);
              }
            }
          }
        } else {
          // Blurred segment: DON'T draw, but record exact x start/end from real cursorX
          const blurStartX = cursorX;
          for (const [s, isE] of segTokens) {
            if (!s) continue;
            if (isE) {
              cursorX += emojiSize2x;
            } else {
              // Use raster advance for blurred chars too — same engine as non-blurred
              const raster = await renderSfTextBrowserRaster(s, regularFont, textColor, lh);
              cursorX += raster ? raster.advance : measureTextWidth(regularFont, s);
            }
          }
          blurBoxes.push({ x0: blurStartX, x1: cursorX });
        }
      }

      // Stamp solid bubble-color boxes using the real raster-advance positions
      const fctx = aa.getContext("2d");
      fctx.fillStyle = rgb(color);
      const padY = Math.trunc(3 * scale);
      const padXpx = Math.trunc(1 * scale); // minimal x pad — position is already exact
      for (const { x0, x1 } of blurBoxes) {
        fctx.fillRect(
          Math.max(0,        Math.trunc(x0) - padXpx),
          Math.max(0,        Math.trunc(currentY) - padY),
          Math.trunc(x1 - x0) + padXpx * 2,
          lh + padY * 2
        );
      }

      currentY += lh;
    }

  } else {
    // No blur — normal draw path
    let currentY = ty;
    for (const line of mixedLines2x) {
      await drawMixedLine(ctx, aa, line, regularFont, tx, currentY, lh, textColor, emojiSize2x);
      currentY += lh;
    }
  }

  const out = createCanvas(imgW, imgH);
  out.getContext("2d").drawImage(aa, 0, 0, imgW, imgH);
  return [out, imgW, imgH];
}

async function emojiOnlyImg(text, sender, baseEmojiSize = 44) {
  const emojis = emojiMatches(text);
  if (!emojis.length) return bubbleImg(text, sender);

  const emojiDisplaySize = Math.trunc(baseEmojiSize * 3);
  const gap = Math.trunc(6 * 1.5);
  const pad = Math.trunc(10 * 1.5);
  const totalW = emojis.length * emojiDisplaySize + Math.max(0, emojis.length - 1) * gap + pad * 2;
  const totalH = emojiDisplaySize + pad * 2;

  const c = createCanvas(totalW, totalH);
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, totalW, totalH);
  let x = pad;
  for (const em of emojis) {
    const img = await fetchAppleEmoji(em, emojiDisplaySize);
    if (img) ctx.drawImage(img, x, pad, emojiDisplaySize, emojiDisplaySize);
    x += emojiDisplaySize + gap;
  }
  return [c, totalW, totalH];
}

function isImageMessage(text) {
  const t = String(text).trim();
  const parts = t.split(/\s+/);
  const fname = parts[parts.length - 1] || "";
  return [IMAGE_EXT_RE.test(fname), fname];
}

async function imageMessageClip(fname, sender, maxWidth = Math.trunc(270 * 1.5)) {
  let p = fname;
  if (!path.isAbsolute(p)) p = path.join(IMAGE_BASE_DIR, fname);
  if (!fs.existsSync(p)) return bubbleImg(`[missing ${fname}]`, sender);

  const img = await loadImage(p);
  const scale = maxWidth / img.width;
  const w = Math.trunc(img.width * scale);
  const h = Math.trunc(img.height * scale);

  const rounded = createCanvas(w, h);
  const rctx = rounded.getContext("2d");
  roundedRectPath(rctx, 0, 0, w, h, Math.trunc(25 * 1.5));
  rctx.clip();
  rctx.drawImage(img, 0, 0, w, h);

  const pad = Math.trunc(12 * 1.5);
  const bgW = w + pad * 2;
  const bgH = h + pad * 2;
  const bg = createCanvas(bgW, bgH);
  const bctx = bg.getContext("2d");
  bctx.fillStyle = rgb(THEME.chat_bg);
  bctx.fillRect(0, 0, bgW, bgH);
  bctx.drawImage(rounded, pad, pad);
  return [applyRoundedCornersCanvas(bg, Math.trunc(24 * 1.5)), bgW, bgH];
}

async function makeBubbleClips(msgs) {
  const clips = [];
  const widths = [];
  const heights = [];
  const send = [];
  const isImgFlags = [];

  for (let i = 0; i < msgs.length; i += 1) {
    const msg = msgs[i];
    if (msg.audio_only || msg.is_plug || msg.is_rizz || msg.is_break) {
      clips.push(null);
      widths.push(0);
      heights.push(0);
      send.push(msg.sender);
      isImgFlags.push(false);
      continue;
    }

    const sender = msg.sender;
    const text = msg.text;
    const [isImg, fname] = isImageMessage(stripBlurMarkers(text));
    let isLast = true;
    for (let j = i + 1; j < msgs.length; j += 1) {
      const next = msgs[j];
      if (next.is_plug || next.audio_only || next.is_break) continue;
      if (next.sender === sender) isLast = false;
      break;
    }

    let clip;
    let w;
    let h;
    if (isImg) {
      [clip, w, h] = await imageMessageClip(fname, sender);
      isImgFlags.push(true);
    } else if (isEmojiOnlyMessage(stripBlurMarkers(text))) {
      [clip, w, h] = await emojiOnlyImg(stripBlurMarkers(text), sender);
      isImgFlags.push(false);
    } else {
      [clip, w, h] = await bubbleImg(text, sender, 650, BUBBLE_FONT_SIZE, isLast);
      isImgFlags.push(false);
    }
    clips.push(clip);
    widths.push(w);
    heights.push(h);
    send.push(sender);
  }
  return [clips, widths, heights, send, isImgFlags];
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function generateIosMainHeader(name = "Postfully", initial = "P", width = CHAT_W, height = TOPBAR_H, unreadCount = null, emojiExtraW = 0) {
  const centerX = Math.trunc(width / 2);
  name = stripEmojisForTts(name);
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) initial = (words[0][0] + words[1][0]).toUpperCase();
  else initial = (words[0]?.[0] || "?").toUpperCase();

  const avatarR = Math.trunc(39 * 1.5);
  const avatarY = Math.trunc(70 * 1.5);
  const nameY = Math.trunc(135 * 1.5);
  const nameFontSize = Math.trunc(24 * 1.5);
  const namePxW = Math.trunc(measureTextWidth(fontSpec(nameFontSize), name));
  const nameCx = centerX - Math.trunc(4 * 1.5);
  const nameRightEdge = nameCx + Math.trunc(namePxW / 1.7);
  const chevronX = nameRightEdge + 20 + emojiExtraW;

  const display = unreadCount ? String(unreadCount).trim() : "";
  let unreadSvg = "";
  if (display !== "") {
    const pillH = Math.trunc(30 * 1.5);
    const pillR = Math.trunc(15 * 1.5);
    const hPad = Math.trunc(5.6 * 1.5);
    const perChar = Math.trunc(13 * 1.5);
    const pillWidth = Math.max(pillH, display.length * perChar + hPad * 2);
    unreadSvg = `
      <g transform="translate(${Math.trunc(55 * 1.5)},${Math.trunc(64 * 1.5)})">
        <rect x="0" y="0" width="${pillWidth}" height="${pillH}" rx="${pillR}" fill="#007AFF"/>
        <text x="${pillWidth / 2}" y="${pillH / 2}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.trunc(22 * 1.5)}" font-family="SF Pro" fill="white" font-weight="500">${escapeXml(display)}</text>
      </g>`;
  }

  const hdrBg = THEME.header_bg_hex;
  const nameClr = THEME.name_fill_hex;
  const nameWt = THEME.name_weight;
  const initialFontSize = Math.trunc(32 * 1.5);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
  <linearGradient id="gradProfile" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0%" stop-color="#A5ABB9"/>
    <stop offset="100%" stop-color="#858994"/>
  </linearGradient>
  <style><![CDATA[
    .name { font: ${nameWt} ${nameFontSize}px Inter, system-ui, -apple-system; fill: ${nameClr}; }
    .initial { font: 600 ${initialFontSize}px Inter, system-ui, -apple-system; fill: #fff; }
  ]]></style>
</defs>
<rect width="${width}" height="${height}" fill="${hdrBg}"/>
<g transform="translate(${Math.trunc(32 * 1.5)},${Math.trunc(63 * 1.5)}) scale(1.8)">
  <path d="M13.5 0 L0 13.5 L13.5 27" fill="none" stroke="#007AFF" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round"/>
</g>
<g transform="translate(${width - Math.trunc(85 * 1.5)},${Math.trunc(50 * 1.5)})">
  <rect x="0" y="${Math.trunc(4.5 * 1.5)}" width="${Math.trunc(39 * 1.5)}" height="${Math.trunc(30 * 1.5)}" rx="${Math.trunc(7.5 * 1.5)}" fill="none" stroke="#007AFF" stroke-width="${Math.trunc(2.6 * 1.5)}"/>
  <polygon points="${Math.trunc(39 * 1.5)},${Math.trunc(15 * 1.5)} ${Math.trunc(52.5 * 1.5)},${Math.trunc(9.75 * 1.5)} ${Math.trunc(52.5 * 1.5)},${Math.trunc(28.5 * 1.5)} ${Math.trunc(39 * 1.5)},${Math.trunc(22.5 * 1.5)}" fill="none" stroke="#007AFF" stroke-width="${Math.trunc(2.6 * 1.5)}" stroke-linejoin="round"/>
</g>
${unreadSvg}
<circle cx="${centerX}" cy="${avatarY}" r="${avatarR}" fill="url(#gradProfile)"/>
<text x="${centerX}" y="${avatarY + avatarR * 0.31}" text-anchor="middle" class="initial">${escapeXml(initial)}</text>
<text x="${nameCx}" y="${nameY}" text-anchor="middle" class="name">${escapeXml(name)}</text>
<g transform="translate(${chevronX}, ${nameY - Math.trunc(18 * 1.5)})">
  <polyline points="0,${Math.trunc(3 * 1.5)} ${Math.trunc(7 * 1.5)},${Math.trunc(10 * 1.5)} 0,${Math.trunc(17 * 1.5)}" fill="none" stroke="#bbbbbb" stroke-width="${Math.trunc(2.6 * 1.5)}" stroke-linecap="round" stroke-linejoin="round"/>
</g>
</svg>`;
}

function drawPolyline(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
  ctx.stroke();
}

function strokeRoundedRect(ctx, x, y, w, h, r, strokeStyle, lineWidth) {
  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  roundedRectPath(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.restore();
}

async function drawIosMainHeaderCanvas(name = "Postfully", initial = "P", width = CHAT_W, height = TOPBAR_H, unreadCount = null, emojiExtraW = 0) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const centerX = Math.trunc(width / 2);

  name = stripEmojisForTts(name);
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) initial = (words[0][0] + words[1][0]).toUpperCase();
  else initial = (words[0]?.[0] || "?").toUpperCase();

  const avatarR = Math.trunc(39 * 1.5);
  const avatarY = Math.trunc(70 * 1.5);
  const nameY = Math.trunc(135 * 1.5);
  const nameFontSize = Math.trunc(24 * 1.5);
  const initialFontSize = Math.trunc(32 * 1.5);
  const nameFont = fontSpec(nameFontSize, THEME.name_weight);
  const initialFont = fontSpec(initialFontSize, "600");
  const namePxW = Math.trunc(measureTextWidth(nameFont, name));
  const nameCx = centerX - Math.trunc(4 * 1.5);
  const nameRightEdge = nameCx + Math.trunc(namePxW / 1.7);
  const chevronX = nameRightEdge + 20 + emojiExtraW;

  ctx.fillStyle = THEME.header_bg_hex;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(Math.trunc(32 * 1.5), Math.trunc(63 * 1.5));
  ctx.scale(1.8, 1.8);
  ctx.strokeStyle = "#007AFF";
  ctx.lineWidth = 2.9;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  drawPolyline(ctx, [[13.5, 0], [0, 13.5], [13.5, 27]]);
  ctx.restore();

  const display = unreadCount ? String(unreadCount).trim() : "";
  if (display) {
    const pillH = Math.trunc(30 * 1.5);
    const pillR = Math.trunc(15 * 1.5);
    const unreadFont = fontSpec(Math.trunc(22 * 1.5), "400");
    const hPad = Math.trunc(10 * 1.5);
    const textW = measureTextWidth(unreadFont, display);
    const pillWidth = Math.max(pillH, Math.ceil(textW + hPad * 2));
    const pillX = Math.trunc(55 * 1.5);
    const pillY = Math.trunc(64 * 1.5);
    fillRoundedRect(ctx, pillX, pillY, pillWidth, pillH, pillR, "#007AFF");
    const textRaster = await renderSfTextBrowserRaster(display, unreadFont, [255, 255, 255, 255], pillH);
    if (textRaster) {
      ctx.drawImage(textRaster.img, pillX + (pillWidth - textRaster.advance) / 2 - textRaster.padX, pillY);
    } else {
      setFont(ctx, unreadFont);
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      const metrics = ctx.measureText(display);
      const ascent = metrics.actualBoundingBoxAscent || unreadFont.size * 0.72;
      const descent = metrics.actualBoundingBoxDescent || unreadFont.size * 0.22;
      const textY = pillY + (pillH + ascent - descent) / 2 - 1;
      ctx.fillText(display, pillX + pillWidth / 2, textY);
    }
  }

  ctx.save();
  ctx.translate(width - Math.trunc(85 * 1.5), Math.trunc(50 * 1.5));
  ctx.strokeStyle = "#007AFF";
  ctx.lineWidth = Math.trunc(2.6 * 1.5);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  strokeRoundedRect(
    ctx,
    0,
    Math.trunc(4.5 * 1.5),
    Math.trunc(39 * 1.5),
    Math.trunc(30 * 1.5),
    Math.trunc(7.5 * 1.5),
    "#007AFF",
    Math.trunc(2.6 * 1.5)
  );
  ctx.beginPath();
  ctx.moveTo(Math.trunc(39 * 1.5), Math.trunc(15 * 1.5));
  ctx.lineTo(Math.trunc(52.5 * 1.5), Math.trunc(9.75 * 1.5));
  ctx.lineTo(Math.trunc(52.5 * 1.5), Math.trunc(28.5 * 1.5));
  ctx.lineTo(Math.trunc(39 * 1.5), Math.trunc(22.5 * 1.5));
  ctx.stroke();
  ctx.restore();

  const grad = ctx.createLinearGradient(0, avatarY - avatarR, 0, avatarY + avatarR);
  grad.addColorStop(0, "#A5ABB9");
  grad.addColorStop(1, "#858994");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(centerX, avatarY, avatarR, 0, Math.PI * 2);
  ctx.fill();

  setFont(ctx, initialFont);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initial, centerX, avatarY + Math.trunc(2 * 1.5));

  setFont(ctx, nameFont);
  ctx.fillStyle = THEME.name_fill_hex;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(name, nameCx, nameY);

  ctx.save();
  ctx.translate(chevronX, nameY - Math.trunc(18 * 1.5));
  ctx.strokeStyle = "#bbbbbb";
  ctx.lineWidth = Math.trunc(2.6 * 1.5);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  drawPolyline(ctx, [
    [0, Math.trunc(3 * 1.5)],
    [Math.trunc(7 * 1.5), Math.trunc(10 * 1.5)],
    [0, Math.trunc(17 * 1.5)]
  ]);
  ctx.restore();

  return canvas;
}

async function svgToCanvas(svg, width, height) {
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const img = await loadImage(png);
  const c = createCanvas(width, height);
  c.getContext("2d").drawImage(img, 0, 0);
  return c;
}

async function overlayNameEmojis(headerImg, originalName, cleanName) {
  const emojis = emojiMatches(originalName);
  if (!emojis.length) return headerImg;

  const nameFontSize = Math.trunc(24 * 1.5);
  const emojiSize = nameFontSize;
  const nameYBaseline = Math.trunc(135 * 1.5);
  const centerX = Math.trunc(CHAT_W / 2);
  const nameCx = centerX - Math.trunc(4 * 1.5);
  const font = fontSpec(nameFontSize);
  const nameW = measureTextWidth(font, cleanName);
  const spaceW = Math.trunc(measureTextWidth(font, " "));
  const nameRightEdge = nameCx + nameW / 2;

  let actualGapW = spaceW;
  const matchStart = originalName.indexOf(cleanName);
  if (matchStart >= 0) {
    const afterName = originalName.slice(matchStart + cleanName.length);
    const first = emojiRegex().exec(afterName);
    if (first && first.index > 0) {
      const gapStr = afterName.slice(0, first.index);
      actualGapW = Math.trunc(measureTextWidth(font, gapStr) + gapStr.length * 8);
    }
  }

  const out = createCanvas(headerImg.width, headerImg.height);
  const ctx = out.getContext("2d");
  ctx.drawImage(headerImg, 0, 0);

  let ex = Math.trunc(nameRightEdge + actualGapW);
  const ey = Math.max(0, Math.trunc(nameYBaseline - emojiSize * 0.82));
  for (const em of emojis) {
    const img = await fetchAppleEmoji(em, emojiSize);
    if (img && ex + emojiSize <= out.width && ey + emojiSize <= out.height) {
      ctx.drawImage(img, ex, ey, emojiSize, emojiSize);
    }
    ex += emojiSize + spaceW;
  }
  return out;
}

async function createImessageContactHeader(name, unreadCount = null, avatarFile = null) {
  const originalName = name;
  const cleanName = stripEmojisForTts(name);
  const emojis = emojiMatches(originalName);
  const nameFontSize = Math.trunc(24 * 1.5);
  const emojiSize = nameFontSize;
  const spaceW = Math.trunc(measureTextWidth(fontSpec(nameFontSize), " "));
  let emojiExtraW = 0;
  if (emojis.length) {
    const idx = originalName.indexOf(cleanName);
    const after = idx >= 0 ? originalName.slice(idx + cleanName.length) : "";
    const fem = emojiRegex().exec(after);
    const numSp = fem && fem.index > 0 ? after.slice(0, fem.index).length : 0;
    emojiExtraW = spaceW + numSp * 8 + emojis.length * emojiSize + (emojis.length - 1) * spaceW;
  }

  let header = await drawIosMainHeaderCanvas(cleanName, null, CHAT_W, TOPBAR_H, unreadCount, emojiExtraW);

  if (avatarFile) {
    let p = avatarFile;
    if (!path.isAbsolute(p)) p = path.join(IMAGE_BASE_DIR, avatarFile);
    if (fs.existsSync(p)) {
      const avatar = await loadImage(p);
      const size = Math.trunc(78 * 1.5);
      const ctx = header.getContext("2d");
      const x = Math.trunc(CHAT_W / 2) - Math.trunc(size / 2);
      const y = Math.trunc(70 * 1.5) - Math.trunc(size / 2);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatar, x, y, size, size);
      ctx.restore();
    }
  }

  return overlayNameEmojis(header, originalName, cleanName);
}

async function createSceneImage(
  bubbleImgs,
  widths,
  heights,
  senders,
  posterImg,
  showPoster,
  pad = Math.trunc(8 * 1.5),
  chatY = Math.trunc(170 * 1.5),
  uiRound = 0
) {
  const maxW = CHAT_W - pad * 2;
  const visible = bubbleImgs.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
  const gaps = [];
  for (let vi = 0; vi < visible.length - 1; vi += 1) {
    const i = visible[vi];
    const j = visible[vi + 1];
    gaps.push(senders[i] === senders[j] ? -11 : 7);
  }

  const visibleHeights = visible.map((i) => heights[i]);
  const bubblesH = visibleHeights.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
  const bottomPad = Math.max(Math.trunc(15 * 1.5), uiRound - 22);
  let chatH = showPoster
    ? TOPBAR_H + Math.trunc(12 * 1.5) + bubblesH - Math.trunc(3 * 1.5)
    : bubblesH + Math.trunc(12 * 1.5);
  chatH = showPoster ? Math.max(chatH, TOPBAR_H) : bubblesH + bottomPad;

  const chatX = Math.trunc((W - CHAT_W) / 2);
  const chatImg = createCanvas(CHAT_W, Math.trunc(chatH));
  const cctx = chatImg.getContext("2d");
  cctx.fillStyle = rgb(THEME.chat_bg);
  cctx.fillRect(0, 0, chatImg.width, chatImg.height);
  if (showPoster && posterImg) cctx.drawImage(posterImg, 0, 0);

  let y = showPoster ? TOPBAR_H + Math.trunc(24 * 1.5) : Math.trunc(36 * 1.5);
  for (let gapIdx = 0; gapIdx < visible.length; gapIdx += 1) {
    const vi = visible[gapIdx];
    const bubble = bubbleImgs[vi];
    const bW = Math.min(widths[vi], maxW);
    const isMe = senders[vi] === "me";
    const _tailTip = Math.max(4, Math.trunc(Math.trunc(115 * TAIL_VW / TAIL_VH) * (5.0 / 17.0)));
    const _meDead = Math.trunc((_tailTip + Math.trunc(5 * 2)) / 2); // safeMargin/scale = right dead space
    let bx = isMe ? CHAT_W - bW - pad + _meDead : pad;
    bx = Math.min(CHAT_W - bW, Math.max(Math.trunc(4 * 1.5), Math.trunc(bx)));
    cctx.drawImage(bubble, bx, Math.trunc(y));
    y += heights[vi] + (gapIdx < gaps.length ? gaps[gapIdx] : 0);
  }

  const roundedChat = applyRoundedCornersCanvas(chatImg, uiRound);
  const frame = createCanvas(W, H);
  const fctx = frame.getContext("2d");
  fctx.fillStyle = rgb(BG_COLOR);
  fctx.fillRect(0, 0, W, H);


  fctx.drawImage(roundedChat, chatX, chatY);
  return frame;
}

function parseTextWithSfx(text) {
  // Strip trailing invisible Unicode (variation selectors, ZWJ, etc.) before matching
  const normalized = text.replace(/[\uFE0F\u200D\u20E3\u{1F3FB}-\u{1F3FF}]+$/gu, "").trimEnd();
  const match = /\s*\[([^\]]+)\]\s*$/.exec(normalized);
  if (match) {
    const sfx = match[1].trim();
    const clean = normalized.replace(/\s*\[([^\]]+)\]\s*$/, "").trim();
    return [clean, sfx];
  }
  return [text.trim(), null];
}
function parseFileSettingsAndThreads(filename) {
  const raw = fs.readFileSync(filename, "utf8");
  let lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let unreadCount = "67";
  let uiCornerRadius = 40;
  const threads = [];
  let currentContact = null;
  let currentMsgs = [];
  let contactAvatar = null;

  const patThread = /iMessage[:\s]+([^:]+)(?:\s*:\s*(.+))?/i;
  const patUm = /(?:UM|UR)[:\s]+(\d+)/i;
  const patCr = /CR[:\s]+(\d+)/i;
  const patPlugsay = /^plugsay\s*>\s*([^:]+)\s*:\s*(.+)$/i;
  const patPlug = /^plug\s*>\s*([^:]+)\s*:\s*(.+)$/i;
  const patRizzsay = /^rizzsay\s*>\s*([^:]+)\s*:\s*(.+)$/i;
  const patRizz = /^rizz\s*>\s*([^:]+)\s*:\s*(.+)$/i;
  const patBreak = /^<break\s*:\s*(\d+(?:\.\d+)?)\s*s\s*:?>$/i;

  const filtered = [];
  for (const line of lines) {
    const mUm = patUm.exec(line);
    const mCr = patCr.exec(line);
    if (mUm) unreadCount = mUm[1];
    else if (mCr) uiCornerRadius = Math.trunc(parseInt(mCr[1], 10) * 1.5);
    else filtered.push(line);
  }
  lines = filtered;

  let pendingPlugsay = null;
  let pendingRizzsay = null;

  for (const line of lines) {
    if (line.toLowerCase().startsWith("rizz_say:") || line.toLowerCase().startsWith("rizz:")) {
      continue;
    }

    let m = patBreak.exec(line);
    if (m) {
      if (currentMsgs && currentContact) {
        currentMsgs.push({
          sender: "__break__",
          speaker: "__break__",
          text: "",
          tts_text: "",
          sfx: null,
          audio_only: false,
          is_plug: false,
          is_break: true,
          duration_s: parseFloat(m[1])
        });
      }
      continue;
    }

    m = patPlugsay.exec(line);
    if (m) {
      const rawSpeaker = m[1].trim();
      const rawText = m[2].trim();
      const [clean, sfx] = parseTextWithSfx(rawText);
      const [bubbleText, ttsTextRaw] = parseTtsOverride(clean);
      pendingPlugsay = {
        speaker: rawSpeaker,
        text: bubbleText,
        tts_text: stripBlurMarkers(ttsTextRaw),
        sfx,
        plugsay_silent: rawSpeaker.toLowerCase() === "none"
      };
      continue;
    }

    m = patPlug.exec(line);
    if (m) {
      const plugSpeaker = m[1].trim();
      const plugText = m[2].trim();
      const [bubbleText, ttsTextRaw] = parseTtsOverride(plugText);
      if (currentMsgs && currentContact) {
        currentMsgs.push({
          sender: "plug",
          speaker: plugSpeaker,
          text: bubbleText,
          tts_text: stripBlurMarkers(ttsTextRaw),
          sfx: null,
          audio_only: false,
          is_plug: true,
          plug_silent: plugSpeaker.toLowerCase() === "none",
          plugsay_speaker: pendingPlugsay?.speaker ?? plugSpeaker,
          plugsay_text: pendingPlugsay?.text ?? "",
          plugsay_tts_text: pendingPlugsay?.tts_text ?? "",
          plugsay_sfx: pendingPlugsay?.sfx ?? null,
          plugsay_silent: pendingPlugsay?.plugsay_silent ?? false
        });
      }
      pendingPlugsay = null;
      continue;
    }

    m = patRizzsay.exec(line);
    if (m) {
      const rawSpeaker = m[1].trim();
      const rawText = m[2].trim();
      const [clean, sfx] = parseTextWithSfx(rawText);
      const [bubbleText, ttsTextRaw] = parseTtsOverride(clean);
      pendingRizzsay = {
        speaker: rawSpeaker,
        text: bubbleText,
        tts_text: stripBlurMarkers(ttsTextRaw),
        sfx,
        rizzsay_silent: rawSpeaker.toLowerCase() === "none"
      };
      continue;
    }

    m = patRizz.exec(line);
    if (m) {
      const rizzSpeaker = m[1].trim();
      const rizzText = m[2].trim();
      const [bubbleText, ttsTextRaw] = parseTtsOverride(rizzText);
      if (currentMsgs && currentContact) {
        currentMsgs.push({
          sender: "rizz",
          speaker: rizzSpeaker,
          text: bubbleText,
          tts_text: stripBlurMarkers(ttsTextRaw),
          sfx: null,
          audio_only: false,
          is_plug: false,
          is_rizz: true,
          rizz_silent: rizzSpeaker.toLowerCase() === "none",
          rizzsay_speaker: pendingRizzsay?.speaker ?? rizzSpeaker,
          rizzsay_text: pendingRizzsay?.text ?? "",
          rizzsay_tts_text: pendingRizzsay?.tts_text ?? "",
          rizzsay_sfx: pendingRizzsay?.sfx ?? null,
          rizzsay_silent: pendingRizzsay?.rizzsay_silent ?? false
        });
      }
      pendingRizzsay = null;
      continue;
    }

    m = patThread.exec(line);
    if (m) {
      if (currentContact && currentMsgs.length) {
        threads.push({ contact: currentContact, messages: currentMsgs, avatar: contactAvatar });
      }
      currentContact = m[1].trim();
      contactAvatar = m[2] ? m[2].trim() : null;
      currentMsgs = [];
      pendingPlugsay = null;
      pendingRizzsay = null;
      continue;
    }

    if (line.includes(">") && line.includes(":")) {
      const idx = line.indexOf(":");
      const speakerSide = line.slice(0, idx);
      const text = line.slice(idx + 1);
      const gt = speakerSide.indexOf(">");
      const speaker = speakerSide.slice(0, gt);
      const sender = speakerSide.slice(gt + 1).trim();
      const [clean, sfx] = parseTextWithSfx(text);
      const [bubbleText, ttsTextRaw] = parseTtsOverride(clean);
      currentMsgs.push({
        sender,
        speaker: speaker.trim(),
        text: bubbleText,
        tts_text: stripBlurMarkers(ttsTextRaw),
        sfx,
        audio_only: sender.toLowerCase() === "audio",
        is_plug: false
      });
    } else if (line.includes(":")) {
      const idx = line.indexOf(":");
      const sender = line.slice(0, idx).trim();
      const text = line.slice(idx + 1);
      const [clean, sfx] = parseTextWithSfx(text);
      const [bubbleText, ttsTextRaw] = parseTtsOverride(clean);
      currentMsgs.push({
        sender,
        speaker: sender,
        text: bubbleText,
        tts_text: stripBlurMarkers(ttsTextRaw),
        sfx,
        audio_only: false,
        is_plug: false
      });
    }
  }

  if (currentContact && currentMsgs.length) {
    threads.push({ contact: currentContact, messages: currentMsgs, avatar: contactAvatar });
  }
  return [unreadCount, uiCornerRadius, threads];
}

async function getDynamicPageSize(msgs, start) {
  const chatY = Math.trunc(170 * 1.5);
  const bubbleStartY = TOPBAR_H + Math.trunc(24 * 1.5);
  const bottomReserve = Math.trunc(H * BOTTOM_RESERVE_RATIO);
  const availableH = H - bottomReserve - chatY - bubbleStartY;
  let usedH = 0;
  let count = 0;
  let prevSender = null;

  for (let i = start; i < msgs.length; i += 1) {
    const msg = msgs[i];
    if (msg.is_break || msg.audio_only || msg.is_plug || msg.is_rizz) {
      count += 1;
      continue;
    }

    const sender = msg.sender;
    const text = msg.text;
    const [isImg, fname] = isImageMessage(stripBlurMarkers(text));
    let h;
    if (isImg) {
      [, , h] = await imageMessageClip(fname, sender);
    } else {
      [, , h] = await bubbleImg(text, sender, 650, BUBBLE_FONT_SIZE, true);
    }

    const gap = prevSender === null ? 0 : (prevSender === sender ? -11 : 7);
    if (count > 0 && usedH + gap + h > availableH) break;
    usedH += gap + h;
    prevSender = sender;
    count += 1;
  }
  return Math.max(1, count);
}

function ttsCachePath(text, speaker) {
  ensureDirSync(TTS_CACHE_DIR);
  const hash = crypto.createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
  return path.join(TTS_CACHE_DIR, `${speaker.trim().toLowerCase()}_${hash}.mp3`);
}

function mapLower(obj) {
  return new Map(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));
}

function isMinimaxSpeaker(speaker) {
  const s = String(speaker).trim().toLowerCase();
  return s.startsWith("mx:") || s.startsWith("mx_") || mapLower(MINIMAX_VOICE_MAP).has(s);
}

function getMinimaxVoiceId(speaker) {
  const s = String(speaker).trim();
  if (s.toLowerCase().startsWith("mx:")) return s.slice(3).trim();
  if (s.toLowerCase().startsWith("mx_")) {
    const lower = mapLower(MINIMAX_VOICE_MAP);
    // Check map first (e.g. mx_friendly → 209533299589184)
    const fromMap = lower.get(s.toLowerCase());
    if (fromMap) return fromMap;
    // Otherwise treat the part after mx_ as a raw voice ID
    return s.slice(3).trim();
  }
  const lower = mapLower(MINIMAX_VOICE_MAP);
  return lower.get(s.toLowerCase()) ?? Object.values(MINIMAX_VOICE_MAP)[0];
}

function getElevenlabsVoiceId(speaker) {
  const s = String(speaker).trim();
  // Check map by lowercase name first
  const fromMap = AI33PRO_VOICE_MAP[s.toLowerCase()];
  if (fromMap) return fromMap;
  // If it looks like a raw ElevenLabs voice ID (20+ alphanumeric chars), use directly
  if (/^[A-Za-z0-9]{15,}$/.test(s)) {
    console.log(`[TTS] Using raw voice ID: ${s}`);
    return s;
  }
  // Fall back to adam
  console.log(`[TTS] Unknown speaker '${s}', using default (adam)`);
  return AI33PRO_VOICE_MAP["adam"];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson(url, payload, headers, timeoutMs = 60000) {
  const { resp, buffer } = await fetchBuffer(
    url,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    },
    timeoutMs
  );
  return { resp, buffer, bodyText: buffer.toString("utf8") };
}

async function downloadToFile(url, outPath) {
  const { resp, buffer } = await fetchBuffer(url, {}, 60000);
  if (resp.status < 200 || resp.status >= 300) {
    throw new Error(`download failed ${resp.status}: ${buffer.toString("utf8").slice(0, 200)}`);
  }
  await fsp.writeFile(outPath, buffer);
  return buffer;
}

async function copyIfDifferent(src, dest) {
  if (path.resolve(src) !== path.resolve(dest)) await fsp.copyFile(src, dest);
}

async function genMinimaxAudio(apiKey, text, outPath, speaker) {
  const cached = ttsCachePath(text, `mmx_${speaker}`);
  if (fs.existsSync(cached) && fs.statSync(cached).size > 0) {
    console.log(`[MINIMAX TTS CACHE] HIT -> ${path.basename(cached)}`);
    await copyIfDifferent(cached, outPath);
    return;
  }

  // Minimax is exposed via the AI33Pro gateway -> always prefer the AI33Pro key
  const mxKey = process.env.AI33PRO_API_KEY || apiKey;
  const voiceId = getMinimaxVoiceId(speaker);
  console.log(`[MINIMAX TTS] speaker='${speaker}' voice_id='${voiceId}' text='${text.slice(0, 60)}'`);
  const url = "https://api.ai33.pro/v1m/task/text-to-speech";
  const headers = { "Content-Type": "application/json", "xi-api-key": mxKey };
  const payload = {
    text,
    model: "speech-2.8-turbo",
    voice_setting: { voice_id: voiceId, vol: 1, pitch: 0, speed: 1.15 },
    language_boost: "Auto",
    with_transcript: false
  };

  let taskId = null;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      const { resp, bodyText } = await postJson(url, payload, headers, 30000);
      if (resp.status === 200) {
        const data = JSON.parse(bodyText);
        if (data.task_id) {
          taskId = data.task_id;
          break;
        }
      }
      if (resp.status === 429 || bodyText.toLowerCase().includes("too many")) {
        await sleep(6000);
        continue;
      }
      throw new Error(`Minimax TTS submit failed [${resp.status}]: ${bodyText}`);
    } catch (err) {
      if (attempt === 20) throw err;
      console.log(`[MINIMAX TTS] submit error attempt ${attempt}: ${err.message}`);
      await sleep(6000);
    }
  }
  if (!taskId) throw new Error(`Minimax TTS blocked after retries for '${text.slice(0, 60)}'`);

  const taskUrl = `https://api.ai33.pro/v1/task/${taskId}`;
  let pollFails = 0;
  let audioUrl = null;
  while (!audioUrl) {
    await sleep(2500);
    const { resp, buffer } = await fetchBuffer(taskUrl, { headers }, 20000);
    const body = buffer.toString("utf8");
    if (resp.status === 429 || body.toLowerCase().includes("too many requests")) {
      pollFails += 1;
      if (pollFails >= 30) throw new Error("Minimax TTS polling rate limited too many times");
      await sleep(4000);
      continue;
    }
    if (resp.status !== 200) {
      pollFails += 1;
      if (pollFails >= 30) throw new Error(`Minimax TTS polling HTTP ${resp.status}`);
      await sleep(3000);
      continue;
    }
    pollFails = 0;
    const data = JSON.parse(body);
    if (data.status === "done") audioUrl = data.metadata.audio_url;
    else if (data.status === "error") throw new Error(data.error_message || "Minimax TTS task error");
  }
  const audio = await downloadToFile(audioUrl, outPath);
  await fsp.writeFile(cached, audio);
}

async function genAi33proAudio(apiKey, text, outPath, speaker) {
  const cached = ttsCachePath(text, speaker);
  if (fs.existsSync(cached) && fs.statSync(cached).size > 0) {
    console.log(`[TTS CACHE] HIT -> ${path.basename(cached)}`);
    await copyIfDifferent(cached, outPath);
    return;
  }

  const voiceId = getElevenlabsVoiceId(speaker);
  const url = `https://api.ai33.pro/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
  const headers = { "xi-api-key": apiKey, "Content-Type": "application/json" };
  const payload = {
    text,
    model_id: "eleven_multilingual_v2",
    voice_settings: {
      stability: 0.5,
      similarity: 0.75,
      exaggeration: 0.0,
      speed: 1.17,
      style: 0.5,
      speaker_boost: true
    },
    with_transcript: false
  };

  let taskId = null;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const { resp, bodyText } = await postJson(url, payload, headers, 30000);
    if (resp.status === 200) {
      const data = JSON.parse(bodyText);
      if (data.task_id) {
        taskId = data.task_id;
        break;
      }
    }
    const lower = bodyText.toLowerCase();
    if (lower.includes("too many tasks in queue")) {
      await sleep(4000);
      continue;
    }
    if (lower.includes("too many requests") || resp.status === 429) {
      await sleep(6000);
      continue;
    }
    throw new Error(`AI33Pro TTS submit failed: ${bodyText}`);
  }
  if (!taskId) throw new Error(`AI33Pro TTS blocked after retries for '${text.slice(0, 60)}'`);

  let audioUrl = null;
  let pollFails = 0;
  const taskUrl = `https://api.ai33.pro/v1/task/${taskId}`;
  while (!audioUrl) {
    await sleep(2500);
    const { resp, buffer } = await fetchBuffer(taskUrl, { headers }, 20000);
    const body = buffer.toString("utf8");
    if (resp.status === 429 || body.toLowerCase().includes("too many requests")) {
      pollFails += 1;
      if (pollFails >= 15) throw new Error("AI33Pro polling rate limited too many times");
      await sleep(4000);
      continue;
    }
    if (resp.status !== 200) {
      pollFails += 1;
      if (pollFails >= 15) throw new Error(`AI33Pro polling HTTP ${resp.status}`);
      await sleep(3000);
      continue;
    }
    pollFails = 0;
    const data = JSON.parse(body);
    if (data.status === "done") audioUrl = data.metadata.audio_url;
    else if (data.status === "error") throw new Error(data.error_message || "Unknown AI33Pro TTS error");
  }
  const audio = await downloadToFile(audioUrl, outPath);
  await fsp.writeFile(cached, audio);
}

async function genElevenlabsAudio(apiKey, text, outPath, speaker) {
  const cached = ttsCachePath(text, speaker);
  if (fs.existsSync(cached) && fs.statSync(cached).size > 0) {
    console.log(`[TTS CACHE] HIT -> ${path.basename(cached)}`);
    await copyIfDifferent(cached, outPath);
    return;
  }

  const voiceId = getElevenlabsVoiceId(speaker);
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
  const headers = {
    "xi-api-key": apiKey,
    "Content-Type": "application/json",
    Accept: "audio/mpeg"
  };
  const payload = {
    text,
    model_id: "eleven_multilingual_v2",
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.5,
      use_speaker_boost: true,
      speed: 1.17
    },
    with_transcript: false
  };

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const { resp, buffer } = await postJson(url, payload, headers, 60000);
    if (resp.status === 200) {
      await fsp.writeFile(outPath, buffer);
      await fsp.writeFile(cached, buffer);
      return;
    }
    if (resp.status === 429) {
      await sleep(6000);
      continue;
    }
    throw new Error(`ElevenLabs TTS failed [${resp.status}]: ${buffer.toString("utf8").slice(0, 200)}`);
  }
  throw new Error(`ElevenLabs TTS failed after retries for '${text.slice(0, 60)}'`);
}

async function genTtsAudio(apiKey, text, outPath, speaker) {
  text = normalizeText(text);
  if (isMinimaxSpeaker(speaker)) {
    await genMinimaxAudio(apiKey, text, outPath, speaker);
  } else if (TTS_PROVIDER === "elevenlabs") {
    await genElevenlabsAudio(ELEVENLABS_API_KEY, text, outPath, speaker);
  } else if (TTS_PROVIDER === "ai33pro") {
    await genAi33proAudio(apiKey, text, outPath, speaker);
  } else {
    await genAi33proAudio(apiKey, text, outPath, speaker);
  }
}

function collectAllTtsTasks(threads) {
  const seen = new Set();
  const tasks = [];
  const add = (text, speaker) => {
    if (!text || !speaker) return;
    const speakerL = speaker.trim().toLowerCase();
    if (speakerL === "none") return;
    text = normalizeText(text.trim());
    const key = JSON.stringify([text, speakerL]);
    if (!seen.has(key)) {
      seen.add(key);
      tasks.push([text, speaker]);
    }
  };

  for (const thread of threads) {
    for (const msg of thread.messages) {
      if (msg.is_break) continue;
      if (msg.is_plug) {
        if (!msg.plugsay_silent) add(msg.plugsay_tts_text || "", msg.plugsay_speaker || "");
        if (!msg.plug_silent) add(msg.tts_text || "", msg.speaker || "");
        continue;
      }
      if (msg.is_rizz) {
        if (!msg.rizzsay_silent) add(msg.rizzsay_tts_text || "", msg.rizzsay_speaker || "");
        if (!msg.rizz_silent) add(msg.tts_text || "", msg.speaker || "");
        continue;
      }
      const textPlain = stripBlurMarkers(msg.text || "");
      const [isImg] = isImageMessage(textPlain);
      const isDots = /^[.\s\u2026]+$/.test(textPlain);
      const isEmojiOnly = isEmojiOnlyMessage(textPlain);
      if (isImg || isDots || isEmojiOnly) continue;
      const ttsStripped = stripEmojisForTts(msg.tts_text || "").trim();
      if (ttsStripped) add(ttsStripped, msg.speaker || "");
    }
  }
  return tasks;
}

async function prefetchTtsParallel(tasks, apiKey, maxWorkers = 10) {
  if (!tasks.length) {
    console.log("[TTS PREFETCH] No tasks to prefetch.");
    return;
  }
  const workers = maxWorkers;
  console.log(`[TTS PREFETCH] Starting ${tasks.length} unique tasks with up to ${workers} workers`);

  let next = 0;
  let completed = 0;
  let failed = 0;
  async function worker(slot) {
    while (next < tasks.length) {
      const idx = next;
      next += 1;
      const [text, speaker] = tasks[idx];
      await sleep((slot % workers) * 400);
      try {
        let cacheKey = speaker;
        if (isMinimaxSpeaker(speaker)) cacheKey = `mmx_${speaker}`;
        const cachePath = ttsCachePath(text, cacheKey);
        if (!(fs.existsSync(cachePath) && fs.statSync(cachePath).size > 0)) {
          await genTtsAudio(apiKey, text, cachePath, speaker);
        }
        completed += 1;
        console.log(`[TTS PREFETCH] ${completed}/${tasks.length} speaker=${speaker} text='${text.slice(0, 40)}'`);
      } catch (err) {
        completed += 1;
        failed += 1;
        console.log(`[TTS PREFETCH] ERROR ${completed}/${tasks.length} speaker=${speaker}: ${err.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: workers }, (_, i) => worker(i)));
  console.log(`[TTS PREFETCH] Done: ${completed - failed}/${tasks.length} succeeded, ${failed} failed`);
}

function runCommand(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true, ...opts });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => { stdout += d.toString(); });
    child.stderr?.on("data", (d) => { stderr += d.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} ${args.join(" ")} failed (${code}): ${stderr}`));
    });
  });
}

async function getAudioDuration(audioPath) {
  try {
    const { stdout } = await runCommand("ffprobe", [
      "-v", "error",
      "-select_streams", "a:0",
      "-show_entries", "stream=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      audioPath
    ]);
    const s = stdout.trim();
    if (s && s !== "N/A") return parseFloat(s);
  } catch {
    // Fallback below.
  }
  const { stdout } = await runCommand("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=nokey=1:noprint_wrappers=1",
    audioPath
  ]);
  return parseFloat(stdout.trim());
}

async function convertToWav(inputPath, outputPath) {
  await runCommand("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-c:a", "pcm_s16le",
    "-ar", "44100",
    "-ac", "1",
    outputPath
  ]);
  return outputPath;
}

async function generateSilentWav(durationS, outputPath) {
  await runCommand("ffmpeg", [
    "-y",
    "-f", "lavfi",
    "-i", "anullsrc=r=44100:cl=mono",
    "-t", String(durationS),
    "-c:a", "pcm_s16le",
    outputPath
  ]);
  return outputPath;
}

async function trimSilenceFromWav(wavPath) {
  const tmp = wavPath.replace(/\.wav$/i, "_trim.wav");
  try {
    await runCommand("ffmpeg", [
      "-y",
      "-i", wavPath,
      "-af", "silenceremove=start_periods=1:start_duration=0.005:start_threshold=-60dB",
      tmp
    ]);
    if (fs.existsSync(tmp) && fs.statSync(tmp).size > 512) {
      const d = await getAudioDuration(tmp);
      if (d > 0.1) await fsp.copyFile(tmp, wavPath);
    }
  } catch (err) {
    console.log(`[TRIM WAV] WARNING: could not trim ${path.basename(wavPath)}: ${err.message}`);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}

async function validateMp3(p) {
  if (!fs.existsSync(p) || fs.statSync(p).size < 512) return false;
  try {
    const { stdout } = await runCommand("ffprobe", [
      "-v", "error",
      "-select_streams", "a:0",
      "-show_entries", "stream=codec_type",
      "-of", "default=noprint_wrappers=1:nokey=1",
      p
    ]);
    return stdout.trim().includes("audio");
  } catch {
    return false;
  }
}

function ffconcatPath(p) {
  // Keep native separators — ffmpeg handles both on Windows,
  // but the concat demuxer is more reliable with native backslashes.
  // Only escape single quotes (for ffconcat quoting).
  return path.resolve(p).replace(/'/g, "\\'");
}

async function concatMediaFiles(files, outputPath, copyCodec = true) {
  if (!files.length) return null;
  if (files.length === 1) {
    await fsp.copyFile(files[0], outputPath);
    return outputPath;
  }
  const concatFile = outputPath.replace(/\.[^.]+$/, "_concat.txt");
  await fsp.writeFile(concatFile, files.map((f) => `file '${ffconcatPath(f)}'\n`).join(""), "utf8");
  const args = ["-y", "-f", "concat", "-safe", "0", "-i", concatFile];
  if (copyCodec) args.push("-c", "copy");
  args.push(outputPath);
  try {
    await runCommand("ffmpeg", args);
  } finally {
    if (fs.existsSync(concatFile)) fs.unlinkSync(concatFile);
  }
  return outputPath;
}

async function concatWavFiles(wavFiles, outputPath) {
  return concatMediaFiles(wavFiles, outputPath, true);
}

async function concatMp3WithSfx(ttsMp3, sfxFile, outPath) {
  try {
    await runCommand("ffmpeg", [
      "-y",
      "-i", ttsMp3,
      "-i", sfxFile,
      "-filter_complex",
        "[1:a]silenceremove=start_periods=1:start_duration=0.005:start_threshold=-60dB," +
        "areverse,silenceremove=start_periods=1:start_duration=0.005:start_threshold=-60dB," +
        "areverse[sfx_trimmed];" +
        "[0:a][sfx_trimmed]concat=n=2:v=0:a=1[outa]",
      "-map", "[outa]",
      "-ar", "44100",
      "-ac", "1",
      "-c:a", "libmp3lame",
      "-b:a", "128k",
      outPath
    ]);
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 512) return outPath;
    console.log(`[SFX CONCAT] WARNING: output too small, falling back to TTS only`);
    return ttsMp3;
  } catch (err) {
    console.log(`[SFX CONCAT] WARNING: failed to concat SFX '${path.basename(sfxFile)}': ${err.message}`);
    return ttsMp3;
  }
}

function resolveSfxPath(sfxName, imageBaseDir) {
  if (!sfxName) return null;
  // Build search dirs: include sfx/ subdirectories alongside each base
  const bases = [imageBaseDir, __dirname, process.cwd()];
  const searchDirs = [];
  for (const b of bases) {
    searchDirs.push(b);
    searchDirs.push(path.join(b, "sfx"));
    searchDirs.push(path.join(b, "..", "sfx"));
  }
  for (const dir of searchDirs) {
    const withExt = path.join(dir, `${sfxName}.mp3`);
    if (fs.existsSync(withExt)) return withExt;
    const asIs = path.join(dir, sfxName);
    if (fs.existsSync(asIs)) return asIs;
    // Also try without .mp3 extension if sfxName already has one
    if (sfxName.match(/\.mp3$/i)) {
      const noExt = path.join(dir, sfxName);
      if (fs.existsSync(noExt)) return noExt;
    }
  }
  console.log(`[SFX] WARNING: '${sfxName}' not found in sfx/ folder or project dirs`);
  return null;
}

async function renderContextForPlug(msgsSoFar) {
  const visible = msgsSoFar
    .map((m, i) => [i, m])
    .filter(([, m]) => !m.is_plug && !m.is_rizz && !m.audio_only && !m.is_break);
  const last3 = visible.length >= 3 ? visible.slice(-3) : visible;
  if (!last3.length) return null;

  const miniClips = [];
  const miniWs = [];
  const miniHs = [];
  const miniSnd = [];
  for (let li = 0; li < last3.length; li += 1) {
    const [, msg] = last3[li];
    const sender = msg.sender;
    const text = msg.text;
    const [isImg, fname] = isImageMessage(stripBlurMarkers(text));
    let showTail = true;
    if (li + 1 < last3.length && last3[li + 1][1].sender === sender) showTail = false;

    let clip;
    let w;
    let h;
    if (isImg) [clip, w, h] = await imageMessageClip(fname, sender);
    else [clip, w, h] = await bubbleImg(text, sender, 650, BUBBLE_FONT_SIZE, showTail);
    miniClips.push(clip);
    miniWs.push(w);
    miniHs.push(h);
    miniSnd.push(sender);
  }

  const pad = Math.trunc(38 * 1.5);
  const gaps = [];
  for (let k = 0; k < miniSnd.length - 1; k += 1) {
    gaps.push(miniSnd[k] === miniSnd[k + 1] ? -11 : 7);
  }
  const topPad = Math.trunc(14 * 1.5);
  const bottomPad = Math.trunc(14 * 1.5);
  const totalH = topPad + miniHs.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0) + bottomPad;
  const img = createCanvas(CHAT_W, Math.trunc(totalH));
  const ctx = img.getContext("2d");
  ctx.fillStyle = rgb(THEME.chat_bg);
  ctx.fillRect(0, 0, img.width, img.height);
  let y = topPad;
  const maxW = CHAT_W - pad * 2;
  for (let k = 0; k < miniClips.length; k += 1) {
    const bW = Math.min(miniWs[k], maxW);
    const isMe = miniSnd[k] === "me";
    let bx = isMe ? CHAT_W - bW - pad : pad;
    bx = Math.min(CHAT_W - bW - Math.trunc(15 * 1.5), Math.max(Math.trunc(10 * 1.5), Math.trunc(bx)));
    ctx.drawImage(miniClips[k], bx, Math.trunc(y));
    y += miniHs[k] + (k < gaps.length ? gaps[k] : 0);
  }
  return img;
}

async function runPlugBrowser(replyText, contextImgPath, dlFolder) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  let downloadedPath = null;
  try {
    await page.goto(pathToFileURL(PLUGAI_URL).href, { waitUntil: "domcontentloaded", timeout: 25000 });
    try {
      await page.setInputFiles("input[type='file']", contextImgPath, { timeout: 25000 });
      await sleep(2500);
    } catch (err) {
      console.log(`[PLUG] upload warning: ${err.message}`);
    }
    try {
      await page.locator("div.msg-bubble[contenteditable='true']").evaluate((el, text) => {
        el.textContent = text;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }, replyText, { timeout: 25000 });
      await sleep(800);
    } catch (err) {
      console.log(`[PLUG] text warning: ${err.message}`);
    }

    const downloadPromise = page.waitForEvent("download", { timeout: 25000 }).catch(() => null);
    try {
      await page.locator("button.save-btn").click({ timeout: 10000 });
    } catch {
      await page.evaluate(() => {
        if (typeof window.downloadHD === "function") window.downloadHD();
      }).catch(() => {});
    }
    const download = await downloadPromise;
    if (download) {
      downloadedPath = path.join(dlFolder, download.suggestedFilename() || "plug.png");
      await download.saveAs(downloadedPath);
    } else {
      downloadedPath = path.join(dlFolder, "plug_fallback.png");
      await page.screenshot({ path: downloadedPath, fullPage: true });
    }
  } catch (err) {
    console.log(`[PLUG] browser error: ${err.message}`);
    downloadedPath = path.join(dlFolder, "plug_error.png");
    await page.screenshot({ path: downloadedPath, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
  return downloadedPath;
}

async function generatePlugScene(plugMsg, msgsBefore, apiKey, tmpDir, sceneIdx, imageBaseDir) {
  const plugsaySpeaker = plugMsg.plugsay_speaker;
  const plugsayText = plugMsg.plugsay_text;
  const plugsayTtsText = plugMsg.plugsay_tts_text || stripBlurMarkers(plugsayText);
  const plugsaySfx = plugMsg.plugsay_sfx;
  const plugsaySilent = plugMsg.plugsay_silent || false;
  const plugSpeaker = plugMsg.speaker;
  const plugText = plugMsg.text;
  const plugTtsText = plugMsg.tts_text || stripBlurMarkers(plugText);

  const contextImg = await renderContextForPlug(msgsBefore);
  const dlFolder = path.join(tmpDir, `plug_dl_${sceneIdx}`);
  ensureDirSync(dlFolder);
  const ctxPath = path.join(dlFolder, "context.png");
  await fsp.writeFile(ctxPath, (contextImg || blankCanvas(CHAT_W, 200, THEME.chat_bg)).toBuffer("image/png"));

  const plugImgPath = await runPlugBrowser(plugText, ctxPath, dlFolder);
  let plugImg = fs.existsSync(plugImgPath) ? await loadImage(plugImgPath) : null;
  if (!plugImg) plugImg = blankCanvas(CHAT_W, 400, THEME.chat_bg);

  const trimmed = await trimTransparentImage(plugImg);
  const newW = Math.trunc(trimmed.width * PLUGAI_SCALE);
  const newH = Math.trunc(trimmed.height * PLUGAI_SCALE);
  const scaled = createCanvas(newW, newH);
  scaled.getContext("2d").drawImage(trimmed, 0, 0, newW, newH);

  const frame = blankCanvas(W, H, BG_COLOR);
  const fctx = frame.getContext("2d");
  const px = Math.trunc((W - newW) / 2);
  const py = Math.trunc((H - newH) / 2 - H * 0.05);
  fctx.drawImage(scaled, px, py);

  let wavPlugsay = null;
  if (plugsaySilent) {
    if (plugsaySfx) {
      const sfxPath = resolveSfxPath(plugsaySfx, imageBaseDir);
      if (sfxPath) {
        wavPlugsay = path.join(tmpDir, `plug_${sceneIdx}_say.wav`);
        await convertToWav(sfxPath, wavPlugsay);
      }
    }
  } else {
    wavPlugsay = path.join(tmpDir, `plug_${sceneIdx}_say.wav`);
    const mp3Say = path.join(tmpDir, `plug_${sceneIdx}_say.mp3`);
    await genTtsAudio(apiKey, plugsayTtsText, mp3Say, plugsaySpeaker);
    await convertToWav(mp3Say, wavPlugsay);
    await trimSilenceFromWav(wavPlugsay);
  }

  let wavPlug = null;
  if (!plugMsg.plug_silent) {
    wavPlug = path.join(tmpDir, `plug_${sceneIdx}_reply.wav`);
    const mp3Reply = path.join(tmpDir, `plug_${sceneIdx}_reply.mp3`);
    await genTtsAudio(apiKey, plugTtsText, mp3Reply, plugSpeaker);
    await convertToWav(mp3Reply, wavPlug);
    await trimSilenceFromWav(wavPlug);
  }
  return [frame, wavPlugsay, wavPlug];
}

function blankCanvas(width, height, color) {
  const c = createCanvas(width, height);
  const ctx = c.getContext("2d");
  ctx.fillStyle = rgb(color);
  ctx.fillRect(0, 0, width, height);
  return c;
}

async function trimTransparentImage(img) {
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  let top = c.height;
  let left = c.width;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < c.height; y += 1) {
    for (let x = 0; x < c.width; x += 1) {
      const i = (y * c.width + x) * 4;
      const alpha = data[i + 3];
      const sum = data[i] + data[i + 1] + data[i + 2];
      if (!(alpha < 10 || sum < 30)) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < left || bottom < top) return c;
  top = Math.max(0, top - 1);
  left = Math.max(0, left - 1);
  bottom = Math.min(c.height - 1, bottom + 1);
  right = Math.min(c.width - 1, right + 1);
  const out = createCanvas(right - left + 1, bottom - top + 1);
  out.getContext("2d").drawImage(c, left, top, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

async function runRizzBrowser(rizzReplyText, contextImgPath, dlFolder, htmlPath = null) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  let downloadedPath = null;
  let bubbleTopRatio = RIZZ_REVEAL_RATIO;
  try {
    const url = htmlPath && fs.existsSync(htmlPath) ? pathToFileURL(htmlPath).href : RIZZ_URL;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    try {
      await page.setInputFiles("input[type='file']", contextImgPath, { timeout: 25000 });
      await sleep(2500);
    } catch (err) {
      console.log(`[RIZZ] upload warning: ${err.message}`);
    }
    try {
      await page.locator("#rizzInput").fill(rizzReplyText, { timeout: 25000 });
      await sleep(800);
    } catch (err) {
      console.log(`[RIZZ] text warning: ${err.message}`);
    }
    try {
      const ratio = await page.evaluate(() => {
        const tmpl = document.getElementById("template");
        const bubble = document.querySelector(".bubble-wrap");
        if (!tmpl || !bubble) return -1;
        const tr = tmpl.getBoundingClientRect();
        const br = bubble.getBoundingClientRect();
        if (tr.height === 0) return -1;
        return (br.top - tr.top) / tr.height;
      });
      if (typeof ratio === "number" && ratio > 0 && ratio < 1) bubbleTopRatio = ratio;
    } catch {
      // Keep fallback.
    }

    const downloadPromise = page.waitForEvent("download", { timeout: 25000 }).catch(() => null);
    await page.locator("#shotBtn").click({ timeout: 10000 }).catch(() => {});
    const download = await downloadPromise;
    if (download) {
      downloadedPath = path.join(dlFolder, download.suggestedFilename() || "rizz.png");
      await download.saveAs(downloadedPath);
    } else {
      downloadedPath = path.join(dlFolder, "rizz_fallback.png");
      await page.screenshot({ path: downloadedPath, fullPage: true });
    }
  } catch (err) {
    console.log(`[RIZZ] browser error: ${err.message}`);
    downloadedPath = path.join(dlFolder, "rizz_error.png");
    await page.screenshot({ path: downloadedPath, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
  return [downloadedPath, bubbleTopRatio];
}

function buildRizzFrames(rizzImg, bubbleTopRatio = RIZZ_REVEAL_RATIO) {
  const maskRadius = 15;
  const offsetUp = 200;
  const cropPx = 4;
  const extraPixels = 2;

  const croppedW = Math.max(1, rizzImg.width - cropPx * 2);
  const croppedH = Math.max(1, rizzImg.height - cropPx * 2);
  const cropped = createCanvas(croppedW, croppedH);
  cropped.getContext("2d").drawImage(rizzImg, cropPx, cropPx, croppedW, croppedH, 0, 0, croppedW, croppedH);

  const newW = Math.trunc(croppedW * RIZZ_SCALE);
  const newH = Math.trunc(croppedH * RIZZ_SCALE);
  const scaled = createCanvas(newW, newH);
  scaled.getContext("2d").drawImage(cropped, 0, 0, newW, newH);
  const rounded = applyRoundedCornersCanvas(scaled, maskRadius);

  const px = Math.trunc((W - newW) / 2);
  const py = Math.max(0, Math.trunc((H - newH) / 2 - offsetUp));
  const full = blankCanvas(W, H, BG_COLOR);
  full.getContext("2d").drawImage(rounded, px, py);

  const partial = createCanvas(W, H);
  const pctx = partial.getContext("2d");
  pctx.drawImage(full, 0, 0);
  const revealH = Math.trunc(newH * bubbleTopRatio) + extraPixels;
  const hideStartY = py + revealH;
  pctx.fillStyle = rgb(BG_COLOR);
  pctx.fillRect(px, hideStartY, newW, newH - revealH);
  return [partial, full];
}

async function generateRizzScene(rizzMsg, msgsBefore, apiKey, tmpDir, sceneIdx, imageBaseDir) {
  const rizzsaySpeaker = rizzMsg.rizzsay_speaker;
  const rizzsayText = rizzMsg.rizzsay_text;
  const rizzsayTtsText = rizzMsg.rizzsay_tts_text || stripBlurMarkers(rizzsayText);
  const rizzsaySfx = rizzMsg.rizzsay_sfx;
  const rizzsaySilent = rizzMsg.rizzsay_silent || false;
  const rizzSpeaker = rizzMsg.speaker;
  const rizzText = rizzMsg.text;
  const rizzTtsText = rizzMsg.tts_text || stripBlurMarkers(rizzText);
  const rizzSilent = rizzMsg.rizz_silent || false;

  const contextImg = await renderContextForPlug(msgsBefore);
  const dlFolder = path.join(tmpDir, `rizz_dl_${sceneIdx}`);
  ensureDirSync(dlFolder);
  const ctxPath = path.join(dlFolder, "context.png");
  await fsp.writeFile(ctxPath, (contextImg || blankCanvas(CHAT_W, 200, THEME.chat_bg)).toBuffer("image/png"));

  const rizzHtml = path.join(imageBaseDir, "rizz.html");
  const [rizzImgPath, bubbleTopRatio] = await runRizzBrowser(rizzText, ctxPath, dlFolder, rizzHtml);
  const rizzImg = fs.existsSync(rizzImgPath) ? await loadImage(rizzImgPath) : blankCanvas(CHAT_W, 600, THEME.chat_bg);
  const [framePartial, frameFull] = buildRizzFrames(rizzImg, bubbleTopRatio);

  let wavRizzsay = null;
  if (rizzsaySilent) {
    if (rizzsaySfx) {
      const sfxPath = resolveSfxPath(rizzsaySfx, imageBaseDir);
      if (sfxPath) {
        wavRizzsay = path.join(tmpDir, `rizz_${sceneIdx}_say.wav`);
        await convertToWav(sfxPath, wavRizzsay);
      }
    }
  } else {
    wavRizzsay = path.join(tmpDir, `rizz_${sceneIdx}_say.wav`);
    const mp3Say = path.join(tmpDir, `rizz_${sceneIdx}_say.mp3`);
    await genTtsAudio(apiKey, rizzsayTtsText, mp3Say, rizzsaySpeaker);
    await convertToWav(mp3Say, wavRizzsay);
    await trimSilenceFromWav(wavRizzsay);
  }

  let wavRizz = null;
  if (!rizzSilent) {
    wavRizz = path.join(tmpDir, `rizz_${sceneIdx}_reply.wav`);
    const mp3Reply = path.join(tmpDir, `rizz_${sceneIdx}_reply.mp3`);
    await genTtsAudio(apiKey, rizzTtsText, mp3Reply, rizzSpeaker);
    await convertToWav(mp3Reply, wavRizz);
    await trimSilenceFromWav(wavRizz);
  }
  return [framePartial, frameFull, wavRizzsay, wavRizz];
}

function findDiffRows(newFrame, oldFrame) {
  const ctxN = newFrame.getContext("2d");
  const ctxO = oldFrame.getContext("2d");
  const h = H - Math.trunc(170 * 1.5);
  const y0 = Math.trunc(170 * 1.5);
  const n = ctxN.getImageData(0, y0, W, h).data;
  const o = ctxO.getImageData(0, y0, W, h).data;
  let first = -1;
  let last = -1;
  for (let y = 0; y < h; y += 1) {
    const rowStart = y * W * 4;
    let different = false;
    for (let x = 0; x < W * 4; x += 4) {
      const i = rowStart + x;
      if (n[i] !== o[i] || n[i + 1] !== o[i + 1] || n[i + 2] !== o[i + 2]) {
        different = true;
        break;
      }
    }
    if (different) {
      if (first < 0) first = y;
      last = y;
    }
  }
  return first < 0 ? null : [first, last];
}

function composeReveal(newFrame, prevFrame, clipRow, uiRound) {
  const out = createCanvas(W, H);
  const ctx = out.getContext("2d");

  // 1. Draw the new frame fully first
  ctx.drawImage(newFrame, 0, 0);

  // 2. Cover everything BELOW clipRow with the previous frame
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, clipRow, W, H - clipRow);
  ctx.clip();
  ctx.drawImage(prevFrame, 0, 0);
  ctx.restore();

  // 3. If rounded corners, repaint the BG color over the corner areas
  // so the chat panel corners stay clean at the reveal edge
  if (uiRound > 0) {
    const chatX = Math.trunc((W - CHAT_W) / 2);
    const r = uiRound;
    const chatY = Math.trunc(170 * 1.5);

    // Only fix corners when clipRow is near the top of the chat panel
    if (clipRow > chatY && clipRow < chatY + r * 2) {
      // Left corner
      ctx.save();
      ctx.beginPath();
      ctx.rect(chatX, chatY, r, r);
      ctx.clip();
      ctx.clearRect(chatX, chatY, r, r);
      ctx.drawImage(prevFrame, chatX, chatY, r, r, chatX, chatY, r, r);
      // Cut out the rounded part showing new frame
      ctx.beginPath();
      ctx.arc(chatX + r, chatY + r, r, Math.PI, Math.PI * 1.5);
      ctx.lineTo(chatX + r, chatY);
      ctx.lineTo(chatX, chatY);
      ctx.closePath();
      ctx.fillStyle = rgb(BG_COLOR);
      ctx.fill();
      ctx.restore();

      // Right corner
      ctx.save();
      ctx.beginPath();
      ctx.rect(chatX + CHAT_W - r, chatY, r, r);
      ctx.clip();
      ctx.clearRect(chatX + CHAT_W - r, chatY, r, r);
      ctx.drawImage(prevFrame, chatX + CHAT_W - r, chatY, r, r, chatX + CHAT_W - r, chatY, r, r);
      ctx.beginPath();
      ctx.arc(chatX + CHAT_W - r, chatY + r, r, Math.PI * 1.5, 0);
      ctx.lineTo(chatX + CHAT_W, chatY);
      ctx.lineTo(chatX + CHAT_W - r, chatY);
      ctx.closePath();
      ctx.fillStyle = rgb(BG_COLOR);
      ctx.fill();
      ctx.restore();
    }
  }

  return out;
}

function streamWrite(stream, chunk) {
  return new Promise((resolve, reject) => {
    stream.write(chunk, (err) => (err ? reject(err) : resolve()));
  });
}

async function writeVideoWithFfmpeg(scenesData, wavFiles, fps, outputPath, audioPath, uiRound, pageTurnSceneIndices = [], rizzSceneIndices = [], plugSceneIndices = []) {
  console.log(`[FRAME GEN] Starting generation for ${scenesData.length} scenes`);
  const durations = [];
  for (const wf of wavFiles) durations.push(await getAudioDuration(wf));

  const frameCounts = [];
  let cumulative = 0;
  let prevEndFrame = 0;
  for (const d of durations) {
    cumulative += d;
    const endFrame = Math.trunc(cumulative * fps + 0.5);
    frameCounts.push(endFrame - prevEndFrame);
    prevEndFrame = endFrame;
  }

  const args = [
    "-y",
    "-f", "image2pipe",
    "-framerate", String(fps),
    "-i", "pipe:0",
    "-i", audioPath,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "veryfast",
    "-b:v", "25M",
    "-c:a", "aac",
    "-b:a", "192k",
    "-shortest",
    outputPath
  ];
  const ff = spawn("ffmpeg", args, { windowsHide: true });
  let stderr = "";
  ff.stderr.on("data", (d) => { stderr += d.toString(); });

  let lastFrame = null;
  let lastChatFrame = null;
  const pageTurns = new Set(pageTurnSceneIndices);
  const rizzScenes = new Set([...rizzSceneIndices, ...plugSceneIndices]);
  for (let idx = 0; idx < scenesData.length; idx += 1) {
    const sceneImg = scenesData[idx];
    const numFrames = frameCounts[idx];
    let doReveal = false;
    let prevFrame = null;
    let newStartRow = null;
    let newEndRow = null;
    let revealFrames = 0;

    // WITH:
    if (sceneImg) {
      if (lastFrame) {
        const diff = findDiffRows(sceneImg, lastFrame);
        if (diff) {
          if (!pageTurns.has(idx) && !rizzScenes.has(idx)) {
            prevFrame = lastFrame;
            newStartRow = Math.trunc(170 * 1.5) + diff[0];
            newEndRow = Math.trunc(170 * 1.5) + diff[1] + 1;
            revealFrames = Math.min(18, numFrames - 1);
            doReveal = revealFrames > 0 && REVEAL_ANIMATION_ENABLED;
          }
        }
      }
      // For rizz scenes: show the rizz frame but remember the last chat frame
      // so the scene after rizz can still animate correctly from it
      if (rizzScenes.has(idx)) {
        lastChatFrame = lastFrame;  // save pre-rizz chat frame
        lastFrame = sceneImg;       // show rizz image
      } else {
        lastFrame = sceneImg;
      }
      console.log(`[SCENE ${idx + 1}] Duration: ${durations[idx].toFixed(4)}s -> ${numFrames} frames`);
    } else if (!lastFrame) {
      throw new Error(`Audio-only scene at index ${idx} has no previous frame to freeze`);
    }

    // After rizz scenes end, restore lastFrame to the last chat frame so
    // the next chat bubble animates from chat, not from the green rizz frame
    if (!rizzScenes.has(idx) && lastChatFrame) {
      lastChatFrame = null; // discard — lastFrame is already chatSceneAfterRizz
    }

    let staticBuf = null;
    for (let f = 0; f < numFrames; f += 1) {
      let frame = lastFrame;
      if (doReveal && prevFrame && f < revealFrames) {
        const t = (f + 1) / revealFrames;
        const ease = 1.0 - (1.0 - t) ** 2;
        const newArea = newEndRow - newStartRow;
        const clipRow = Math.min(newEndRow, newStartRow + Math.trunc(ease * newArea));
        frame = composeReveal(lastFrame, prevFrame, clipRow, uiRound);
        await streamWrite(ff.stdin, frame.toBuffer("image/png"));
      } else {
        if (!staticBuf) staticBuf = frame.toBuffer("image/png");
        await streamWrite(ff.stdin, staticBuf);
      }
    }
  }
  ff.stdin.end();
  await new Promise((resolve, reject) => {
    ff.on("error", reject);
    ff.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg encode failed (${code}): ${stderr}`));
    });
  });
  return outputPath;
}

async function runTextingVideo(scriptPath, imageBaseDir, apiKey, sentSfx, receivedSfx) {
  const oldBase = IMAGE_BASE_DIR;
  IMAGE_BASE_DIR = imageBaseDir;
  registerLocalFont();
  TTS_CACHE_DIR = path.join(imageBaseDir, "tts_cache");
  ensureDirSync(TTS_CACHE_DIR);

  const [unreadCount, uiRound, threads] = parseFileSettingsAndThreads(scriptPath);
  if (!threads.length) throw new Error("No conversations found in input");

  const ttsTasks = collectAllTtsTasks(threads);
  await prefetchTtsParallel(ttsTasks, apiKey, 15);

  const scenesData = [];
  const wavFiles = [];
  const messageTimeline = [];
  let curT = 0;
  const pageTurnSceneIndices = [];
  const rizzSceneIndices = [];
  const plugSceneIndices = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cyno2-"));

  let tag = THEME.filename_tag;
  if (USE_GREEN_BUBBLES) tag += "_green";
  let counter = 1;
  let finalOutputFile;
  do {
    finalOutputFile = path.join(imageBaseDir, `textingAiVR_1080p_${tag}_${String(counter).padStart(3, "0")}.mp4`);
    counter += 1;
  } while (fs.existsSync(finalOutputFile));
  console.log(`Will save final video as: ${finalOutputFile}`);

  try {
    let sceneIdx = 0;
    const allRenderedMsgs = [];
    for (const thread of threads) {
      const contact = thread.contact;
      const avatarFile = thread.avatar;
      const msgs = thread.messages;
      if (!msgs.length) continue;

      let start = 0;
      while (start < msgs.length) {
        const pageSize = await getDynamicPageSize(msgs, start);
        const windowMsgs = msgs.slice(start, start + pageSize);
        const showPoster = start === 0 || POSTER_EVERY_PAGE;
        const poster = showPoster
          ? await createImessageContactHeader(contact, unreadCount, avatarFile)
          : null;
        const [fullBubbles, fullWs, fullHs, fullSnd, fullIsImg] = await makeBubbleClips(windowMsgs);
        let pageFirstSceneMarked = false;
        const skipMsgIndices = new Set();

        for (let i = 1; i <= windowMsgs.length; i += 1) {
          if (skipMsgIndices.has(i - 1)) continue;
          const bclips = fullBubbles.slice(0, i);
          const ws = fullWs.slice(0, i);
          const hs = fullHs.slice(0, i);
          const snd = fullSnd.slice(0, i);
          const isImgFlags = fullIsImg.slice(0, i);

          const last = windowMsgs[i - 1];
          const lastIsImage = isImgFlags[isImgFlags.length - 1];
          const lastSender = snd[snd.length - 1];
          const sfxName = last.sfx;
          const isAudioOnly = last.audio_only || false;
          const ttsText = last.tts_text || stripBlurMarkers(last.text || "");

          if (last.is_break) {
            const brkDur = last.duration_s;
            const wavBrk = path.join(tmp, `scene_${String(sceneIdx).padStart(4, "0")}_break.wav`);
            await generateSilentWav(brkDur, wavBrk);
            const actualDur = await getAudioDuration(wavBrk);
            scenesData.push(null);
            wavFiles.push(wavBrk);
            messageTimeline.push({
              text: `<break:${brkDur}s>`,
              start: curT,
              end: curT + actualDur,
              sfx: null,
              audio_only: true,
              is_break: true
            });
            curT += actualDur;
            sceneIdx += 1;
            continue;
          }

          if (last.is_plug) {
            const [plugFrame, wavSay, wavReply] = await generatePlugScene(
              last, allRenderedMsgs, apiKey, tmp, sceneIdx, imageBaseDir
            );
            if (wavSay) {
              const dur = await getAudioDuration(wavSay);
              plugSceneIndices.push(sceneIdx);
              scenesData.push(plugFrame);
              wavFiles.push(wavSay);
              messageTimeline.push({ text: last.plugsay_text, start: curT, end: curT + dur, sfx: null, audio_only: false });
              curT += dur;
              sceneIdx += 1;
            }
            if (wavReply) {
              const dur = await getAudioDuration(wavReply);
              plugSceneIndices.push(sceneIdx);
              scenesData.push(null);
              wavFiles.push(wavReply);
              messageTimeline.push({ text: last.text, start: curT, end: curT + dur, sfx: null, audio_only: false });
              curT += dur;
              sceneIdx += 1;
            }
            // Render the iMessage chat UI with the plug bubble already in it
            allRenderedMsgs.push(last);
            const chatSceneAfterPlug = await createSceneImage(bclips, ws, hs, snd, poster, showPoster, Math.trunc(8 * 1.5), Math.trunc(170 * 1.5), uiRound);
            const plugFollowUp = (i < windowMsgs.length && windowMsgs[i].sfx === "plug") ? windowMsgs[i] : null;
            const snapWavPlug = path.join(tmp, `scene_${String(sceneIdx).padStart(4, "0")}_plugsnap.wav`);
            if (plugFollowUp) {
              const plugSfxFile = resolveSfxPath(plugFollowUp.sfx, imageBaseDir);
              if (plugSfxFile) {
                await convertToWav(plugSfxFile, snapWavPlug);
              } else {
                await generateSilentWav(0.4, snapWavPlug);
              }
            } else {
              await generateSilentWav(0.4, snapWavPlug);
            }
            const snapPlugDur = await getAudioDuration(snapWavPlug);
            plugSceneIndices.push(sceneIdx);
            scenesData.push(chatSceneAfterPlug);
            wavFiles.push(snapWavPlug);
            messageTimeline.push({ text: last.text, start: curT, end: curT + snapPlugDur, sfx: null, audio_only: false });
            curT += snapPlugDur;
            sceneIdx += 1;
            if (plugFollowUp) skipMsgIndices.add(i);
            continue;
          }

          if (last.is_rizz) {
            const [framePartial, frameFull, wavSay, wavReply] = await generateRizzScene(
              last, allRenderedMsgs, apiKey, tmp, sceneIdx, imageBaseDir
            );
            if (wavSay) {
              const dur = await getAudioDuration(wavSay);
              rizzSceneIndices.push(sceneIdx);
              scenesData.push(framePartial);
              wavFiles.push(wavSay);
              messageTimeline.push({ text: last.rizzsay_text, start: curT, end: curT + dur, sfx: null, audio_only: false });
              curT += dur;
              sceneIdx += 1;
            }
            if (wavReply) {
              const dur = await getAudioDuration(wavReply);
              rizzSceneIndices.push(sceneIdx);
              scenesData.push(frameFull);
              wavFiles.push(wavReply);
              messageTimeline.push({ text: last.text, start: curT, end: curT + dur, sfx: null, audio_only: false });
              curT += dur;
              sceneIdx += 1;
            }
            // Render the iMessage chat UI with the rizz bubble already in it
            allRenderedMsgs.push(last);
            const chatSceneAfterRizz = await createSceneImage(bclips, ws, hs, snd, poster, showPoster, Math.trunc(8 * 1.5), Math.trunc(170 * 1.5), uiRound);
            const rizzFollowUp = (i < windowMsgs.length && windowMsgs[i].sfx === "rizz") ? windowMsgs[i] : null;
            const snapWav = path.join(tmp, `scene_${String(sceneIdx).padStart(4, "0")}_rizzsnap.wav`);
            if (rizzFollowUp) {
              const rizzSfxFile = resolveSfxPath(rizzFollowUp.sfx, imageBaseDir);
              if (rizzSfxFile) {
                await convertToWav(rizzSfxFile, snapWav);
              } else {
                await generateSilentWav(0.4, snapWav);
              }
            } else {
              await generateSilentWav(0.4, snapWav);
            }
            const snapDur = await getAudioDuration(snapWav);
            rizzSceneIndices.push(sceneIdx);
            scenesData.push(chatSceneAfterRizz);
            wavFiles.push(snapWav);
            messageTimeline.push({ text: last.text, start: curT, end: curT + snapDur, sfx: null, audio_only: false });
            curT += snapDur;
            sceneIdx += 1;
            if (rizzFollowUp) skipMsgIndices.add(i); // i is 1-based, follow-up is windowMsgs[i] = index i
            continue;
          }

          const isDotsOnly = /^[.\s\u2026]+$/.test(last.text);
          const textPlainForEmoji = stripBlurMarkers(last.text);
          const isEmojiOnlyMsg = isEmojiOnlyMessage(textPlainForEmoji);
          let ttsMp3;
          if (lastIsImage || isDotsOnly || isEmojiOnlyMsg) {
            ttsMp3 = lastSender === "me" ? sentSfx : receivedSfx;
          } else {
            const ttsTextForTts = stripEmojisForTts(ttsText).trim();
            if (!ttsTextForTts) {
              ttsMp3 = lastSender === "me" ? sentSfx : receivedSfx;
            } else {
              const spk = last.speaker;
              ttsMp3 = path.join(tmp, `${contact}_${start}_${i}_tts.mp3`);
              let ok = false;
              for (let attempt = 1; attempt <= 3; attempt += 1) {
                const cachePath = ttsCachePath(ttsTextForTts, isMinimaxSpeaker(spk) ? `mmx_${spk}` : spk);
                if (attempt > 1 && fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
                if (attempt > 1 && fs.existsSync(ttsMp3)) fs.unlinkSync(ttsMp3);
                await genTtsAudio(apiKey, ttsTextForTts, ttsMp3, spk);
                if (await validateMp3(ttsMp3)) {
                  ok = true;
                  break;
                }
              }
              if (!ok) throw new Error(`TTS failed after retries for speaker='${spk}' text='${ttsTextForTts.slice(0, 60)}'`);
            }
          }

          let finalMp3 = ttsMp3;
          let sfxActuallyAdded = false;
          if (sfxName) {
            const sfxFile = resolveSfxPath(sfxName, imageBaseDir);
            if (sfxFile) {
              const combined = path.join(tmp, `${contact}_${start}_${i}_combined.mp3`);
              finalMp3 = await concatMp3WithSfx(ttsMp3, sfxFile, combined);
              if (finalMp3 === combined) sfxActuallyAdded = true;
            }
          }

          const wavFile = path.join(tmp, `scene_${String(sceneIdx).padStart(4, "0")}.wav`);
          if (fs.existsSync(finalMp3)) {
            await convertToWav(finalMp3, wavFile);
            await trimSilenceFromWav(wavFile);
          } else {
            console.log(`[WARN] SFX file not found: ${finalMp3}, using silent fallback`);
            await generateSilentWav(0.3, wavFile);
          }
          const duration = await getAudioDuration(wavFile);
          wavFiles.push(wavFile);

          if (isAudioOnly) {
            scenesData.push(null);
          } else {
            const sceneImg = await createSceneImage(bclips, ws, hs, snd, poster, showPoster, Math.trunc(8 * 1.5), Math.trunc(170 * 1.5), uiRound);
            scenesData.push(sceneImg);
            if (!pageFirstSceneMarked) {
              pageTurnSceneIndices.push(sceneIdx);
              pageFirstSceneMarked = true;
            }
          }
          allRenderedMsgs.push(last);
          messageTimeline.push({ text: last.text, start: curT, end: curT + duration, sfx: sfxName, audio_only: isAudioOnly });
          curT += duration;
          sceneIdx += 1;
          console.log(`[SCENE ${sceneIdx}] WAV: ${path.basename(wavFile)}, Duration: ${duration.toFixed(4)}s${sfxActuallyAdded ? ` + SFX[${sfxName}]` : sfxName ? ` (SFX[${sfxName}] NOT FOUND)` : ""}`);
        }
        start += pageSize;
      }
    }

    console.log(`[INFO] Total scenes: ${scenesData.length} | WAVs: ${wavFiles.length} | Duration: ${curT.toFixed(4)}s`);
    const finalAudio = path.join(tmp, "final_audio.wav");
    await concatWavFiles(wavFiles, finalAudio);
    await writeVideoWithFfmpeg(scenesData, wavFiles, 60, finalOutputFile, finalAudio, uiRound, pageTurnSceneIndices, rizzSceneIndices, plugSceneIndices);
  } finally {
    IMAGE_BASE_DIR = oldBase;
    await closeTextRasterBrowser();
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log(`${tag.toUpperCase()} final video: ${finalOutputFile}`);
  return [finalOutputFile, messageTimeline];
}

async function askChoice(rl, title, choices) {
  console.log(`\n${title}`);
  for (const [key, label] of choices) console.log(`  ${key} - ${label}`);
  while (true) {
    const answer = (await rl.question(`Enter your choice (${choices.map(([k]) => k).join(" or ")}): `)).trim();
    const found = choices.find(([k]) => k === answer);
    if (found) return answer;
    console.log("Please enter one of the listed choices.");
  }
}

async function askStartupOptions() {
  const rl = createInterface({ input, output });
  try {
    const theme = await askChoice(rl, "iMessage Video Theme Selector", [["1", "Dark"], ["2", "Light"]]);
    THEME = theme === "1" ? THEMES.dark : THEMES.light;

    const bubbles = await askChoice(rl, "Sender Bubble Color", [["1", "Blue (standard iMessage)"], ["2", "Green (SMS / Android style)"]]);
    USE_GREEN_BUBBLES = bubbles === "2";
    if (USE_GREEN_BUBBLES) BG_COLOR = [177, 0, 255];

    const poster = await askChoice(rl, "Contact Poster Display Mode", [["1", "First page only"], ["2", "Every page"]]);
    POSTER_EVERY_PAGE = poster === "2";

    const anim = await askChoice(rl, "Bubble Slide-In Animation", [["1", "Animation ON"], ["2", "Animation OFF"]]);
    REVEAL_ANIMATION_ENABLED = anim === "1";

    const provider = await askChoice(rl, "TTS Provider Selection", [
      ["1", "AI33Pro (ElevenLabs proxy, task queue)"],
      ["2", "ElevenLabs (direct API, streaming)"]
    ]);
    TTS_PROVIDER = { 1: "ai33pro", 2: "elevenlabs" }[provider];

    if (TTS_PROVIDER === "elevenlabs") {
      const entered = await rl.question("Enter your ElevenLabs API key (sk-...): ");
      ELEVENLABS_API_KEY = entered.trim() || ELEVENLABS_API_KEY;
    }
  } finally {
    rl.close();
  }
}


async function main() {
  await askStartupOptions();
  const args = process.argv.slice(2);
  let scriptFile;
  let baseImageDir;
  let apiKey;
  if (args.length >= 3) {
    [scriptFile, baseImageDir, apiKey] = args;
    SENT_SFX = args[3] || "sent.mp3";
    RECEIVED_SFX = args[4] || "received.mp3";
  } else {
    scriptFile = "ctest.txt";
    baseImageDir = ".";
    apiKey = process.env.AI33PRO_API_KEY || process.env.ELEVENLABS_API_KEY || "";
    SENT_SFX = "sent.mp3";
    RECEIVED_SFX = "received.mp3";
  }

  if (!path.isAbsolute(scriptFile)) scriptFile = path.resolve(baseImageDir, scriptFile);
  if (!path.isAbsolute(baseImageDir)) baseImageDir = path.resolve(baseImageDir);
  if (!path.isAbsolute(SENT_SFX)) SENT_SFX = path.resolve(baseImageDir, SENT_SFX);
  if (!path.isAbsolute(RECEIVED_SFX)) RECEIVED_SFX = path.resolve(baseImageDir, RECEIVED_SFX);

  if (!apiKey && TTS_PROVIDER === "ai33pro") {
    const rl = createInterface({ input, output });
    try {
      apiKey = (await rl.question("Enter your AI33Pro / ElevenLabs proxy API key: ")).trim();
    } finally {
      rl.close();
    }
  }

  const [outputVideo] = await runTextingVideo(scriptFile, baseImageDir, apiKey, SENT_SFX, RECEIVED_SFX);
  console.log(`Output video: ${outputVideo}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

export function setSettings({ theme, greenBubbles, revealAnim, posterEvery, fontSize, cornerRadius, bottomReserveRatio } = {}) {
  if (theme === "light") THEME = THEMES.light;
  else if (theme === "dark") THEME = THEMES.dark;
  if (greenBubbles !== undefined) USE_GREEN_BUBBLES = greenBubbles;
  if (revealAnim !== undefined) REVEAL_ANIMATION_ENABLED = revealAnim;
  if (posterEvery !== undefined) POSTER_EVERY_PAGE = posterEvery;
  if (fontSize && fontSize > 0) BUBBLE_FONT_SIZE = Math.trunc(fontSize); // slider value is already in canvas units
  if (cornerRadius && cornerRadius > 0) CORNER_RADIUS = Math.trunc(cornerRadius * 1.5);
  if (bottomReserveRatio != null && bottomReserveRatio >= 0) BOTTOM_RESERVE_RATIO = parseFloat(bottomReserveRatio);
}

export function setTtsProvider(provider) {
  TTS_PROVIDER = provider;
}

export {
  runTextingVideo,
  parseFileSettingsAndThreads,
  bubbleImg,
  emojiOnlyImg,
  imageMessageClip,
  createImessageContactHeader,
  createSceneImage
};