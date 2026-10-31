import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { HttpError } from "../utils/http-error.js";

const router = Router();
router.use(authenticate);
router.get("/", async (req, res) => {
  const data = await prisma.notification.findMany({ where: { recipientId: req.user.id }, include: { actor: { select: { id: true, name: true } }, issue: { select: { id: true, issueKey: true, title: true } } }, orderBy: { createdAt: "desc" }, take: 50 });
  const unread = data.filter((item) => !item.readAt).length;
  res.json({ data, unread });
});
router.patch("/:id/read", async (req, res) => {
  const input = z.string().uuid().parse(req.params.id);
  const notification = await prisma.notification.findUnique({ where: { id: input }, select: { recipientId: true } });
  if (!notification || notification.recipientId !== req.user.id) throw new HttpError(404, "Notification not found.");
  const updated = await prisma.notification.update({ where: { id: input }, data: { readAt: new Date() } });
  res.json(updated);
});
router.post("/read-all", async (req, res) => {
  const result = await prisma.notification.updateMany({ where: { recipientId: req.user.id, readAt: null }, data: { readAt: new Date() } });
  res.json({ updated: result.count });
});
export default router;
