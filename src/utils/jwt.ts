import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { JwtPayload, AuthTokens } from "../types";
import { AppError } from "./response";

export function signAccessToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function signRefreshToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  } catch {
    throw new AppError("Invalid or expired access token", 401, "INVALID_TOKEN");
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, config.jwt.refreshSecret) as JwtPayload;
  } catch {
    throw new AppError("Invalid or expired refresh token", 401, "INVALID_REFRESH_TOKEN");
  }
}

export function createTokenPair(
  userId: string,
  email: string,
  sessionId: string
): AuthTokens {
  const payload: Omit<JwtPayload, "iat" | "exp"> = {
    sub: userId,
    email,
    sessionId,
  };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  // 15m in seconds
  const expiresIn = 15 * 60;
  return { accessToken, refreshToken, expiresIn };
}

export function parseRefreshExpiryMs(): number {
  // Parse "30d" -> milliseconds
  const str = config.jwt.refreshExpiresIn;
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const [, amount, unit] = match;
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 3600 * 1000,
    d: 86400 * 1000,
  };
  return parseInt(amount) * (multipliers[unit] ?? 1000);
}
