# English → Telugu PDF & MP3 Converter

Convert an English PDF into a **Telugu PDF** and a **Telugu MP3 audiobook** — entirely in the
browser, with no server storing your documents.

- **PDF → Telugu PDF** — paragraphs are reconstructed from the PDF text layer, translated, and
  rendered onto A4 pages with correct Telugu glyph shaping.
- **Telugu MP3** — translated text is converted to speech and assembled into a downloadable MP3
  through a small Cloudflare Worker that adds the CORS headers browsers require.
- **Responsive** — works on mobile, tablet and desktop.
- **Private** — the PDF never leaves the device. Only plain text is sent for translation.

## Repository layout

## Deploy the site (Cloudflare Pages, no CLI)

1. Push this repository to GitHub (public is fine).
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Pick the repository, then:
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/`
4. **Save and Deploy.** Your site is live at `https://<project>.pages.dev`.

`_headers` is picked up automatically — no extra configuration.

> Any static host works, but `_headers` is a Cloudflare Pages feature. On other hosts set the
> same headers in your server config (Netlify: `_headers`, nginx: `add_header`, Vercel:
> `vercel.json`).

## Deploy the TTS Worker

The MP3 download needs this Worker, because Google's TTS endpoint sends no CORS headers and a
browser cannot read the audio bytes directly.

1. **Workers & Pages** → **Create** → **Workers** → **Start with Hello World** → **Deploy**.
2. Name it exactly **`telugu-tts-proxy`**.
3. **Edit code** → paste `worker/worker.js` → **Deploy**.
4. Verify:
   `https://telugu-tts-proxy.<your-subdomain>.workers.dev/tts?q=నమస్కారం&tl=te&idx=0&total=1`
   should return audio.

If you use a different Worker name, update the URL in **three** places:
`index.html` (the `TTS_PROXY` constant), `index.html` (the CSP `<meta>`), and `_headers`.

## How it works

| Step | Where | What happens |
| --- | --- | --- |
| Parse | Browser (pdf.js) | Text items are grouped into lines, then paragraphs, using font size and vertical gaps. |
| Translate | Google Translate endpoint | Paragraphs are translated in parallel (2–4 workers), cached in IndexedDB. |
| Render | Browser (Canvas → jsPDF) | Telugu is drawn on a canvas at 2× resolution so glyph shaping is correct, then embedded as JPEG pages in the PDF. |
| Speak | Cloudflare Worker → Google TTS | Text is split into ≤200-character chunks, fetched in parallel, concatenated into one MP3. |

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `route #1 failed` in the log | Worker not deployed, or the URL/name doesn't match | Deploy `worker/worker.js`, check the URL in `TTS_PROXY` |
| CSP violation in console | Worker origin missing from CSP | Add it to `connect-src` and `media-src` in both `index.html` and `_headers` |
| "No selectable text found" | Scanned PDF with no text layer | Run OCR first: `ocrmypdf in.pdf out.pdf` |
| MP3 button falls back to streaming | All TTS routes blocked | Use the **Test TTS** button to diagnose |
| Telugu looks blurry in the PDF | Render scale too low | Raise `PDF_RENDER_SCALE` in `CFG` (memory cost grows quadratically) |

## Limits

- 50 MB / PDF input, 200 MB total blob budget in memory.
- 1500 audio chunks (~300,000 characters) and 40 MB per MP3.
- Free Cloudflare plan: 100,000 Worker requests/day — roughly 100 books/day.

## License

MIT — see `LICENSE`.
