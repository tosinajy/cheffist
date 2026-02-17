const { saveSubmission } = require("../lib/subscribeService");

function parseBody(req) {
  if (req && typeof req.body === "object" && req.body !== null) {
    return req.body;
  }
  if (typeof req.body === "string" && req.body.trim()) {
    const maybeJson = req.body.trim();
    if (maybeJson.startsWith("{")) {
      return JSON.parse(maybeJson);
    }
    const params = new URLSearchParams(maybeJson);
    return Object.fromEntries(params.entries());
  }
  return {};
}

module.exports = async function handler(req, res) {
  if (!req || !res) {
    throw new Error("Expected request and response objects.");
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end('{"ok":false,"error":"Method not allowed."}\n');
    return;
  }

  try {
    const payload = parseBody(req);
    const saved = saveSubmission(payload);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(`${JSON.stringify({ ok: true, id: saved.id })}\n`);
  } catch (error) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(`${JSON.stringify({ ok: false, error: error.message })}\n`);
  }
};
