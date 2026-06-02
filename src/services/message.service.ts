import { MessageType } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/response";

const MESSAGE_PAGE_SIZE = 40;

// ─────────────────────────────────────────
// Get messages (paginated, cursor-based)
// ─────────────────────────────────────────

export async function getMessages(
  chatId: string,
  userId: string,
  cursor?: string,
  limit = MESSAGE_PAGE_SIZE
) {
  // Verify membership
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  if (!member) throw new AppError("Chat not found or access denied", 404);

  const messages = await prisma.message.findMany({
    where: {
      chatId,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: {
      sender: { include: { profile: true } },
      reactions: { include: { user: { include: { profile: true } } } },
      reads: true,
      replyTo: {
        include: { sender: { include: { profile: true } } },
      },
    },
  });

  const hasMore = messages.length > limit;
  const items = hasMore ? messages.slice(0, limit) : messages;

  return {
    messages: items.reverse(),
    hasMore,
    nextCursor: hasMore ? items[0]?.createdAt.toISOString() : null,
  };
}

// ─────────────────────────────────────────
// Send message
// ─────────────────────────────────────────

export interface SendMessageInput {
  chatId: string;
  senderId: string;
  content?: string;
  type?: MessageType;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
  replyToId?: string;
}

export async function sendMessage(input: SendMessageInput) {
  const { chatId, senderId } = input;

  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId: senderId } },
  });
  if (!member) throw new AppError("Not a member of this chat", 403);

  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        chatId,
        senderId,
        content: input.content,
        type: input.type ?? "TEXT",
        mediaUrl: input.mediaUrl,
        fileName: input.fileName,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        duration: input.duration,
        replyToId: input.replyToId,
      },
      include: {
        sender: { include: { profile: true } },
        reactions: true,
        replyTo: { include: { sender: { include: { profile: true } } } },
      },
    });

    // Update chat timestamp + increment unread for other members
    await tx.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    await tx.chatMember.updateMany({
      where: { chatId, userId: { not: senderId }, leftAt: null },
      data: { unreadCount: { increment: 1 } },
    });

    return msg;
  });

  return message;
}

// ─────────────────────────────────────────
// Edit message
// ─────────────────────────────────────────

export async function editMessage(
  messageId: string,
  userId: string,
  content: string
) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw new AppError("Message not found", 404);
  if (message.senderId !== userId) throw new AppError("Cannot edit another user's message", 403);
  if (message.deleted) throw new AppError("Cannot edit a deleted message", 400);
  if (message.type !== "TEXT") throw new AppError("Only text messages can be edited", 400);

  return prisma.message.update({
    where: { id: messageId },
    data: { content, edited: true, editedAt: new Date() },
    include: { sender: { include: { profile: true } }, reactions: true },
  });
}

// ─────────────────────────────────────────
// Delete message
// ─────────────────────────────────────────

export async function deleteMessage(messageId: string, userId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { chat: { include: { members: true } } },
  });
  if (!message) throw new AppError("Message not found", 404);

  // Allow sender or chat admin
  const isAdmin = message.chat.members.find(
    (m) => m.userId === userId && m.isAdmin
  );
  if (message.senderId !== userId && !isAdmin) {
    throw new AppError("Cannot delete this message", 403);
  }

  return prisma.message.update({
    where: { id: messageId },
    data: { deleted: true, content: null, mediaUrl: null },
  });
}

// ─────────────────────────────────────────
// React to message
// ─────────────────────────────────────────

export async function reactToMessage(
  messageId: string,
  userId: string,
  emoji: string
) {
  return prisma.messageReaction.upsert({
    where: { messageId_userId: { messageId, userId } },
    create: { messageId, userId, emoji },
    update: { emoji },
  });
}

export async function removeReaction(messageId: string, userId: string) {
  return prisma.messageReaction.deleteMany({
    where: { messageId, userId },
  });
}

// ─────────────────────────────────────────
// Mark as read
// ─────────────────────────────────────────

export async function markMessagesRead(
  chatId: string,
  userId: string,
  messageIds: string[]
) {
  const data = messageIds.map((messageId) => ({
    messageId,
    userId,
    readAt: new Date(),
  }));

  await prisma.$transaction([
    prisma.messageRead.createMany({
      data,
      skipDuplicates: true,
    }),
    prisma.chatMember.update({
      where: { chatId_userId: { chatId, userId } },
      data: { unreadCount: 0, lastReadAt: new Date() },
    }),
  ]);
}

// ─────────────────────────────────────────
// Forward message
// ─────────────────────────────────────────

export async function forwardMessage(
  messageId: string,
  senderId: string,
  targetChatIds: string[]
) {
  const original = await prisma.message.findUnique({ where: { id: messageId } });
  if (!original) throw new AppError("Message not found", 404);

  const created = await Promise.all(
    targetChatIds.map(async (chatId) => {
      const member = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId, userId: senderId } },
      });
      if (!member) return null;

      return prisma.message.create({
        data: {
          chatId,
          senderId,
          content: original.content,
          type: original.type,
          mediaUrl: original.mediaUrl,
          fileName: original.fileName,
          duration: original.duration,
          forwardedFromId: messageId,
        },
      });
    })
  );

  return created.filter(Boolean);
}

// ─────────────────────────────────────────
// Star / Unstar message
// ─────────────────────────────────────────

export async function starMessage(messageId: string, userId: string) {
  return prisma.starredMessage.upsert({
    where: { messageId_userId: { messageId, userId } },
    create: { messageId, userId },
    update: {},
  });
}

export async function unstarMessage(messageId: string, userId: string) {
  return prisma.starredMessage.deleteMany({
    where: { messageId, userId },
  });
}

export async function getStarredMessages(userId: string) {
  return prisma.starredMessage.findMany({
    where: { userId },
    include: {
      message: {
        include: {
          sender: { include: { profile: true } },
          chat: { select: { id: true, type: true, name: true } },
        },
      },
    },
    orderBy: { starredAt: "desc" },
  });
}
