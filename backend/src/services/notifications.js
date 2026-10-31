import { prisma } from "../lib/prisma.js";

export async function notifyUser({ recipientId, actorId, issueId, type, message }) {
  if (!recipientId || recipientId === actorId) return null;
  return prisma.notification.create({ data: { recipientId, actorId, issueId, type, message } });
}
