import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export function notFoundHandler(req, res) {
  res.status(404).json({ error: "Route not found.", path: req.originalUrl });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof ZodError) {
    return res.status(400).json({ error: "Validation failed.", details: error.flatten().fieldErrors });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return res.status(409).json({ error: "A record with this value already exists." });
    if (error.code === "P2025") return res.status(404).json({ error: "The requested record was not found." });
    if (error.code === "P2003") return res.status(400).json({ error: "The requested relationship is invalid." });
  }
  if (error.name === "MulterError") return res.status(400).json({ error: error.message });
  if (error.message?.startsWith("Only PNG")) return res.status(400).json({ error: error.message });
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error(error);
  res.status(status).json({
    error: status >= 500 ? "Internal server error." : error.message,
    ...(error.details ? { details: error.details } : {}),
    ...(process.env.NODE_ENV === "development" && status >= 500 ? { debug: error.message } : {})
  });
}
