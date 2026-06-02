import { prisma } from "../config/prisma";
import { AppError } from "../utils/response";
import { GroupRole } from "@prisma/client";

export async function getGroup(chatId: string, userId: string) {
  const group = await prisma.group.findUnique({
    where: { chatId },
    include: {
      members: {
        include: { user: { include: { profile: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!group) throw new AppError("Group not found", 404);

  const membership = group.members.find((m) => m.userId === userId);
  if (!membership) throw new AppError("Access denied", 403);

  return group;
}

export async function updateGroup(
  chatId: string,
  userId: string,
  updates: { name?: string; description?: string; avatarUrl?: string }
) {
  const group = await prisma.group.findUnique({ where: { chatId } });
  if (!group) throw new AppError("Group not found", 404);

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } },
  });
  if (!member || !["ADMIN", "OWNER"].includes(member.role)) {
    throw new AppError("Insufficient permissions", 403);
  }

  const [updatedGroup] = await Promise.all([
    prisma.group.update({ where: { chatId }, data: updates }),
    updates.name
      ? prisma.chat.update({ where: { id: chatId }, data: { name: updates.name } })
      : Promise.resolve(),
  ]);

  return updatedGroup;
}

export async function addMembers(
  chatId: string,
  adminId: string,
  userIds: string[]
) {
  const group = await prisma.group.findUnique({ where: { chatId } });
  if (!group) throw new AppError("Group not found", 404);

  const admin = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId: adminId } },
  });
  if (!admin || !["ADMIN", "OWNER"].includes(admin.role)) {
    throw new AppError("Insufficient permissions", 403);
  }

  const currentCount = await prisma.groupMember.count({
    where: { groupId: group.id },
  });
  if (currentCount + userIds.length > group.maxMembers) {
    throw new AppError(`Group is limited to ${group.maxMembers} members`, 400);
  }

  await prisma.$transaction([
    prisma.groupMember.createMany({
      data: userIds.map((uid) => ({
        groupId: group.id,
        userId: uid,
        addedById: adminId,
      })),
      skipDuplicates: true,
    }),
    prisma.chatMember.createMany({
      data: userIds.map((uid) => ({ chatId, userId: uid })),
      skipDuplicates: true,
    }),
  ]);
}

export async function removeMember(
  chatId: string,
  adminId: string,
  targetUserId: string
) {
  const group = await prisma.group.findUnique({ where: { chatId } });
  if (!group) throw new AppError("Group not found", 404);

  const admin = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId: adminId } },
  });
  const target = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId: targetUserId } },
  });

  if (!target) throw new AppError("Member not found", 404);

  // Only owner can remove admins; admins can remove members; users can remove themselves
  const isSelf = adminId === targetUserId;
  const isOwner = admin?.role === "OWNER";
  const isAdmin = admin?.role === "ADMIN";
  const targetIsMember = target.role === "MEMBER";

  if (!isSelf && !isOwner && !(isAdmin && targetIsMember)) {
    throw new AppError("Insufficient permissions", 403);
  }

  if (target.role === "OWNER" && !isSelf) {
    throw new AppError("Cannot remove group owner", 400);
  }

  await prisma.$transaction([
    prisma.groupMember.delete({
      where: { groupId_userId: { groupId: group.id, userId: targetUserId } },
    }),
    prisma.chatMember.update({
      where: { chatId_userId: { chatId, userId: targetUserId } },
      data: { leftAt: new Date() },
    }),
  ]);
}

export async function updateMemberRole(
  chatId: string,
  ownerId: string,
  targetUserId: string,
  role: "MEMBER" | "ADMIN"
) {
  const group = await prisma.group.findUnique({ where: { chatId } });
  if (!group) throw new AppError("Group not found", 404);

  const owner = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId: ownerId } },
  });
  if (owner?.role !== "OWNER") throw new AppError("Only owner can change roles", 403);

  return prisma.groupMember.update({
    where: { groupId_userId: { groupId: group.id, userId: targetUserId } },
    data: { role: role as GroupRole },
  });
}

export async function generateInviteCode(chatId: string, userId: string) {
  const group = await prisma.group.findUnique({ where: { chatId } });
  if (!group) throw new AppError("Group not found", 404);

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } },
  });
  if (!member || !["ADMIN", "OWNER"].includes(member.role)) {
    throw new AppError("Insufficient permissions", 403);
  }

  const { v4: uuidv4 } = await import("uuid");
  const code = uuidv4().split("-")[0].toUpperCase();
  return prisma.group.update({ where: { chatId }, data: { inviteCode: code } });
}

export async function joinByInviteCode(code: string, userId: string) {
  const group = await prisma.group.findUnique({ where: { inviteCode: code } });
  if (!group) throw new AppError("Invalid invite code", 404);

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } },
  });
  if (existing) throw new AppError("Already a member", 409);

  await prisma.$transaction([
    prisma.groupMember.create({
      data: { groupId: group.id, userId },
    }),
    prisma.chatMember.upsert({
      where: { chatId_userId: { chatId: group.chatId, userId } },
      create: { chatId: group.chatId, userId },
      update: { leftAt: null },
    }),
  ]);

  return group;
}
