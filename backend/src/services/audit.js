import { prisma } from "../lib/prisma.js";

export async function logIssueActivity({ issueId, actorId, action, details = {} }) {
  return prisma.activityLog.create({ data: { issueId, actorId, action, details } });
}
