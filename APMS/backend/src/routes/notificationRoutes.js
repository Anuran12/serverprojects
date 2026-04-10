import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { getNotifications, markAllRead } from "../services/notificationService.js";

const router = express.Router();

router.get("/notifications", requireAuth, async (req, res) => {
  const notifications = await getNotifications(req.user.id);
  return res.json(notifications);
});

router.patch("/notifications/read-all", requireAuth, async (req, res) => {
  await markAllRead(req.user.id);
  return res.json({ success: true });
});

export default router;