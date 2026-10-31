import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate, signAccessToken } from "../middleware/auth.js";
import { HttpError } from "../utils/http-error.js";

const router = Router();
const loginSchema = z.object({ email: z.string().email().max(255), password: z.string().min(1).max(200) });

router.post("/login", async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user || !user.isActive || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new HttpError(401, "Invalid email or password.");
  }
  const token = signAccessToken(user);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.get("/me", authenticate, (req, res) => res.json({ user: req.user }));
router.post("/logout", authenticate, (req, res) => res.json({ ok: true, message: "Remove the access token from the client." }));

export default router;
