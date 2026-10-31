import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { requireProjectRole } from "../utils/access.js";

const router = Router();
router.use(authenticate);
router.get("/projects/:projectId/analytics", async (req, res) => {
  const { projectId } = req.params;
  await requireProjectRole(req.user, projectId);
  const [total, byStatus, byPriority, recent, assignedToMe] = await Promise.all([
    prisma.issue.count({ where: { projectId } }),
    prisma.issue.groupBy({ by: ["status"], where: { projectId }, _count: { _all: true } }),
    prisma.issue.groupBy({ by: ["priority"], where: { projectId }, _count: { _all: true } }),
    prisma.issue.findMany({ where: { projectId }, include: { assignee: { select: { name: true } }, reporter: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 8 }),
    prisma.issue.count({ where: { projectId, assigneeId: req.user.id, status: { not: "CLOSED" } } })
  ]);
  const statusMap = Object.fromEntries(["OPEN", "IN_PROGRESS", "REVIEW", "CLOSED"].map((key) => [key, byStatus.find((item) => item.status === key)?._count._all || 0]));
  const priorityMap = Object.fromEntries(["LOW", "MEDIUM", "HIGH", "URGENT"].map((key) => [key, byPriority.find((item) => item.priority === key)?._count._all || 0]));
  res.json({ total, status: statusMap, priority: priorityMap, assignedToMe, recent });
});
export default router;
