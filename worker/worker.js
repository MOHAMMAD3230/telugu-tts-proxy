/**
 * Telugu TTS proxy for Cloudflare Workers
 *
 *   GET /tts?q=<text>&tl=te&idx=0&total=1
 *
 * Returns audio/mpeg with permissive CORS headers so a browser can read the
 * bytes and assemble a downloadable MP3. Responses are cached at the edge for
 * 7 days, so repeated chunks cost nothing.
 */

const TTS_HOST = "https://translate.googleapis.com/translate_tts";
const MAX_TEXT = 200;

const ALLOWED_LANGS = new Set([
  "te", "hi", "ta", "kn", "ml", "bn", "mr", "gu", "pa", "or", "ur", "en",
]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === "/tts") return handleTts(request, url, ctx);
    if (url.pathname === "/health") return json({ ok: true });

    return json(
      {
        ok: true,
        usage: "GET /tts?q=<text>&tl=te&idx=0&total=1",
        note: "q must be 200 characters or fewer.",
      },
      200,
    );
  },
};

async function handleTts(request, url, ctx) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "Use GET." }, 405);
  }

  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return json({ error: "Missing ?q= text." }, 400);
  if (q.length > MAX_TEXT) {
    return json({ error: "Text too long (max " + MAX_TEXT + " characters)." }, 400);
  }

  const tl = (url.searchParams.get("tl") || "te").toLowerCase();
  if (!ALLOWED_LANGS.has(tl)) {
    return json({ error: "Unsupported language: " + tl }, 400);
  }

  const idx = clampInt(url.searchParams.get("idx"), 0, 0, 9999);
  const total = clampInt(url.searchParams.get("total"), 1, 1, 9999);

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const target = new URL(TTS_HOST);
  target.searchParams.set("ie", "UTF-8");
  target.searchParams.set("q", q);
  target.searchParams.set("tl", tl);
  target.searchParams.set("total", String(total));
  target.searchParams.set("idx", String(idx));
  target.searchParams.set("textlen", String(q.length));
  target.searchParams.set("client", "tw-ob");

  let upstream;
  try {
    upstream = await fetch(target.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://translate.google.com/",
        Accept: "*/*",
      },
      cf: { cacheTtl: 86400, cacheEverything: true },
    });
  } catch (err) {
    console.error("Upstream fetch failed", err);
    return json({ error: "Upstream fetch failed." }, 502);
  }

  if (!upstream.ok) {
    return json({ error: "Upstream returned HTTP " + upstream.status + "." }, 502);
  }

  const contentType = (upstream.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("text/html") || contentType.includes("application/json")) {
    return json({ error: "Upstream returned a non-audio response.", contentType }, 502);
  }

  const body = await upstream.arrayBuffer();
  if (body.byteLength < 200) {
    return json({ error: "Upstream audio payload too small." }, 502);
  }

  const response = new Response(body, {
    status: 200,
    headers: {
      ...CORS,
      "Content-Type": "audio/mpeg",
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });

  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

function clampInt(value, fallback, min, max) {
  const n = parseInt(value, 10);
  if (!Number.isNaN(n)) return Math.max(min, Math.min(max, n));
  return fallback;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}
