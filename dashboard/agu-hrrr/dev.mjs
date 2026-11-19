import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeHandler } from "./server/chat.mjs";

const site = fileURLToPath(new URL("./site/", import.meta.url));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".md": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".txt": "text/plain",
};
export function createStudyServer(handle = makeHandler()) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://" + req.headers.host);
      if (url.pathname === "/api/research-chat") {
        const init = { method: req.method, headers: req.headers };
        if (req.method !== "GET" && req.method !== "HEAD") {
          init.body = req;
          init.duplex = "half";
        }
        const response = await handle(new Request(url, init));
        res.writeHead(response.status, Object.fromEntries(response.headers));
        return res.end(Buffer.from(await response.arrayBuffer()));
      }
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405, { Allow: "GET, HEAD" });
        return res.end();
      }
      let route = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      if (route === "study") {
        res.writeHead(307, {
          Location: "https://github.com/Mitchel34/hydra-nwm-streamflow-correction/tree/agu-hrrr-2026",
        });
        return res.end();
      }
      if (!route) route = "index.html";
      else if (!extname(route)) route += ".html";
      const file = resolve(site, route);
      if (!file.startsWith(resolve(site) + sep) || !(await stat(file)).isFile()) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, {
        "Content-Type": mime[extname(file)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      if (req.method === "HEAD") return res.end();
      createReadStream(file)
        .on("error", () => res.destroy())
        .pipe(res);
    } catch {
      if (!res.headersSent) res.writeHead(404);
      res.end();
    }
  });
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const port = Number(process.env.PORT || 8000);
  createStudyServer().listen(port, "127.0.0.1", () =>
    console.log("HYDRA study at http://127.0.0.1:" + port + "/"),
  );
}
