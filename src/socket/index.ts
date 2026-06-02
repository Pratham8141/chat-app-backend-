import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { config } from "../config/env";
import { verifyAccessToken } from "../utils/jwt";
import { prisma } from "../config/prisma";
import { logger } from "../utils/logger";
import * as messageService from "../services/message.service";
import * as callService from "../services/call.service";
import * as notificationService from "../services/notification.service";

// ─────────────────────────────────────────
// Online user registry (in-memory)
// For production, replace with Redis
// ─────────────────────────────────────────

const onlineUsers = new Map<string, Set<string>>(); // userId -> Set<socketId>

function addOnlineUser(userId: string, socketId: string) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId)!.add(socketId);
}

function removeOnlineUser(userId: string, socketId: string) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) onlineUsers.delete(userId);
}

export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId) && onlineUsers.get(userId)!.size > 0;
}

export function getOnlineUsers(): string[] {
  return Array.from(onlineUsers.keys());
}

// ─────────────────────────────────────────
// Initialize Socket.IO
// ─────────────────────────────────────────

export function initSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.frontendUrl,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ── Auth middleware ──────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ??
        socket.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) return next(new Error("No token provided"));

      const payload = verifyAccessToken(token);

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        include: { profile: true },
      });
      if (!user) return next(new Error("User not found"));

      (socket as AuthSocket).userId = user.id;
      (socket as AuthSocket).user = user;
      next();
    } catch (err) {
      next(new Error("Authentication failed"));
    }
  });

  // ── Connection handler ───────────────────
  io.on("connection", (rawSocket) => {
    const socket = rawSocket as AuthSocket;
    const userId = socket.userId;

    logger.info(`Socket connected: user=${userId} socket=${socket.id}`);
    addOnlineUser(userId, socket.id);

    // ── Online status ──────────────────────
    handleOnlineStatus(io, socket);

    // ── Chat rooms ─────────────────────────
    handleChatRooms(io, socket);

    // ── Typing indicators ──────────────────
    handleTyping(io, socket);

    // ── Messages ───────────────────────────
    handleMessages(io, socket);

    // ── Read receipts ──────────────────────
    handleReadReceipts(io, socket);

    // ── Calls (WebRTC signaling) ───────────
    handleCalls(io, socket);

    // ── Stories ────────────────────────────
    handleStories(io, socket);

    // ── Disconnect ─────────────────────────
    socket.on("disconnect", async () => {
      logger.info(`Socket disconnected: user=${userId}`);
      removeOnlineUser(userId, socket.id);

      if (!isUserOnline(userId)) {
        // Update last seen
        await prisma.profile.update({
          where: { userId },
          data: { online: false, lastSeen: new Date() },
        }).catch(() => {});

        // Broadcast offline
        socket.broadcast.emit("user:offline", {
          userId,
          lastSeen: new Date().toISOString(),
        });
      }
    });
  });

  return io;
}

// ─────────────────────────────────────────
// Online Status Handlers
// ─────────────────────────────────────────

function handleOnlineStatus(io: Server, socket: AuthSocket) {
  // Mark user online in DB
  prisma.profile
    .update({ where: { userId: socket.userId }, data: { online: true } })
    .catch(() => {});

  // Notify others
  socket.broadcast.emit("user:online", { userId: socket.userId });

  // Client wants current online list
  socket.on("user:get_online", () => {
    socket.emit("user:online_list", { userIds: getOnlineUsers() });
  });

  // Heartbeat / ping
  socket.on("user:ping", () => {
    socket.emit("user:pong");
    prisma.profile
      .update({ where: { userId: socket.userId }, data: { lastSeen: new Date() } })
      .catch(() => {});
  });
}

// ─────────────────────────────────────────
// Chat Rooms
// ─────────────────────────────────────────

function handleChatRooms(io: Server, socket: AuthSocket) {
  // Auto-join user's chats on connect
  prisma.chatMember
    .findMany({ where: { userId: socket.userId, leftAt: null } })
    .then((members) => {
      members.forEach((m) => socket.join(`chat:${m.chatId}`));
    })
    .catch(() => {});
}

// ─────────────────────────────────────────
// Typing Indicators
// ─────────────────────────────────────────

function handleTyping(_io: Server, socket: AuthSocket) {
  socket.on("chat:typing", ({ chatId }: { chatId: string }) => {
    socket.to(`chat:${chatId}`).emit("chat:typing", {
      chatId,
      userId: socket.userId,
      isTyping: true,
    });
  });

  socket.on("chat:stop_typing", ({ chatId }: { chatId: string }) => {
    socket.to(`chat:${chatId}`).emit("chat:typing", {
      chatId,
      userId: socket.userId,
      isTyping: false,
    });
  });

  // Voice recording indicator
  socket.on("chat:recording", ({ chatId }: { chatId: string }) => {
    socket.to(`chat:${chatId}`).emit("chat:recording", {
      chatId,
      userId: socket.userId,
      isRecording: true,
    });
  });

  socket.on("chat:stop_recording", ({ chatId }: { chatId: string }) => {
    socket.to(`chat:${chatId}`).emit("chat:recording", {
      chatId,
      userId: socket.userId,
      isRecording: false,
    });
  });
}

// ─────────────────────────────────────────
// Real-time Message Events
// ─────────────────────────────────────────

function handleMessages(io: Server, socket: AuthSocket) {
  // Send message via socket (alternative to REST)
  socket.on(
    "message:send",
    async (
      data: {
        chatId: string;
        content?: string;
        type?: string;
        mediaUrl?: string;
        replyToId?: string;
        clientMsgId?: string;
      },
      ack?: (result: unknown) => void
    ) => {
      try {
        const message = await messageService.sendMessage({
          chatId: data.chatId,
          senderId: socket.userId,
          content: data.content,
          type: (data.type as never) ?? "TEXT",
          mediaUrl: data.mediaUrl,
          replyToId: data.replyToId,
        });

        // Broadcast to chat room (including sender for multi-device)
        io.to(`chat:${data.chatId}`).emit("message:receive", {
          ...message,
          clientMsgId: data.clientMsgId,
        });

        // Deliver receipts to sender
        socket.emit("message:delivered", {
          messageId: message.id,
          chatId: data.chatId,
          clientMsgId: data.clientMsgId,
        });

        // FCM push notifications for offline users
        notificationService
          .notifyNewMessage(data.chatId, socket.userId, data.content)
          .catch(() => {});

        if (ack) ack({ success: true, messageId: message.id });
      } catch (err) {
        if (ack) ack({ success: false, error: (err as Error).message });
      }
    }
  );

  // Message edited
  socket.on(
    "message:edit",
    async (data: { messageId: string; content: string; chatId: string }) => {
      try {
        const updated = await messageService.editMessage(
          data.messageId,
          socket.userId,
          data.content
        );
        io.to(`chat:${data.chatId}`).emit("message:edited", updated);
      } catch {}
    }
  );

  // Message deleted
  socket.on(
    "message:delete",
    async (data: { messageId: string; chatId: string }) => {
      try {
        await messageService.deleteMessage(data.messageId, socket.userId);
        io.to(`chat:${data.chatId}`).emit("message:deleted", {
          messageId: data.messageId,
          chatId: data.chatId,
        });
      } catch {}
    }
  );

  // Reaction added
  socket.on(
    "message:react",
    async (data: { messageId: string; chatId: string; emoji: string }) => {
      try {
        const reaction = await messageService.reactToMessage(
          data.messageId,
          socket.userId,
          data.emoji
        );
        io.to(`chat:${data.chatId}`).emit("message:reaction_added", {
          messageId: data.messageId,
          chatId: data.chatId,
          userId: socket.userId,
          emoji: data.emoji,
        });
      } catch {}
    }
  );

  // Reaction removed
  socket.on(
    "message:unreact",
    async (data: { messageId: string; chatId: string }) => {
      try {
        await messageService.removeReaction(data.messageId, socket.userId);
        io.to(`chat:${data.chatId}`).emit("message:reaction_removed", {
          messageId: data.messageId,
          chatId: data.chatId,
          userId: socket.userId,
        });
      } catch {}
    }
  );
}

// ─────────────────────────────────────────
// Read Receipts
// ─────────────────────────────────────────

function handleReadReceipts(io: Server, socket: AuthSocket) {
  socket.on(
    "message:seen",
    async (data: { chatId: string; messageIds: string[] }) => {
      try {
        await messageService.markMessagesRead(
          data.chatId,
          socket.userId,
          data.messageIds
        );

        socket.to(`chat:${data.chatId}`).emit("message:seen", {
          chatId: data.chatId,
          userId: socket.userId,
          messageIds: data.messageIds,
          seenAt: new Date().toISOString(),
        });
      } catch {}
    }
  );
}

// ─────────────────────────────────────────
// WebRTC Call Signaling
// ─────────────────────────────────────────

function handleCalls(io: Server, socket: AuthSocket) {
  // Initiate call — notify receiver
  socket.on(
    "call:offer",
    async (data: {
      callId: string;
      receiverId: string;
      signal: unknown;
      type: "VOICE" | "VIDEO";
      callerProfile: unknown;
    }) => {
      // Join a room for this call
      socket.join(`call:${data.callId}`);

      // Find receiver's socket(s)
      const receiverSockets = onlineUsers.get(data.receiverId);
      if (receiverSockets && receiverSockets.size > 0) {
        io.to(Array.from(receiverSockets)).emit("call:incoming", {
          callId: data.callId,
          callerId: socket.userId,
          callerProfile: data.callerProfile,
          type: data.type,
          signal: data.signal,
        });
      } else {
        // Receiver offline — send missed call notification
        notificationService
          .createNotification(
            data.receiverId,
            "CALL_MISSED",
            "Missed call",
            `You missed a ${data.type.toLowerCase()} call`,
            { callId: data.callId, callerId: socket.userId }
          )
          .catch(() => {});

        callService.missCall(data.callId).catch(() => {});
        socket.emit("call:unavailable", { callId: data.callId });
      }
    }
  );

  // Receiver answers — send WebRTC answer to caller
  socket.on(
    "call:answer",
    async (data: { callId: string; signal: unknown; callerId: string }) => {
      socket.join(`call:${data.callId}`);
      await callService.answerCall(data.callId, socket.userId).catch(() => {});

      const callerSockets = onlineUsers.get(data.callerId);
      if (callerSockets) {
        io.to(Array.from(callerSockets)).emit("call:answered", {
          callId: data.callId,
          signal: data.signal,
          answeredBy: socket.userId,
        });
      }
    }
  );

  // ICE candidate exchange
  socket.on(
    "call:ice_candidate",
    (data: { callId: string; targetUserId: string; candidate: unknown }) => {
      const targetSockets = onlineUsers.get(data.targetUserId);
      if (targetSockets) {
        io.to(Array.from(targetSockets)).emit("call:ice_candidate", {
          callId: data.callId,
          candidate: data.candidate,
          from: socket.userId,
        });
      }
    }
  );

  // End call
  socket.on("call:end", async (data: { callId: string }) => {
    await callService.endCall(data.callId, socket.userId).catch(() => {});
    io.to(`call:${data.callId}`).emit("call:ended", {
      callId: data.callId,
      endedBy: socket.userId,
    });
    // Remove all from call room
    io.socketsLeave(`call:${data.callId}`);
  });

  // Reject call
  socket.on(
    "call:reject",
    async (data: { callId: string; callerId: string }) => {
      await callService.endCall(data.callId, socket.userId).catch(() => {});
      const callerSockets = onlineUsers.get(data.callerId);
      if (callerSockets) {
        io.to(Array.from(callerSockets)).emit("call:rejected", {
          callId: data.callId,
          rejectedBy: socket.userId,
        });
      }
    }
  );
}

// ─────────────────────────────────────────
// Story Events
// ─────────────────────────────────────────

function handleStories(_io: Server, socket: AuthSocket) {
  socket.on("story:view", async (data: { storyId: string; authorId: string }) => {
    // Notify story author of new view (if online)
    const authorSockets = onlineUsers.get(data.authorId);
    if (authorSockets && data.authorId !== socket.userId) {
      _io.to(Array.from(authorSockets)).emit("story:viewed", {
        storyId: data.storyId,
        viewerId: socket.userId,
      });
    }
  });
}

// ─────────────────────────────────────────
// Type augmentation
// ─────────────────────────────────────────

interface AuthSocket extends Socket {
  userId: string;
  user: {
    id: string;
    email: string;
    profile: { name: string; avatarUrl: string | null } | null;
  };
}
