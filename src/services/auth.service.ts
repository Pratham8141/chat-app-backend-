import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../config/prisma";
import { supabaseAdmin } from "../config/supabase";
import { AppError } from "../utils/response";
import { createTokenPair, verifyRefreshToken, parseRefreshExpiryMs } from "../utils/jwt";
import { AuthTokens } from "../types";
import { logger } from "../utils/logger";

const SALT_ROUNDS = 12;

// ─────────────────────────────────────────
// Register
// ─────────────────────────────────────────

export interface RegisterInput {
  name: string;
  username: string;
  email: string;
  phone?: string;
  password: string;
}

export async function registerUser(
  input: RegisterInput,
  ipAddress?: string,
  userAgent?: string
): Promise<{ user: { id: string; email: string }; tokens: AuthTokens }> {
  // Check email / username taken
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { profile: { username: input.username } }] },
    include: { profile: true },
  });
  if (existing) {
    if (existing.email === input.email) throw new AppError("Email already registered", 409);
    throw new AppError("Username already taken", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  // Create user + profile in a transaction
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: input.email,
        phone: input.phone,
        passwordHash,
        profile: {
          create: {
            name: input.name,
            username: input.username.toLowerCase(),
            coverColor: randomCoverColor(),
          },
        },
        settings: { create: {} },
      },
    });
    return newUser;
  });

  // Create session
  const { session, tokens } = await createSession(user.id, user.email, ipAddress, userAgent);
  logger.info(`User registered: ${user.email}`);

  // Send email verification via Supabase (non-blocking)
  supabaseAdmin.auth
    .admin.generateLink({ type: "magiclink", email: user.email })
    .catch(() => {});

  return { user: { id: user.id, email: user.email }, tokens };
}

// ─────────────────────────────────────────
// Login
// ─────────────────────────────────────────

export async function loginUser(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ user: { id: string; email: string }; tokens: AuthTokens }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");

  // Update online status
  await prisma.profile.update({
    where: { userId: user.id },
    data: { online: true, lastSeen: new Date() },
  }).catch(() => {});

  const { tokens } = await createSession(user.id, user.email, ipAddress, userAgent);
  logger.info(`User logged in: ${user.email}`);

  return { user: { id: user.id, email: user.email }, tokens };
}

// ─────────────────────────────────────────
// Refresh Tokens
// ─────────────────────────────────────────

export async function refreshTokens(
  refreshToken: string
): Promise<AuthTokens> {
  const payload = verifyRefreshToken(refreshToken);

  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
    throw new AppError("Refresh token invalid or expired", 401, "INVALID_REFRESH_TOKEN");
  }

  // Rotate: revoke old, issue new
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { isRevoked: true },
  });

  const { tokens } = await createSession(
    stored.userId,
    stored.user.email,
    undefined,
    undefined,
    payload.sessionId
  );

  return tokens;
}

// ─────────────────────────────────────────
// Logout
// ─────────────────────────────────────────

export async function logoutUser(
  userId: string,
  sessionId: string
): Promise<void> {
  await Promise.all([
    prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    }),
    prisma.profile.update({
      where: { userId },
      data: { online: false, lastSeen: new Date() },
    }),
  ]).catch(() => {});
}

// ─────────────────────────────────────────
// Forgot / Reset Password
// ─────────────────────────────────────────

export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always return success to prevent email enumeration
  if (!user) return;

  await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  // Verify token via Supabase
  const { data, error } = await supabaseAdmin.auth.verifyOtp({
    token_hash: token,
    type: "recovery",
  });

  if (error || !data.user?.email) {
    throw new AppError("Invalid or expired reset token", 400);
  }

  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({
    where: { email: data.user.email },
    data: { passwordHash: hash },
  });

  // Revoke all sessions and refresh tokens
  const user = await prisma.user.findUnique({ where: { email: data.user.email } });
  if (user) {
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { isActive: false },
    });
    await prisma.refreshToken.updateMany({
      where: { userId: user.id },
      data: { isRevoked: true },
    });
  }
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

async function createSession(
  userId: string,
  email: string,
  ipAddress?: string,
  userAgent?: string,
  existingSessionId?: string
): Promise<{ session: { id: string }; tokens: AuthTokens }> {
  const sessionId = existingSessionId ?? uuidv4();
  const refreshExpiry = new Date(Date.now() + parseRefreshExpiryMs());

  const [session] = await Promise.all([
    prisma.session.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        userId,
        ipAddress,
        userAgent,
        isActive: true,
        expiresAt: refreshExpiry,
      },
      update: {
        isActive: true,
        lastActiveAt: new Date(),
        expiresAt: refreshExpiry,
      },
    }),
  ]);

  const tokens = createTokenPair(userId, email, sessionId);

  await prisma.refreshToken.create({
    data: {
      userId,
      token: tokens.refreshToken,
      expiresAt: refreshExpiry,
    },
  });

  return { session, tokens };
}

function randomCoverColor(): string {
  const colors = [
    "#5B5FEF", "#7C3AED", "#0EA5E9", "#F59E0B",
    "#10B981", "#EC4899", "#EF4444", "#6366F1", "#F97316",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
