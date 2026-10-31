import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { requireProjectRole } from "../utils/access.js";
import { HttpError } from "../utils/http-error.js";

const router = Router();
router.use(authenticate);
const projectInclude = { _count: { select: { issues: true, members: true } } };

router.get("/", async (req, res) => {
  const where = req.user.role === "ADMIN" ? {} : { members: { some: { userId: req.user.id } } };
  const projects = await prisma.project.findMany({ where, include: projectInclude, orderBy: { updatedAt: "desc" } });
  res.json({ data: projects });
});

router.post("/", async (req, res) => {
  if (!['ADMIN', 'MANAGER'].includes(req.user.role)) throw new HttpError(403, "Only admins and managers can create projects.");
  const input = z.object({
    name: z.string().trim().min(2).max(120),
    key: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9]{1,11}$/),
    description: z.string().max(2000).default("")
  }).parse(req.body);
  const project = await prisma.project.create({
    data: {
      name: input.name, key: input.key, description: input.description,
      owner: { connect: { id: req.user.id } },
      members: { create: { user: { connect: { id: req.user.id } }, role: "MANAGER" } },
      labels: { create: [
        { name: "bug", color: "#ef657b" },
        { name: "feature", color: "#7e9bfa" },
        { name: "documentation", color: "#a88af2" }
      ] }
    }, include: projectInclude
  });
  res.status(201).json(project);
});

router.get("/:projectId", async (req, res) => {
  await requireProjectRole(req.user, req.params.projectId);
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId }, include: projectInclude });
  if (!project) throw new HttpError(404, "Project not found.");
  res.json(project);
});

router.get("/:projectId/members", async (req, res) => {
  await requireProjectRole(req.user, req.params.projectId);
  const members = await prisma.projectMember.findMany({
    where: { projectId: req.params.projectId },
    include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true } } },
    orderBy: { addedAt: "asc" }
  });
  res.json({ data: members.map((m) => ({ ...m.user, projectRole: m.role, addedAt: m.addedAt })) });
});

router.post("/:projectId/members", async (req, res) => {
  const role = await requireProjectRole(req.user, req.params.projectId, ["MANAGER"]);
  const input = z.object({ userId: z.string().uuid(), role: z.enum(["MANAGER", "DEVELOPER", "VIEWER"]).default("DEVELOPER") }).parse(req.body);
  const target = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, isActive: true } });
  if (!target || !target.isActive) throw new HttpError(404, "Active user not found.");
  const member = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: req.params.projectId, userId: input.userId } },
    create: { projectId: req.params.projectId, userId: input.userId, role: input.role },
    update: { role: input.role },
    include: { user: { select: { id: true, name: true, email: true, role: true } } }
  });
  res.status(201).json({ ...member.user, projectRole: member.role });
});

router.delete("/:projectId/members/:userId", async (req, res) => {
  await requireProjectRole(req.user, req.params.projectId, ["MANAGER"]);
  if (req.params.userId === req.user.id) throw new HttpError(400, "You cannot remove yourself from this project.");
  await prisma.projectMember.delete({ where: { projectId_userId: { projectId: req.params.projectId, userId: req.params.userId } } });
  res.json({ ok: true });
});

router.get("/:projectId/labels", async (req, res) => {
  await requireProjectRole(req.user, req.params.projectId);
  const labels = await prisma.label.findMany({ where: { projectId: req.params.projectId }, orderBy: { name: "asc" } });
  res.json({ data: labels });
});

router.post("/:projectId/labels", async (req, res) => {
  await requireProjectRole(req.user, req.params.projectId, ["MANAGER"]);
  const input = z.object({ name: z.string().trim().min(1).max(40), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#8b6df0") }).parse(req.body);
  const label = await prisma.label.create({ data: { ...input, projectId: req.params.projectId } });
  res.status(201).json(label);
});

export default router;
