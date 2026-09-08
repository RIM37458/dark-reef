import { createServer } from "node:http";

const HEADERS = Object.freeze({
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
});

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, HEADERS);
  response.end(JSON.stringify(payload));
}

export function createStatusServer({ getStatus }) {
  if (typeof getStatus !== "function") {
    throw new Error("getStatus must be a function");
  }

  const server = createServer((request, response) => {
    if (request.method !== "GET") {
      writeJson(response, 405, { error: "method_not_allowed" });
      return;
    }
    if (request.url === "/health") {
      writeJson(response, 200, { ok: true });
      return;
    }
    if (request.url === "/status") {
      writeJson(response, 200, getStatus());
      return;
    }
    writeJson(response, 404, { error: "not_found" });
  });

  return Object.freeze({
    listen({ host, port }) {
      return new Promise((resolve, reject) => {
        const onError = (error) => {
          server.off("listening", onListening);
          reject(error);
        };
        const onListening = () => {
          server.off("error", onError);
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, host);
      });
    },
    close() {
      if (!server.listening) return Promise.resolve();
      return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
    address: () => server.address(),
  });
}
