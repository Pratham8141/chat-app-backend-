import { v4 as uuidv4 } from "uuid";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/response";

export async function listCommunities(page = 1, limit = 20, query?: string) {
  const skip = (page - 1) * limit;
  const where = query
    ? { name: { contains: query, mode: "insensitive" as const } }
    : {};

  const [communities, total] = await Promise.all([
    prisma.community.findMany({
      where,
      skip,
      take: limit,
      include: { _count: { select: { members: true } } },
      orderBy: { memberCount: "desc" },
    }),
    prisma.community.count({ where }),
  ]);
  return { communities, total };
}

export async function getCommunityById(communityId: string, userId: string) {
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    include: {
      channels: true,
      announcements: { orderBy: { createdAt: "desc" }, take: 10 },
      members: { where: { userId }, select: { role: true, joinedAt: true } },
      _count: { select: { members: true } },
    },
  });
  if (!community) throw new AppError("Community not found", 404);
  return {
    ...community,
    isJoined: community.members.length > 0,
    myRole: community.members[0]?.role ?? null,
  };
}

export async function createCommunity(
  creatorId: string,
  name: string,
  description: string | undefined,
  bannerColor: string,
  iconColor: string,
  category: string | undefined,
  channels: string[]
) {
  return prisma.$transaction(async (tx) => {
    const community = await tx.community.create({
      data: {
        name,
        description,
        bannerColor,
        iconColor,
        category,
        inviteCode: uuidv4().split("-")[0].toUpperCase(),
        createdById: creatorId,
        memberCount: 1,
        members: { create: { userId: creatorId, role: "OWNER" } },
        channels: {
          create: channels.map((ch, i) => ({
            name: ch,
            isDefault: i === 0,
          })),
        },
      },
      include: { channels: true },
    });
    return community;
  });
}

export async function joinCommunity(communityId: string, userId: string) {
  const existing = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
  });
  if (existing) throw new AppError("Already a member", 409);

  await prisma.$transaction([
    prisma.communityMember.create({
      data: { communityId, userId },
    }),
    prisma.community.update({
      where: { id: communityId },
      data: { memberCount: { increment: 1 } },
    }),
  ]);
}

export async function leaveCommunity(communityId: string, userId: string) {
  const member = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
  });
  if (!member) throw new AppError("Not a member", 400);
  if (member.role === "OWNER") throw new AppError("Owner must transfer ownership first", 400);

  await prisma.$transaction([
    prisma.communityMember.delete({
      where: { communityId_userId: { communityId, userId } },
    }),
    prisma.community.update({
      where: { id: communityId },
      data: { memberCount: { decrement: 1 } },
    }),
  ]);
}

export async function createAnnouncement(
  communityId: string,
  authorId: string,
  content: string
) {
  const member = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId: authorId } },
  });
  if (!member || !["ADMIN", "OWNER", "MODERATOR"].includes(member.role)) {
    throw new AppError("Insufficient permissions", 403);
  }

  return prisma.communityAnnouncement.create({
    data: { communityId, authorId, content },
  });
}
