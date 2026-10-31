import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { requireProjectRole } from "../utils/access.js";
import { HttpError } from "../utils/http-error.js";

const router = Router();
router.use(authenticate);

router.get("/", async (req, res) => {
  const projectId = req.query.projectId;
  if (projectId) {
    await requireProjectRole(req.user, String(projectId));
    const members = await prisma.projectMember.findMany({
      where: { projectId: String(projectId) },
      include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true } } },
      orderBy: { addedAt: "asc" }
    });
    const users = members.map((member) => ({ ...member.user, projectRole: member.role }));
    if (req.user.role === "ADMIN" && !users.some((user) => user.id === req.user.id)) {
      users.unshift({ ...req.user, projectRole: "MANAGER" });
    }
    return res.json({ data: users });
  }
  if (req.user.role !== "ADMIN") throw new HttpError(403, "Only administrators can list all users.");
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true }, orderBy: { name: "asc" } });
  res.json({ data: users });
});

router.post("/", requireRole("ADMIN"), async (req, res) => {
  const input = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().email().max(255),
    password: z.string().min(10).max(200),
    role: z.enum(["ADMIN", "MANAGER", "DEVELOPER", "VIEWER"]).default("DEVELOPER")
  }).parse(req.body);
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email.toLowerCase(), passwordHash, role: input.role },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true }
  });
  res.status(201).json(user);
});

router.patch("/:id/active", requireRole("ADMIN"), async (req, res) => {
  const input = z.object({ isActive: z.boolean() }).parse(req.body);
  if (req.params.id === req.user.id && !input.isActive) throw new HttpError(400, "You cannot deactivate your own account.");
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { isActive: input.isActive }, select: { id: true, name: true, email: true, role: true, isActive: true } });
  res.json(user);
});

export default router;
