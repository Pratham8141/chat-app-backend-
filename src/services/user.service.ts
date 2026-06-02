import { prisma } from "../config/prisma";
import { AppError } from "../utils/response";

// ─────────────────────────────────────────
// Get profile by userId or username
// ─────────────────────────────────────────

export async function getProfileByUserId(userId: string, requesterId: string) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    include: { user: { select: { id: true, email: true, phone: true } } },
  });
  if (!profile) throw new AppError("Profile not found", 404);

  // Check block status
  const blocked = await prisma.blockedUser.findFirst({
    where: {
      OR: [
        { blockerId: requesterId, blockedId: userId },
        { blockerId: userId, blockedId: requesterId },
      ],
    },
  });

  const settings = await prisma.userSettings.findUnique({ where: { userId } });

  // Apply privacy rules
  const showLastSeen = canSee(settings?.lastSeenVisibility, userId, requesterId);
  const showOnline = canSee(settings?.onlineStatusVisibility, userId, requesterId);

  return {
    ...profile,
    online: showOnline ? profile.online : undefined,
    lastSeen: showLastSeen ? profile.lastSeen : undefined,
    isBlocked: !!blocked,
    isMe: userId === requesterId,
  };
}

export async function getProfileByUsername(username: string, requesterId: string) {
  const profile = await prisma.profile.findUnique({ where: { username } });
  if (!profile) throw new AppError("User not found", 404);
  return getProfileByUserId(profile.userId, requesterId);
}

// ─────────────────────────────────────────
// Update profile
// ─────────────────────────────────────────

export async function updateProfile(
  userId: string,
  updates: {
    name?: string;
    username?: string;
    bio?: string;
    website?: string;
    location?: string;
    coverColor?: string;
  }
) {
  if (updates.username) {
    const taken = await prisma.profile.findFirst({
      where: { username: updates.username, userId: { not: userId } },
    });
    if (taken) throw new AppError("Username already taken", 409);
  }

  return prisma.profile.update({
    where: { userId },
    data: updates,
  });
}

// ─────────────────────────────────────────
// Search users
// ─────────────────────────────────────────

export async function searchUsers(
  query: string,
  requesterId: string,
  page = 1,
  limit = 20
) {
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.profile.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { username: { contains: query, mode: "insensitive" } },
        ],
        userId: { not: requesterId },
      },
      skip,
      take: limit,
      select: {
        id: true,
        userId: true,
        name: true,
        username: true,
        avatarUrl: true,
        online: true,
        bio: true,
      },
    }),
    prisma.profile.count({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { username: { contains: query, mode: "insensitive" } },
        ],
        userId: { not: requesterId },
      },
    }),
  ]);

  return { users, total };
}

// ─────────────────────────────────────────
// Block / Unblock
// ─────────────────────────────────────────

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new AppError("Cannot block yourself", 400);

  await prisma.blockedUser.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    create: { blockerId, blockedId },
    update: {},
  });
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await prisma.blockedUser.deleteMany({ where: { blockerId, blockedId } });
}

export async function getBlockedUsers(userId: string) {
  return prisma.blockedUser.findMany({
    where: { blockerId: userId },
    include: { blocked: { include: { profile: true } } },
  });
}

// ─────────────────────────────────────────
// Report user
// ─────────────────────────────────────────

export async function reportUser(
  reporterId: string,
  targetId: string,
  reason: string,
  description?: string
) {
  if (reporterId === targetId) throw new AppError("Cannot report yourself", 400);

  return prisma.report.create({
    data: {
      reporterId,
      targetId,
      reason: reason as never,
      description,
    },
  });
}

// ─────────────────────────────────────────
// Privacy helper
// ─────────────────────────────────────────

function canSee(
  level: string | undefined,
  ownerId: string,
  requesterId: string
): boolean {
  if (ownerId === requesterId) return true;
  if (!level || level === "EVERYONE") return true;
  if (level === "NOBODY") return false;
  // CONTACTS — simplified; in production check friendship table
  return false;
}

// ─────────────────────────────────────────
// Update FCM token
// ─────────────────────────────────────────

export async function updateFcmToken(userId: string, fcmToken: string) {
  await prisma.user.update({ where: { id: userId }, data: { fcmToken } });
}

// ─────────────────────────────────────────
// Settings
// ─────────────────────────────────────────

export async function getUserSettings(userId: string) {
  return prisma.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function updateUserSettings(userId: string, updates: object) {
  return prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...updates },
    update: updates,
  });
}
