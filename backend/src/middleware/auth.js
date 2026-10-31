import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../utils/http-error.js";

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  throw new Error("JWT_SECRET must be configured and contain at least 32 characters.");
}

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id }, secret, { expiresIn: "12h", issuer: "issuebuddy-api", audience: "issuebuddy-web" });
}

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) throw new HttpError(401, "Authentication required.");
    let payload;
    try {
      payload = jwt.verify(token, secret, { issuer: "issuebuddy-api", audience: "issuebuddy-web" });
    } catch {
      throw new HttpError(401, "Your session is invalid or has expired. Please sign in again.");
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, name: true, email: true, role: true, isActive: true } });
    if (!user || !user.isActive) throw new HttpError(401, "This account is unavailable.");
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new HttpError(403, "You do not have permission to perform this action."));
    next();
  };
}
