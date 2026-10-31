import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import projectsRoutes from "./routes/projects.routes.js";
import issuesRoutes from "./routes/issues.routes.js";
import attachmentsRoutes from "./routes/attachments.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import { notFoundHandler, errorHandler } from "./middleware/errors.js";
import { prisma } from "./lib/prisma.js";

const app = express();
const origins = (process.env.CORS_ORIGINS || "http://localhost:5173").split(",").map((value) => value.trim());
app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin(origin, callback) {
  if (!origin || origins.includes("*") || origins.includes(origin)) return callback(null, true);
  return callback(new Error("Origin is not allowed by CORS."));
} }));
app.use(express.json({ limit: "1mb" }));
app.use("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false }));

app.get("/", (req, res) => res.json({ name: "IssueBuddy API", version: "2.0.0", status: "running" }));
app.get("/health", async (req, res, next) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ ok: true, database: "connected" }); }
  catch (error) { next(error); }
});
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/issues", issuesRoutes);
app.use("/api/attachments", attachmentsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use(notFoundHandler);
app.use(errorHandler);
export default app;
