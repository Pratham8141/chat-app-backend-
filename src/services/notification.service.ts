import { prisma } from "../config/prisma";
import { sendPushNotification, sendMulticastPush } from "../config/firebase";
import { NotificationType } from "@prisma/client";

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body?: string,
  data?: object
) {
  const notification = await prisma.notification.create({
    data: { userId, type, title, body, data },
  });

  // Send FCM push (non-blocking)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fcmToken: true },
  });

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { pushNotifications: true, messageNotifications: true },
  });

  if (user?.fcmToken && settings?.pushNotifications) {
    const shouldSend =
      type === "MESSAGE" ? settings.messageNotifications : true;

    if (shouldSend) {
      sendPushNotification(user.fcmToken, title, body ?? "", {
        type,
        notificationId: notification.id,
        ...flattenData(data),
      }).catch(() => {});
    }
  }

  return notification;
}

export async function getNotifications(userId: string, page = 1, limit = 30) {
  const skip = (page - 1) * limit;
  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);

  const unreadCount = await prisma.notification.count({
    where: { userId, read: false },
  });

  return { notifications, total, unreadCount };
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  await prisma.notification.updateMany({
    where: { userId, ...(ids ? { id: { in: ids } } : {}) },
    data: { read: true },
  });
}

export async function notifyNewMessage(
  chatId: string,
  senderId: string,
  content?: string
) {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      members: {
        where: { userId: { not: senderId }, leftAt: null, muted: false },
        include: { user: { select: { id: true, fcmToken: true } } },
      },
    },
  });
  if (!chat) return;

  const senderProfile = await prisma.profile.findUnique({
    where: { userId: senderId },
    select: { name: true },
  });

  const title =
    chat.type === "GROUP"
      ? `${chat.name}: ${senderProfile?.name}`
      : senderProfile?.name ?? "New message";
  const body = content ?? "Sent a media file";

  const tokens = chat.members
    .map((m) => m.user.fcmToken)
    .filter((t): t is string => !!t);

  if (tokens.length > 0) {
    sendMulticastPush(tokens, title, body, {
      chatId,
      type: "MESSAGE",
    }).catch(() => {});
  }
}

function flattenData(data?: object): Record<string, string> {
  if (!data) return {};
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v)])
  );
}
