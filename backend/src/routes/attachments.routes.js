import { Router } from "express";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { findAccessibleIssue, requireProjectRole } from "../utils/access.js";
import { HttpError } from "../utils/http-error.js";
import { logIssueActivity } from "../services/audit.js";

const router = Router();
router.use(authenticate);
const uploadDir = path.resolve(process.env.UPLOAD_DIR || "uploads");
await fs.mkdir(uploadDir, { recursive: true });
const allowedMime = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain"]);
const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, uploadDir),
  filename: (req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => callback(allowedMime.has(file.mimetype) ? null : new Error("Only PNG, JPEG, WEBP, PDF and TXT files are allowed."), allowedMime.has(file.mimetype))
});

router.post("/issues/:issueId/attachments", async (req, res, next) => {
  try {
    const issue = await findAccessibleIssue(req.user, req.params.issueId);
    await requireProjectRole(req.user, issue.projectId, ["MANAGER", "DEVELOPER"]);
    req.issue = issue;
    next();
  } catch (error) { next(error); }
}, upload.single("file"), async (req, res) => {
  if (!req.file) throw new HttpError(400, "Choose a file to upload.");
  const issue = req.issue;
  const attachment = await prisma.attachment.create({
    data: {
      originalName: path.basename(req.file.originalname).slice(0, 255),
      storageName: req.file.filename, mimeType: req.file.mimetype, size: req.file.size,
      issueId: issue.id, uploadedById: req.user.id
    },
    include: { uploadedBy: { select: { id: true, name: true } } }
  });
  await logIssueActivity({ issueId: issue.id, actorId: req.user.id, action: "ATTACHMENT_ADDED", details: { attachmentId: attachment.id, name: attachment.originalName } });
  res.status(201).json(attachment);
});

router.get("/:attachmentId/download", async (req, res) => {
  const input = z.string().uuid().parse(req.params.attachmentId);
  const attachment = await prisma.attachment.findUnique({ where: { id: input } });
  if (!attachment) throw new HttpError(404, "Attachment not found.");
  await findAccessibleIssue(req.user, attachment.issueId);
  const safePath = path.join(uploadDir, path.basename(attachment.storageName));
  try { await fs.access(safePath); } catch { throw new HttpError(404, "Attachment file is missing from storage."); }
  res.download(safePath, attachment.originalName);
});

export default router;
