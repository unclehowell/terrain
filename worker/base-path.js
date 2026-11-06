// base-path.js — serve this Worker at https://bucklerfamily.estate/terrain/ as well as on its own host.
// Owner rule 6 Nov 2026: every webapp lives at a path of bucklerfamily.estate, never a subdomain, and is deployed from
// its own repository. The app in index.js is unchanged: a request under /terrain/ reaches it with the prefix removed
// and the host it expects; root-absolute paths in the text it returns are moved under /terrain/, the session cookie is
// scoped to /terrain/, and a POST is only accepted from the apex origin. Requests on any other host pass straight through.
// — Sion's Tab agent
export const APEX_HOST = "bucklerfamily.estate", APP_BASE = "/terrain";
const ROOTS = ["/api/", "/agent/", "/app.js", "/style.css", "/voice-worker.js", "/favicon.svg", "/favicon.ico", "/.well-known/", "/robots.txt", "/sitemap.xml", "/llms.txt"];
const QUOTES = ['"', "'", "`", "("];
const TEXTY = /^(text\/html|text\/css|text\/javascript|application\/javascript)/i;
const META = new Set(["/robots.txt", "/sitemap.xml", "/llms.txt", "/agent/tools.json", "/.well-known/mcp.json"]);
export function rebaseText(s, host, base = APP_BASE) {
  for (const q of QUOTES) for (const r of ROOTS) s = s.split(q + r).join(q + base + r);
  return host ? s.split("https://" + host + "/").join("https://" + APEX_HOST + base + "/") : s;
}
async function rebaseResponse(res, path, host) {
  const h = new Headers(res.headers);
  const loc = h.get("location");
  if (loc) h.set("location", loc.startsWith("/") && !loc.startsWith("//") ? APP_BASE + loc : rebaseText(loc, host));
  const sc = h.get("set-cookie");
  if (sc) h.set("set-cookie", sc.replace(/Path=\/(?=;|$)/i, "Path=" + APP_BASE + "/"));
  const ct = h.get("content-type") || "";
  if (res.body && (TEXTY.test(ct) || META.has(path))) {
    const t = rebaseText(await res.text(), host); h.delete("content-length"); h.delete("etag");
    return new Response(t, { status: res.status, statusText: res.statusText, headers: h });
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
const plain = (msg, status) => new Response(msg, { status, headers: { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" } });
export function withBasePath(app, host) {
  return {
    async fetch(req, env, ctx) {
      const u = new URL(req.url);
      if (u.hostname !== APEX_HOST) return app.fetch(req, env, ctx);
      if (u.pathname === APP_BASE) return Response.redirect("https://" + APEX_HOST + APP_BASE + "/" + u.search, 301);
      if (!u.pathname.startsWith(APP_BASE + "/")) return plain("Not found", 404);
      const o = req.headers.get("origin");
      if (req.method === "POST" && o) { let oh = ""; try { oh = new URL(o).host; } catch {} if (oh !== APEX_HOST) return new Response(JSON.stringify({ error: "bad origin" }), { status: 403, headers: { "content-type": "application/json; charset=utf-8" } }); }
      const inner = new URL(req.url); inner.hostname = host; inner.pathname = u.pathname.slice(APP_BASE.length) || "/";
      const h = new Headers(req.headers); if (o) h.set("origin", "https://" + host);
      const init = { method: req.method, headers: h, redirect: "manual" };
      if (req.method !== "GET" && req.method !== "HEAD") { init.body = req.body; init.duplex = "half"; }
      const res = await app.fetch(new Request(inner.toString(), init), env, ctx);
      return rebaseResponse(res, inner.pathname, host);
    },
  };
}
