/**
 * Vercel serverless: must live under frontend/ when "Root Directory" = frontend.
 * Otherwise POST /api/v2 rewrites to index.html → 405 Method Not Allowed.
 */
const { parse } = require("url");

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,DELETE,PATCH,OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-API-Key, X-Api-Key, API-Key, Accept",
  "Access-Control-Max-Age": "86400",
};

module.exports = async (req, res) => {
  for (const [k, v] of Object.entries(CORS)) {
    res.setHeader(k, v);
  }

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const base = (process.env.BACKEND_URL || process.env.SMM_API_ORIGIN || "")
    .trim()
    .replace(/\/$/, "");

  if (!base) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.statusCode = 503;
    return res.end(
      JSON.stringify({
        error:
          "Vercel proxy: set BACKEND_URL to your YTBoost Python server origin, e.g. https://api.ytboost.io (Uvicorn must expose /api/v2 or set BACKEND_V2_PATH).",
      })
    );
  }

  const pathPrefix = (process.env.BACKEND_V2_PATH || "/api/v2").replace(/\/$/, "");
  const parsed = parse(req.url || "", true);
  const search = parsed.search || "";
  const target = `${base}${pathPrefix.startsWith("/") ? "" : "/"}${pathPrefix}${search}`;

  let bodyBuf;
  if (req.method && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    try {
      bodyBuf = await getRawBody(req);
    } catch {
      bodyBuf = Buffer.alloc(0);
    }
  }

  const forwardHeaders = {
    Accept: "application/json, */*",
    "User-Agent": "ytboost-vercel-proxy/1.0",
  };
  if (req.headers["content-type"]) {
    forwardHeaders["Content-Type"] = req.headers["content-type"];
  } else if (req.method && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    forwardHeaders["Content-Type"] = "application/x-www-form-urlencoded";
  }
  if (req.headers["authorization"])
    forwardHeaders["Authorization"] = req.headers["authorization"];
  for (const h of ["x-api-key", "X-API-Key", "api-key"]) {
    if (req.headers[h]) {
      forwardHeaders["X-API-Key"] = req.headers[h];
      break;
    }
  }

  const init = {
    method: req.method || "GET",
    headers: forwardHeaders,
    redirect: "follow",
  };
  if (bodyBuf && bodyBuf.length) {
    init.body = bodyBuf;
  }

  let upstream;
  try {
    upstream = await fetch(target, init);
  } catch (e) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.statusCode = 502;
    return res.end(
      JSON.stringify({
        error: "Upstream request failed",
        detail: String(e && e.message ? e.message : e),
      })
    );
  }

  const text = await upstream.text();
  const ct = upstream.headers.get("content-type") || "application/json; charset=utf-8";
  res.setHeader("Content-Type", ct);
  res.statusCode = upstream.status;
  return res.end(text);
};
