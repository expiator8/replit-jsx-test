import express from "express";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_DATA } from "./defaultData.js";
import { db, usingReplitDb } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const STATE_KEY = "retreat-plan-v4";

const app = express();
const httpServer = createServer(app);

const state = {
  data: DEFAULT_DATA,
  version: 0,
};

const raw = await db.get(STATE_KEY);
if (raw) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    state.data = {
      ...DEFAULT_DATA,
      ...parsed,
      places: { ...DEFAULT_DATA.places, ...(parsed.places || {}) },
    };
  } catch (e) {
    console.error("state parse failed, starting fresh", e);
  }
}

let persistTimer = null;
const persistState = () => {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    db.set(STATE_KEY, JSON.stringify(state.data)).catch((e) =>
      console.error("persist failed", e)
    );
  }, 500);
};

const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
const clients = new Set();

const broadcast = (payload, except) => {
  const msg = JSON.stringify(payload);
  for (const c of clients) {
    if (c === except) continue;
    if (c.readyState === 1) {
      try { c.send(msg); } catch {}
    }
  }
};

wss.on("connection", (ws) => {
  clients.add(ws);
  try {
    ws.send(JSON.stringify({ type: "sync", data: state.data, version: state.version }));
  } catch {}

  ws.on("message", (buf) => {
    let msg;
    try { msg = JSON.parse(buf.toString()); } catch { return; }

    if (msg.type === "update" && msg.data && typeof msg.data === "object") {
      state.data = msg.data;
      state.version += 1;
      persistState();
      broadcast(
        { type: "sync", data: state.data, version: state.version },
        ws
      );
    }
  });

  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => clients.delete(ws));
});

app.get("/healthz", (_req, res) => res.json({ ok: true, version: state.version }));

app.use(express.static(DIST));

app.get("*", (_req, res) => {
  res.sendFile(path.join(DIST, "index.html"));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[retreat] listening on :${PORT}  db=${usingReplitDb ? "replit" : "memory"}`);
});
