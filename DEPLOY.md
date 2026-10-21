# Deploying terrain

Cloudflare account 42a4a8d7bfb96321118ada213638d050, zone bucklerfamily.estate (5307ac7d55a77d914b81d79c79532dde).

- Worker: `terrain` (modules: index.js, scene-ops.js, initial-scene.json, index.html, app.js.txt, style.css.txt; the last four are text modules).
- Bindings: `BUCKET` → R2 bucket `terrain-scene`; `AI` → Workers AI; secrets `PASS_HASHES` and `SESSION_KEY` (set once; later versions use `inherit` bindings so they carry over).
- Route `terrain.bucklerfamily.estate/*` → `terrain`, with a proxied AAAA `terrain` → `100::` record.
- Upload: `POST /accounts/{account}/workers/workers/{worker_id}/versions` with the modules base64-encoded, then `POST /accounts/{account}/workers/scripts/terrain/deployments` at 100%.

## Changing the passphrase

`PASS_HASHES` is `salt_hex:hmac_hex` pairs joined by `;`, one per accepted spelling. For each spelling: lowercase it, keep letters only, pick 16 random bytes as the salt, and take HMAC-SHA256(key = salt, message = spelling). Upload a version with a `secret_text` binding named `PASS_HASHES`. Never commit the passphrase or the hash.

## Storage layout (R2 `terrain-scene`)

- `state.json`: `{scene, undo[], redo[]}` (30 undo steps)
- `versions/<slug>.json`: `{label, at, scene}`
- `rl/<kind>/<ip>.json`: attempt timestamps for rate limits
- `log/<date>.json`: edit log (tool, arguments, result)
