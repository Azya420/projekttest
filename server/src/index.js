import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import { createClient } from "@supabase/supabase-js";
import { cleanChat, cleanName, publicPlayer, validPosition } from "./protocol.js";

const PORT = Number(process.env.PORT || 3001);
const origins = (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",").map((value) => value.trim());
const app = express();

app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: "32kb" }));
app.disable("x-powered-by");

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    world: "emberwatch",
    players: players.size,
    persistence: Boolean(supabase),
    uptime: Math.round(process.uptime())
  });
});

app.get("/api/world", (_req, res) => {
  res.json({
    name: "Emberwatch",
    online: players.size,
    time: Date.now(),
    version: "0.1.0"
  });
});

const server = app.listen(PORT, () => {
  console.log(`Ashfall world listening on :${PORT}`);
});

const wss = new WebSocketServer({ server, path: "/world", maxPayload: 16 * 1024 });
const players = new Map();
const clients = new Map();

function broadcast(message, except = null) {
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client !== except && client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

function send(client, message) {
  if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(message));
}

wss.on("connection", (socket, request) => {
  const origin = request.headers.origin;
  if (origin && origins.length && !origins.includes(origin) && !origins.includes("*")) {
    socket.close(1008, "Origin not allowed");
    return;
  }

  const connection = { playerId: null, messages: 0, windowStarted: Date.now() };
  clients.set(socket, connection);
  send(socket, { type: "snapshot", players: [...players.values()] });

  socket.on("message", (raw) => {
    const now = Date.now();
    if (now - connection.windowStarted > 1000) {
      connection.windowStarted = now;
      connection.messages = 0;
    }
    if (++connection.messages > 30) return;

    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }

    if (message.type === "join" && validPosition(message.player)) {
      const player = publicPlayer(message.player);
      connection.playerId = player.id;
      players.set(player.id, player);
      broadcast({ type: "player:update", player }, socket);
      return;
    }

    if (!connection.playerId) return;
    const current = players.get(connection.playerId);
    if (!current) return;

    if (message.type === "move" && message.player?.id === connection.playerId && validPosition(message.player)) {
      const next = publicPlayer(message.player);
      const elapsedDistance = Math.hypot(next.x - current.x, next.y - current.y);
      if (elapsedDistance < 110) {
        players.set(connection.playerId, { ...current, ...next, name: current.name });
        broadcast({ type: "player:update", player: players.get(connection.playerId) }, socket);
      }
    }

    if (message.type === "chat") {
      const text = cleanChat(message.text);
      if (text) broadcast({ type: "chat", id: current.id, name: cleanName(current.name), text });
    }
  });

  socket.on("close", () => {
    clients.delete(socket);
    if (!connection.playerId) return;
    players.delete(connection.playerId);
    broadcast({ type: "player:left", id: connection.playerId });
  });

  socket.on("error", () => socket.close());
});

setInterval(() => {
  broadcast({ type: "snapshot", players: [...players.values()] });
}, 5000).unref();

async function heartbeat() {
  if (!supabase) return;
  await supabase.from("world_status").upsert({
    id: "emberwatch",
    online_count: players.size,
    updated_at: new Date().toISOString()
  });
}

setInterval(heartbeat, 30_000).unref();

function shutdown() {
  for (const socket of wss.clients) socket.close(1012, "Server restarting");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
