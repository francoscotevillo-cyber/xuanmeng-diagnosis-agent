import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeWebsite } from "./lib/site-analyzer.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 3000);

const mime = {
  ".html": "text/html;charset=utf-8",
  ".js": "text/javascript;charset=utf-8",
  ".mjs": "text/javascript;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json;charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { ok: true, service: "xuanmeng-diagnosis-agent" });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/analyze") {
      const body = await readJson(request);
      const result = await analyzeWebsite(body);
      sendJson(response, 200, result);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = safeJoin(root, pathname);
    if (!filePath) {
      sendText(response, 403, "Forbidden");
      return;
    }
    const data = await readFile(filePath);
    response.writeHead(200, {
      "content-type": mime[extname(filePath)] || "application/octet-stream",
      "cache-control": "public, max-age=300",
    });
    if (request.method === "GET") response.end(data);
    else response.end();
  } catch (error) {
    const status = error?.code === "ENOENT" ? 404 : 500;
    if (request.url?.startsWith("/api/")) {
      sendJson(response, status, { error: error.message || "Server error" });
    } else {
      sendText(response, status, status === 404 ? "Not found" : "Server error");
    }
  }
}).listen(port, () => {
  console.log(`宣盟获客诊断 Agent running at http://127.0.0.1:${port}`);
});

function safeJoin(base, pathname) {
  const decoded = decodeURIComponent(pathname);
  const target = normalize(join(base, decoded));
  return target.startsWith(base) ? target : "";
}

async function readJson(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 1024 * 1024) throw new Error("请求体过大");
  }
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json;charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, status, text) {
  response.writeHead(status, { "content-type": "text/plain;charset=utf-8" });
  response.end(text);
}
