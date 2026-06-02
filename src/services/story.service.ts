import { prisma } from "../config/prisma";
import { AppError } from "../utils/response";
import { config } from "../config/env";

// ─────────────────────────────────────────
// Get stories feed (friends' active stories)
// ─────────────────────────────────────────

export async function getStoriesFeed(userId: string) {
  const now = new Date();

  // Get accepted friend IDs
  const friendships = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ userAId: userId }, { userBId: userId }],
    },
  });
  const friendIds = friendships.map((f) =>
    f.userAId === userId ? f.userBId : f.userAId
  );
  const authorIds = [...friendIds, userId];

  const stories = await prisma.story.findMany({
    where: {
      userId: { in: authorIds },
      expiresAt: { gt: now },
    },
    include: {
      user: { include: { profile: true } },
      views: { select: { userId: true } },
      reactions: { select: { userId: true, emoji: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Group by user
  const grouped = new Map<
    string,
    { user: unknown; stories: typeof stories }
  >();
  for (const story of stories) {
    if (!grouped.has(story.userId)) {
      grouped.set(story.userId, { user: story.user, stories: [] });
    }
    grouped.get(story.userId)!.stories.push(story);
  }

  return Array.from(grouped.values()).map((g) => ({
    user: g.user,
    stories: g.stories.map((s) => ({
      ...s,
      viewedByMe: s.views.some((v) => v.userId === userId),
      viewCount: s.views.length,
      myReaction: s.reactions.find((r) => r.userId === userId)?.emoji ?? null,
    })),
  }));
}

// ─────────────────────────────────────────
// Get my stories
// ─────────────────────────────────────────

export async function getMyStories(userId: string) {
  return prisma.story.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    include: {
      views: { include: { user: { include: { profile: true } } } },
      reactions: { include: { user: { include: { profile: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ─────────────────────────────────────────
// Create story
// ─────────────────────────────────────────

export async function createStory(
  userId: string,
  mediaUrl: string,
  mediaType: "IMAGE" | "VIDEO",
  caption?: string,
  duration = 5000
) {
  const expiresAt = new Date(
    Date.now() + config.story.expiryHours * 60 * 60 * 1000
  );

  const story = await prisma.story.create({
    data: { userId, mediaUrl, mediaType, caption, duration, expiresAt },
    include: { user: { include: { profile: true } } },
  });

  // Update stories count
  await prisma.profile.update({
    where: { userId },
    data: { storiesCount: { increment: 1 } },
  });

  return story;
}

// ─────────────────────────────────────────
// View story
// ─────────────────────────────────────────

export async function viewStory(storyId: string, viewerId: string) {
  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story) throw new AppError("Story not found", 404);
  if (story.expiresAt < new Date()) throw new AppError("Story has expired", 410);

  const view = await prisma.storyView.upsert({
    where: { storyId_userId: { storyId, userId: viewerId } },
    create: { storyId, userId: viewerId },
    update: {},
  });

  return view;
}

// ─────────────────────────────────────────
// React to story
// ─────────────────────────────────────────

export async function reactToStory(
  storyId: string,
  userId: string,
  emoji: string
) {
  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story) throw new AppError("Story not found", 404);
  if (story.expiresAt < new Date()) throw new AppError("Story expired", 410);

  return prisma.storyReaction.upsert({
    where: { storyId_userId: { storyId, userId } },
    create: { storyId, userId, emoji },
    update: { emoji },
  });
}

// ─────────────────────────────────────────
// Delete story
// ─────────────────────────────────────────

export async function deleteStory(storyId: string, userId: string) {
  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story) throw new AppError("Story not found", 404);
  if (story.userId !== userId) throw new AppError("Unauthorized", 403);

  await prisma.story.delete({ where: { id: storyId } });
  await prisma.profile.update({
    where: { userId },
    data: { storiesCount: { decrement: 1 } },
  }).catch(() => {});
}

// ─────────────────────────────────────────
// Purge expired stories (cron job)
// ─────────────────────────────────────────

export async function purgeExpiredStories() {
  const result = await prisma.story.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
