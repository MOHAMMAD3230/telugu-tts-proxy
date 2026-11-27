# Security Policy

## Reporting a vulnerability

Open a private security advisory on this repository (Security → Advisories → Report a
vulnerability). Please do not open a public issue for security problems.

## Threat model

This is a **client-side** application. There is no backend that receives documents.

| Concern | Mitigation |
| --- | --- |
| Document leakage | The PDF is parsed in the browser with pdf.js. The file is never uploaded. Only plain text leaves the device, and only to Google Translate / the TTS Worker. |
| Malvertising / injected scripts | CSP allowlists every resource type. No ad networks, no analytics, no third-party JS beyond pinned pdf.js and jsPDF. |
| Supply-chain tampering | CDN scripts are version-pinned. CSP restricts `script-src` to `cdn.jsdelivr.net`. |
| Clickjacking | `X-Frame-Options: DENY` + `frame-ancestors 'none'` in `_headers`. |
| MIME confusion | `X-Content-Type-Options: nosniff`. |
| Malicious file upload | 50 MB cap, extension + MIME check, `%PDF-` magic-byte verification before parsing. |
| Path traversal via filename | Filenames are sanitized: separators, control characters and leading dots are stripped before any download. |
| Resource exhaustion | 200 MB blob budget, 1500 audio-chunk cap, 40 MB MP3 cap, rate limits on convert / generate / download. |
| Corrupt downloads | `%PDF-` header and MP3 frame-sync are verified before the download is triggered. |
| TTS proxy abuse | The Worker validates text length (≤200 chars), an allowlist of language codes, and caches responses at the edge. |

## Known limitations

- `frame-ancestors` and `X-Content-Type-Options` **cannot** be set from `<meta>`; they
  require the `_headers` file (Cloudflare Pages) or equivalent server configuration.
- The TTS Worker proxies Google Translate TTS. It is rate-limited by Google, not by us.
- Machine translation is not a substitute for human review of legal or medical text.
