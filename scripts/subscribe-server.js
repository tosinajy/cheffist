const http = require("node:http");
const { URL } = require("node:url");
const { saveSubmission } = require("../lib/subscribeService");

const PORT = Number(process.env.SUBSCRIBE_PORT || 8787);

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(payload)}\n`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString("utf8");
      if (body.length > 1_000_000) {
        reject(new Error("Payload too large."));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function parseFormBody(rawBody, contentType) {
  if (!rawBody) return {};
  if (String(contentType || "").includes("application/json")) {
    return JSON.parse(rawBody);
  }
  const params = new URLSearchParams(rawBody);
  return Object.fromEntries(params.entries());
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", "http://localhost");

  if (req.method === "POST" && requestUrl.pathname === "/subscribe") {
    try {
      const rawBody = await readBody(req);
      const payload = parseFormBody(rawBody, req.headers["content-type"]);
      const result = saveSubmission(payload);
      sendJson(res, 200, { ok: true, id: result.id });
      return;
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
      return;
    }
  }

  if (req.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(res, 200, { ok: true, service: "subscribe-server" });
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found." });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Subscribe endpoint listening on http://localhost:${PORT}/subscribe`);
});
