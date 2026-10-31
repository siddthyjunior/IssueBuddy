import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { findAccessibleIssue, requireProjectRole } from "../utils/access.js";
import { HttpError } from "../utils/http-error.js";
import { logIssueActivity } from "../services/audit.js";
import { notifyUser } from "../services/notifications.js";

const router = Router();
router.use(authenticate);
const includeIssue = {
  assignee: { select: { id: true, name: true, email: true } },
  reporter: { select: { id: true, name: true, email: true } },
  labels: { include: { label: true } },
  attachments: { include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
  _count: { select: { comments: true, attachments: true } }
};
const issueFields = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().max(10000).default(""),
  status: z.enum(["OPEN", "IN_PROGRESS", "REVIEW", "CLOSED"]).default("OPEN"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  assigneeId: z.string().uuid().nullable().optional(),
  labelIds: z.array(z.string().uuid()).max(20).default([])
});

router.get("/", async (req, res) => {
  const input = z.object({
    projectId: z.string().uuid(),
    status: z.enum(["OPEN", "IN_PROGRESS", "REVIEW", "CLOSED"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    q: z.string().max(120).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50)
  }).parse(req.query);
  await requireProjectRole(req.user, input.projectId);
  const where = {
    projectId: input.projectId,
    ...(input.status ? { status: input.status } : {}),
    ...(input.priority ? { priority: input.priority } : {}),
    ...(input.q ? { OR: [
      { title: { contains: input.q, mode: "insensitive" } },
      { description: { contains: input.q, mode: "insensitive" } },
      { issueKey: { contains: input.q, mode: "insensitive" } }
    ] } : {})
  };
  const [total, data] = await prisma.$transaction([
    prisma.issue.count({ where }),
    prisma.issue.findMany({ where, include: includeIssue, orderBy: [{ updatedAt: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize })
  ]);
  res.json({ page: input.page, pageSize: input.pageSize, total, data });
});

router.post("/bulk", async (req, res) => {
  const input = z.object({
    projectId: z.string().uuid(),
    issueIds: z.array(z.string().uuid()).min(1).max(100),
    status: z.enum(["OPEN", "IN_PROGRESS", "REVIEW", "CLOSED"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    assigneeId: z.string().uuid().nullable().optional()
  }).refine((data) => data.status || data.priority || Object.hasOwn(data, "assigneeId"), "Provide at least one field to update.").parse(req.body);
  const role = await requireProjectRole(req.user, input.projectId, ["MANAGER", "DEVELOPER"]);
  const existing = await prisma.issue.findMany({
    where: { id: { in: input.issueIds }, projectId: input.projectId },
    select: { id: true, reporterId: true, assigneeId: true }
  });
  if (existing.length !== input.issueIds.length) throw new HttpError(400, "One or more selected issues do not belong to this project.");
  if (role === "DEVELOPER" && existing.some((issue) => issue.reporterId !== req.user.id && issue.assigneeId !== req.user.id)) {
    throw new HttpError(403, "Developers can bulk-update only issues they reported or are assigned to.");
  }
  const data = {};
  for (const key of ["status", "priority", "assigneeId"]) if (Object.hasOwn(input, key)) data[key] = input[key];
  await prisma.issue.updateMany({ where: { id: { in: input.issueIds }, projectId: input.projectId }, data });
  await prisma.activityLog.createMany({ data: input.issueIds.map((issueId) => ({ issueId, actorId: req.user.id, action: "BULK_UPDATED", details: data })) });
  res.json({ updated: input.issueIds.length });
});

router.get("/:issueId", async (req, res) => {
  const issue = await findAccessibleIssue(req.user, req.params.issueId);
  const full = await prisma.issue.findUnique({ where: { id: issue.id }, include: includeIssue });
  res.json(full);
});

router.post("/", async (req, res) => {
  const input = issueFields.parse(req.body);
  const projectId = z.string().uuid().parse(req.query.projectId || req.body.projectId);
  await requireProjectRole(req.user, projectId, ["MANAGER", "DEVELOPER"]);
  if (input.assigneeId) {
    const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: input.assigneeId } } });
    if (!member && req.user.role !== "ADMIN") throw new HttpError(400, "Assignee must be a member of this project.");
  }
  if (input.labelIds.length) {
    const count = await prisma.label.count({ where: { id: { in: input.labelIds }, projectId } });
    if (count !== input.labelIds.length) throw new HttpError(400, "All labels must belong to this project.");
  }
  const issue = await prisma.$transaction(async (tx) => {
    const project = await tx.project.update({ where: { id: projectId }, data: { nextIssueNumber: { increment: 1 } }, select: { key: true, nextIssueNumber: true } });
    const issueKey = `${project.key}-${project.nextIssueNumber - 1}`;
    const created = await tx.issue.create({
      data: {
        issueKey, title: input.title, description: input.description, status: input.status,
        priority: input.priority, project: { connect: { id: projectId } }, reporter: { connect: { id: req.user.id } },
        ...(input.assigneeId ? { assignee: { connect: { id: input.assigneeId } } } : {}),
        ...(input.labelIds.length ? { labels: { create: input.labelIds.map((labelId) => ({ label: { connect: { id: labelId } } })) } } : {})
      }, include: includeIssue
    });
    await tx.activityLog.create({ data: { issueId: created.id, actorId: req.user.id, action: "ISSUE_CREATED", details: { issueKey, title: input.title } } });
    return created;
  });
  if (issue.assigneeId) await notifyUser({ recipientId: issue.assigneeId, actorId: req.user.id, issueId: issue.id, type: "ISSUE_ASSIGNED", message: `You were assigned ${issue.issueKey}: ${issue.title}` });
  res.status(201).json(issue);
});

router.patch("/:issueId", async (req, res) => {
  const current = await findAccessibleIssue(req.user, req.params.issueId);
  const patch = z.object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().max(10000).optional(),
    status: z.enum(["OPEN", "IN_PROGRESS", "REVIEW", "CLOSED"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    labelIds: z.array(z.string().uuid()).max(20).optional()
  }).refine((data) => Object.keys(data).length > 0, "At least one field is required.").parse(req.body);
  const role = await requireProjectRole(req.user, current.projectId);
  const isManager = role === "ADMIN" || role === "MANAGER";
  const isContributorOnIssue = role === "DEVELOPER" && (current.assigneeId === req.user.id || current.reporterId === req.user.id);
  if (!isManager && !isContributorOnIssue) throw new HttpError(403, "Only a project manager or the issue's reporter/assignee can update it.");
  if (patch.assigneeId) {
    const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: current.projectId, userId: patch.assigneeId } } });
    if (!member && req.user.role !== "ADMIN") throw new HttpError(400, "Assignee must be a member of this project.");
  }
  if (patch.labelIds) {
    const count = await prisma.label.count({ where: { id: { in: patch.labelIds }, projectId: current.projectId } });
    if (count !== patch.labelIds.length) throw new HttpError(400, "All labels must belong to this project.");
  }
  const before = await prisma.issue.findUnique({ where: { id: current.id }, select: { title: true, status: true, priority: true, assigneeId: true } });
  const updateData = { ...patch };
  delete updateData.labelIds;
  const issue = await prisma.$transaction(async (tx) => {
    if (patch.labelIds) {
      await tx.issueLabel.deleteMany({ where: { issueId: current.id } });
      if (patch.labelIds.length) await tx.issueLabel.createMany({ data: patch.labelIds.map((labelId) => ({ issueId: current.id, labelId })) });
    }
    const updated = await tx.issue.update({ where: { id: current.id }, data: updateData, include: includeIssue });
    const changes = {};
    for (const key of ["title", "status", "priority", "assigneeId"]) {
      if (Object.hasOwn(patch, key) && before[key] !== patch[key]) changes[key] = { from: before[key], to: patch[key] };
    }
    if (Object.keys(changes).length || patch.description !== undefined || patch.labelIds !== undefined) {
      await tx.activityLog.create({ data: { issueId: current.id, actorId: req.user.id, action: "ISSUE_UPDATED", details: { changes, descriptionChanged: patch.description !== undefined, labelsChanged: patch.labelIds !== undefined } } });
    }
    return updated;
  });
  if (patch.assigneeId && patch.assigneeId !== before.assigneeId) {
    await notifyUser({ recipientId: patch.assigneeId, actorId: req.user.id, issueId: issue.id, type: "ISSUE_ASSIGNED", message: `You were assigned ${issue.issueKey}: ${issue.title}` });
  }
  if (patch.status && patch.status !== before.status && issue.reporterId !== req.user.id) {
    await notifyUser({ recipientId: issue.reporterId, actorId: req.user.id, issueId: issue.id, type: "ISSUE_UPDATED", message: `${issue.issueKey} moved to ${patch.status.replace("_", " ")}.` });
  }
  res.json(issue);
});

router.delete("/:issueId", async (req, res) => {
  const issue = await findAccessibleIssue(req.user, req.params.issueId);
  await requireProjectRole(req.user, issue.projectId, ["MANAGER"]);
  await prisma.issue.delete({ where: { id: issue.id } });
  res.json({ ok: true, id: issue.id });
});

router.get("/:issueId/comments", async (req, res) => {
  const issue = await findAccessibleIssue(req.user, req.params.issueId);
  const comments = await prisma.comment.findMany({ where: { issueId: issue.id }, include: { user: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" } });
  res.json({ data: comments });
});

router.post("/:issueId/comments", async (req, res) => {
  const issue = await findAccessibleIssue(req.user, req.params.issueId);
  await requireProjectRole(req.user, issue.projectId, ["MANAGER", "DEVELOPER"]);
  const input = z.object({ body: z.string().trim().min(1).max(5000) }).parse(req.body);
  const comment = await prisma.comment.create({ data: { body: input.body, issueId: issue.id, userId: req.user.id }, include: { user: { select: { id: true, name: true, role: true } } } });
  await logIssueActivity({ issueId: issue.id, actorId: req.user.id, action: "COMMENT_ADDED", details: { commentId: comment.id } });
  const recipients = new Set([issue.reporterId, issue.assigneeId].filter(Boolean));
  for (const recipientId of recipients) await notifyUser({ recipientId, actorId: req.user.id, issueId: issue.id, type: "COMMENT_ADDED", message: `New comment on ${issue.issueKey}.` });
  res.status(201).json(comment);
});

router.get("/:issueId/activity", async (req, res) => {
  const issue = await findAccessibleIssue(req.user, req.params.issueId);
  const data = await prisma.activityLog.findMany({ where: { issueId: issue.id }, include: { actor: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  res.json({ data });
});

export default router;
