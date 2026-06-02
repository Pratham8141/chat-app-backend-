import { prisma } from "../config/prisma";
import { AppError } from "../utils/response";
import { CallType } from "@prisma/client";

export async function initiateCall(
  initiatorId: string,
  receiverId: string,
  type: CallType
) {
  if (initiatorId === receiverId) throw new AppError("Cannot call yourself", 400);

  const blocked = await prisma.blockedUser.findFirst({
    where: {
      OR: [
        { blockerId: initiatorId, blockedId: receiverId },
        { blockerId: receiverId, blockedId: initiatorId },
      ],
    },
  });
  if (blocked) throw new AppError("Cannot call this user", 403);

  return prisma.call.create({
    data: {
      initiatorId,
      receiverId,
      type,
      direction: "OUTGOING",
      status: "RINGING",
    },
    include: {
      initiator: { include: { profile: true } },
      receiver: { include: { profile: true } },
    },
  });
}

export async function answerCall(callId: string, userId: string) {
  const call = await prisma.call.findUnique({ where: { id: callId } });
  if (!call) throw new AppError("Call not found", 404);
  if (call.receiverId !== userId) throw new AppError("Unauthorized", 403);
  if (call.status !== "RINGING") throw new AppError("Call is not ringing", 400);

  return prisma.call.update({
    where: { id: callId },
    data: { status: "ANSWERED", startedAt: new Date() },
  });
}

export async function endCall(callId: string, userId: string) {
  const call = await prisma.call.findUnique({ where: { id: callId } });
  if (!call) throw new AppError("Call not found", 404);
  if (call.initiatorId !== userId && call.receiverId !== userId) {
    throw new AppError("Unauthorized", 403);
  }

  const durationSec = call.startedAt
    ? Math.floor((Date.now() - call.startedAt.getTime()) / 1000)
    : 0;

  return prisma.call.update({
    where: { id: callId },
    data: {
      status: "ENDED",
      endedAt: new Date(),
      duration: durationSec,
    },
  });
}

export async function missCall(callId: string) {
  return prisma.call.update({
    where: { id: callId },
    data: { status: "MISSED", endedAt: new Date() },
  });
}

export async function getCallHistory(userId: string, page = 1, limit = 30) {
  const skip = (page - 1) * limit;
  const [calls, total] = await Promise.all([
    prisma.call.findMany({
      where: { OR: [{ initiatorId: userId }, { receiverId: userId }] },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        initiator: { include: { profile: true } },
        receiver: { include: { profile: true } },
      },
    }),
    prisma.call.count({
      where: { OR: [{ initiatorId: userId }, { receiverId: userId }] },
    }),
  ]);
  return { calls, total };
}
