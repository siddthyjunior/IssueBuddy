import { prisma } from "../lib/prisma.js";
import { HttpError } from "./http-error.js";

export async function projectRoleFor(user, projectId) {
  if (user.role === "ADMIN") return "ADMIN";
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    select: { role: true }
  });
  return membership?.role ?? null;
}

export async function requireProjectRole(user, projectId, allowedRoles = []) {
  const role = await projectRoleFor(user, projectId);
  if (!role) throw new HttpError(403, "You do not have access to this project.");
  if (role !== "ADMIN" && allowedRoles.length && !allowedRoles.includes(role)) {
    throw new HttpError(403, "Your project role does not allow this action.");
  }
  return role;
}

export async function findAccessibleIssue(user, issueId) {
  const issue = await prisma.issue.findUnique({ where: { id: issueId }, select: { id: true, issueKey: true, projectId: true, assigneeId: true, reporterId: true, title: true } });
  if (!issue) throw new HttpError(404, "Issue not found.");
  await requireProjectRole(user, issue.projectId);
  return issue;
}
