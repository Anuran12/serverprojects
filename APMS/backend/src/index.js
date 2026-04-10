import "dotenv/config";
import http from "http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import { waitUntilDbReady } from "./lib/db.js";
import { initDatabase } from "./services/initDatabase.js";
import { initSocket } from "./services/socket.js";
import { startReminderScheduler } from "./jobs/reminderJob.js";

const app = express();
const server = http.createServer(app);

app.use(helmet());

const allowedOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const corsOriginHandler = (origin, callback) => {
  // Allow non-browser callers and allow all origins when no explicit allowlist exists.
  if (!origin || allowedOrigins.length === 0) return callback(null, true);
  if (allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error("CORS origin not allowed"));
};

app.use(
  cors({
    origin: corsOriginHandler,
    credentials: true
  })
);
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", authRoutes);
app.use("/api", userRoutes);
app.use("/api", taskRoutes);
app.use("/api", notificationRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  return res.status(500).json({ message: "Internal server error" });
});

const PORT = Number(process.env.PORT || 4000);

await waitUntilDbReady();
await initDatabase();
initSocket(server, corsOriginHandler);
startReminderScheduler();

server.listen(PORT, () => {
  console.log(`Backend running on ${PORT}`);
});
