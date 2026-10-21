# Terrain · Cedwyn Estate in 3D

https://terrain.bucklerfamily.estate/

The Cedwyn Estate 3D walk (https://bucklerfamily.estate/3d/) as a live, editable landscape. Every Great House Farm site is a building on the stone path; Tŷ Mawr farmhouse, the barn, the fields, the pond and St Dochdwy's church and churchyard lie to the south. Visitors orbit, zoom, walk and tap a building to open its site. The owner unlocks admin control on a voice call with a spoken passphrase and then edits the scene by talking.

## How it works

- One Cloudflare Worker (`worker/index.js`) serves the page, the scene API and the voice agent.
- The scene is a JSON scene graph (`worker/initial-scene.json`): named objects (buildings, trees, fences, walls, paths, water, fields, labels, markers, rocks, lamps, benches) plus time of day, weather and camera. `worker/scene-ops.js` holds every edit as a pure function, tested in `test/`.
- The live scene, undo/redo history and saved versions are stored in R2 (`terrain-scene` bucket), so every visitor sees the latest scene; open pages refresh every 5 seconds.
- The browser renders it with three.js (`worker/app.js.txt`).

## The call

1. Tap **Start call**. The agent speaks first and asks for the passphrase.
2. The passphrase is checked on the server only: a salted HMAC-SHA256 held as a Worker secret (`PASS_HASHES`), compared in constant time. Neither the passphrase nor its hash is in this repository or in the page. Five wrong tries in ten minutes from one address locks attempts for ten minutes.
3. The right passphrase sets a signed, HttpOnly, SameSite=Strict session cookie (4 hours, key in the `SESSION_KEY` secret). Every edit goes through `/api/agent` or `/api/tool`, which check it.
4. Voice in: the browser's speech recognition (Chrome, Edge, Safari, iOS), or, where that is missing, voice-activity detection with server transcription. Voice out: a male British voice generated on the server. Speaking over the agent cuts it off. A text box carries the same channel.
5. The agent turns speech into tool calls with an LLM on Workers AI; short commands (undo, redo, save, restore, reset) skip the LLM.

## Voice commands

- Add: “put an oak tree by the farmhouse”, “add three pine trees north of the barn”, “build a cottage by the pond”, “put a fence around the pond”, “add a path from the farmhouse to the church”, “put a sign by the barn saying Tŷ Mawr”, “put a red flag by the church”.
- Change: “make the farmhouse stone grey”, “make the barn roof slate”, “make it brick”, “move the barn ten metres east”, “move the church next to the pond”, “turn the barn 45 degrees”, “make the church twice as big”, “rename the barn the cowshed”, “delete the old oak”.
- World: “make it night”, “dawn”, “make it rain”, “fog”, “snow”, “clear skies”.
- Camera: “move the camera to the churchyard”, “show me the farmhouse from above”, “show me the whole estate”.
- History: “undo”, “undo the last three”, “redo”, “save as version one”, “restore version one”, “what versions are there”, “reset the scene”.
- “It”, “this” or “that” means the object last changed or the one tapped.

## Public data

- `/agent/scene.json`, `/agent/versions.json`, `/agent/search.json?q=`: read-only JSON.
- `/llms.txt`, `/robots.txt`, `/sitemap.xml`, `/.well-known/mcp.json`, `/agent/tools.json` (read-only WebMCP tools, registered by ghf-webmcp.js). Admin tools are never exposed to WebMCP.

## Deploy

See `DEPLOY.md`. Tests: `npm test` (Node 20+).

## Rights and licence

© Williams–Buckler family. All rights reserved. Licence terms apply.

The content and original code in this repository are not open source. You may read it, link to it and quote it fairly with credit. Any other copying, adaptation or commercial use needs a written licence first. Full terms: https://bucklerfamily.estate/licence/ · Apply: https://bucklerfamily.estate/enquire/ · See `LICENSE` and `NOTICE`. Third-party components (three.js, MIT) keep their own licences.
