import { Response } from "express";
import { AuthRequest } from "../types";
import * as authService from "../services/auth.service";
import { sendSuccess } from "../utils/response";

export async function register(req: AuthRequest, res: Response) {
  const { name, username, email, phone, password } = req.body;
  const result = await authService.registerUser(
    { name, username, email, phone, password },
    req.ip,
    req.headers["user-agent"]
  );
  sendSuccess(res, result, "Registration successful", 201);
}

export async function login(req: AuthRequest, res: Response) {
  const { email, password } = req.body;
  const result = await authService.loginUser(
    email,
    password,
    req.ip,
    req.headers["user-agent"]
  );
  sendSuccess(res, result, "Login successful");
}

export async function refresh(req: AuthRequest, res: Response) {
  const { refreshToken } = req.body;
  const tokens = await authService.refreshTokens(refreshToken);
  sendSuccess(res, { tokens });
}

export async function logout(req: AuthRequest, res: Response) {
  await authService.logoutUser(req.user!.id, req.sessionId!);
  sendSuccess(res, null, "Logged out successfully");
}

export async function forgotPassword(req: AuthRequest, res: Response) {
  await authService.forgotPassword(req.body.email);
  sendSuccess(res, null, "If an account exists, a reset link has been sent");
}

export async function resetPassword(req: AuthRequest, res: Response) {
  await authService.resetPassword(req.body.token, req.body.password);
  sendSuccess(res, null, "Password reset successfully");
}

export async function me(req: AuthRequest, res: Response) {
  const { prisma } = await import("../config/prisma");
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { profile: true, settings: true },
  });
  sendSuccess(res, user);
}
