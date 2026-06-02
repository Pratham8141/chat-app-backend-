import { prisma } from "../config/prisma";
import { AppError } from "../utils/response";

// ─────────────────────────────────────────
// Get user's chat list
// ─────────────────────────────────────────

export async function getUserChats(userId: string) {
  const memberships = await prisma.chatMember.findMany({
    where: { userId, leftAt: null },
    include: {
      chat: {
        include: {
          members: {
            where: { leftAt: null },
            include: { user: { include: { profile: true } } },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { sender: { include: { profile: true } } },
          },
        },
      },
    },
    orderBy: { chat: { updatedAt: "desc" } },
  });

  return memberships.map((m) => {
    const lastMsg = m.chat.messages[0];
    const peer =
      m.chat.type === "DIRECT"
        ? m.chat.members.find((mem) => mem.userId !== userId)?.user
        : null;

    return {
      id: m.chat.id,
      type: m.chat.type,
      name: m.chat.type === "GROUP" ? m.chat.name : peer?.profile?.name,
      avatarUrl: m.chat.type === "GROUP" ? m.chat.avatarUrl : peer?.profile?.avatarUrl,
      description: m.chat.description,
      pinned: m.pinned,
      muted: m.muted,
      archived: m.archived,
      unreadCount: m.unreadCount,
      peer:
        peer
          ? {
              id: peer.id,
              name: peer.profile?.name,
              username: peer.profile?.username,
              avatarUrl: peer.profile?.avatarUrl,
              online: peer.profile?.online,
              lastSeen: peer.profile?.lastSeen,
            }
          : null,
      memberCount: m.chat.members.length,
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            content: lastMsg.content,
            type: lastMsg.type,
            senderId: lastMsg.senderId,
            senderName: lastMsg.sender.profile?.name,
            createdAt: lastMsg.createdAt,
          }
        : null,
    };
  });
}

// ─────────────────────────────────────────
// Get or create direct chat
// ─────────────────────────────────────────

export async function getOrCreateDirectChat(userAId: string, userBId: string) {
  if (userAId === userBId) throw new AppError("Cannot chat with yourself", 400);

  // Check if blocked
  const blocked = await prisma.blockedUser.findFirst({
    where: {
      OR: [
        { blockerId: userAId, blockedId: userBId },
        { blockerId: userBId, blockedId: userAId },
      ],
    },
  });
  if (blocked) throw new AppError("Cannot message this user", 403, "BLOCKED");

  // Find existing direct chat
  const existing = await prisma.chat.findFirst({
    where: {
      type: "DIRECT",
      AND: [
        { members: { some: { userId: userAId, leftAt: null } } },
        { members: { some: { userId: userBId, leftAt: null } } },
      ],
    },
    include: {
      members: {
        include: { user: { include: { profile: true } } },
      },
    },
  });

  if (existing) return existing;

  // Create new
  return prisma.chat.create({
    data: {
      type: "DIRECT",
      members: {
        create: [{ userId: userAId }, { userId: userBId }],
      },
    },
    include: {
      members: {
        include: { user: { include: { profile: true } } },
      },
    },
  });
}

// ─────────────────────────────────────────
// Create group chat
// ─────────────────────────────────────────

export async function createGroupChat(
  creatorId: string,
  name: string,
  description: string | undefined,
  memberIds: string[]
) {
  const allMemberIds = [...new Set([creatorId, ...memberIds])];

  return prisma.$transaction(async (tx) => {
    const chat = await tx.chat.create({
      data: {
        type: "GROUP",
        name,
        description,
        members: {
          create: allMemberIds.map((uid) => ({
            userId: uid,
            isAdmin: uid === creatorId,
          })),
        },
      },
    });

    await tx.group.create({
      data: {
        chatId: chat.id,
        name,
        description,
        createdById: creatorId,
        members: {
          create: allMemberIds.map((uid) => ({
            userId: uid,
            role: uid === creatorId ? "OWNER" : "MEMBER",
          })),
        },
      },
    });

    return chat;
  });
}

// ─────────────────────────────────────────
// Update chat member preferences
// ─────────────────────────────────────────

export async function updateChatMember(
  chatId: string,
  userId: string,
  updates: { pinned?: boolean; muted?: boolean; archived?: boolean }
) {
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  if (!member) throw new AppError("Not a member of this chat", 403);

  return prisma.chatMember.update({
    where: { chatId_userId: { chatId, userId } },
    data: updates,
  });
}

// ─────────────────────────────────────────
// Delete chat (soft: leave)
// ─────────────────────────────────────────

export async function leaveChat(chatId: string, userId: string) {
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  if (!member) throw new AppError("Not a member of this chat", 403);

  await prisma.chatMember.update({
    where: { chatId_userId: { chatId, userId } },
    data: { leftAt: new Date() },
  });
}

// ─────────────────────────────────────────
// Get single chat detail
// ─────────────────────────────────────────

export async function getChatById(chatId: string, userId: string) {
  const membership = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  if (!membership) throw new AppError("Chat not found or access denied", 404);

  return prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      members: {
        where: { leftAt: null },
        include: { user: { include: { profile: true } } },
      },
    },
  });
}

// ─────────────────────────────────────────
// Mark chat as read
// ─────────────────────────────────────────

export async function markChatRead(chatId: string, userId: string) {
  await prisma.chatMember.update({
    where: { chatId_userId: { chatId, userId } },
    data: { unreadCount: 0, lastReadAt: new Date() },
  });
}
