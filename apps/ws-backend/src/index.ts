import { WebSocket, WebSocketServer } from 'ws';
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from '@repo/backend-common/config';
import { prismaClient } from "@repo/db/client";
import { WsMessageSchema } from "@repo/common/types";
import Redis from 'ioredis';

const wss = new WebSocketServer({ port: 8080 });
const pub = new Redis();
const sub = new Redis();

// Subscribe to the global canvas channel
sub.subscribe('canvas-events');

interface User {
  ws: WebSocket,
  rooms: string[],
  userId: string
}

const users: User[] = [];

function checkUser(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded == "string" || !decoded || !decoded.userId) return null;
    return decoded.userId;
  } catch(e) {
    return null;
  }
}

wss.on('connection', function connection(ws, request) {
  const url = request.url;
  if (!url) return;
  const queryParams = new URLSearchParams(url.split('?')[1]);
  const token = queryParams.get('token') || "";
  const userId = checkUser(token);

  if (userId == null) {
    ws.close();
    return null;
  }

  const user = { userId, rooms: [], ws };
  users.push(user);

  (ws as any).isAlive = true;
  ws.on('pong', () => { (ws as any).isAlive = true; });

  ws.on('message', async function message(data) {
    try {
      const parsedData = JSON.parse(data.toString());
      const validatedData = WsMessageSchema.parse(parsedData);

      if (validatedData.type === "join_room") {
        user.rooms.push(validatedData.roomId);
      }

      if (validatedData.type === "leave_room") {
        user.rooms = user.rooms.filter(x => x !== validatedData.roomId);
      }

      if (validatedData.type === "chat") {
        const { roomId, message: msg } = validatedData;

        // Save to DB
        try {
          await prismaClient.chat.create({
            data: { roomId: Number(roomId), message: msg, userId }
          });
        } catch (e) {
          console.error("DB Save Error:", e);
        }

        // Publish to Redis so all server instances receive it
        pub.publish('canvas-events', JSON.stringify({
          type: "chat",
          roomId,
          message: msg,
          userId
        }));
      }
    } catch (e) {
      console.error("Invalid message:", e);
    }
  });

  ws.on('close', () => {
    const index = users.indexOf(user);
    if (index > -1) users.splice(index, 1);
  });
});

// Handle messages from Redis Pub/Sub
sub.on('message', (channel, message) => {
  if (channel === 'canvas-events') {
    const data = JSON.parse(message);
    users.forEach(u => {
      if (u.rooms.includes(data.roomId)) {
        u.ws.send(JSON.stringify(data));
      }
    });
  }
});

const interval = setInterval(() => {
  wss.clients.forEach(ws => {
    if (userExists(ws) && !(ws as any).isAlive) {
      ws.terminate();
    }
    (ws as any).isAlive = false;
    ws.ping();
  });
}, 30000);

function userExists(ws: WebSocket) {
  return users.some(u => u.ws === ws);
}

wss.on('close', () => clearInterval(interval));
