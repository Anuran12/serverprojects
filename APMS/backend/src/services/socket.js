import { Server } from "socket.io";
import { verifyToken } from "../lib/auth.js";

let io;

export function initSocket(server, corsOriginHandler) {
  const socketPath = process.env.SOCKET_PATH || "/socket.io";

  io = new Server(server, {
    path: socketPath,
    cors: {
      origin: corsOriginHandler || true,
      credentials: true
    }
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const user = verifyToken(token);
      socket.user = user;
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.user.id}`);
  });

  return io;
}

export function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}
