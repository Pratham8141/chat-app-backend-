import { v4 as uuidv4 } from "uuid";
import { supabaseAdmin, bucket } from "../config/supabase";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/response";
import { MediaType } from "@prisma/client";

// ─────────────────────────────────────────
// Upload helpers
// ─────────────────────────────────────────

function getBucketForType(type: MediaType): string {
  switch (type) {
    case "IMAGE": return bucket.messages;
    case "VIDEO": return bucket.messages;
    case "AUDIO":
    case "VOICE_NOTE": return bucket.messages;
    case "DOCUMENT": return bucket.documents;
    case "GIF":
    case "STICKER": return bucket.messages;
    default: return bucket.messages;
  }
}

function getStoragePath(
  uploaderId: string,
  type: MediaType,
  filename: string
): string {
  const date = new Date().toISOString().split("T")[0];
  return `${uploaderId}/${type.toLowerCase()}/${date}/${filename}`;
}

// ─────────────────────────────────────────
// Upload a media file
// ─────────────────────────────────────────

export async function uploadMedia(
  uploaderId: string,
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
  type: MediaType,
  options?: {
    width?: number;
    height?: number;
    duration?: number;
    groupId?: string;
  }
): Promise<{
  id: string;
  url: string;
  storagePath: string;
  type: MediaType;
  mimeType: string;
  size: number;
}> {
  const ext = originalName.split(".").pop() ?? "";
  const uniqueName = `${uuidv4()}.${ext}`;
  const storagePath = getStoragePath(uploaderId, type, uniqueName);
  const bucketName = getBucketForType(type);

  // Upload to Supabase Storage
  const { error } = await supabaseAdmin.storage
    .from(bucketName)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new AppError(`Storage upload failed: ${error.message}`, 500);
  }

  // Get public URL
  const { data: urlData } = supabaseAdmin.storage
    .from(bucketName)
    .getPublicUrl(storagePath);

  const url = urlData.publicUrl;

  // Persist media record
  const media = await prisma.media.create({
    data: {
      uploaderId,
      groupId: options?.groupId,
      url,
      storagePath,
      type,
      mimeType,
      size: fileBuffer.length,
      width: options?.width,
      height: options?.height,
      duration: options?.duration,
    },
  });

  return {
    id: media.id,
    url,
    storagePath,
    type,
    mimeType,
    size: fileBuffer.length,
  };
}

// ─────────────────────────────────────────
// Upload avatar
// ─────────────────────────────────────────

export async function uploadAvatar(
  userId: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const ext = mimeType.split("/")[1] ?? "jpg";
  const path = `${userId}/avatar.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(bucket.avatars)
    .upload(path, fileBuffer, { contentType: mimeType, upsert: true });

  if (error) throw new AppError(`Avatar upload failed: ${error.message}`, 500);

  const { data } = supabaseAdmin.storage.from(bucket.avatars).getPublicUrl(path);

  // Update profile
  await prisma.profile.update({
    where: { userId },
    data: { avatarUrl: data.publicUrl },
  });

  return data.publicUrl;
}

// ─────────────────────────────────────────
// Upload story media
// ─────────────────────────────────────────

export async function uploadStoryMedia(
  userId: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const isVideo = mimeType.startsWith("video/");
  const ext = mimeType.split("/")[1] ?? "jpg";
  const path = `${userId}/${uuidv4()}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(bucket.stories)
    .upload(path, fileBuffer, { contentType: mimeType, upsert: false });

  if (error) throw new AppError(`Story upload failed: ${error.message}`, 500);

  const { data } = supabaseAdmin.storage.from(bucket.stories).getPublicUrl(path);
  return data.publicUrl;
}

// ─────────────────────────────────────────
// Delete media
// ─────────────────────────────────────────

export async function deleteMedia(mediaId: string, userId: string) {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new AppError("Media not found", 404);
  if (media.uploaderId !== userId) throw new AppError("Unauthorized", 403);

  const bucketName = getBucketForType(media.type);
  await supabaseAdmin.storage.from(bucketName).remove([media.storagePath]);
  await prisma.media.delete({ where: { id: mediaId } });
}

// ─────────────────────────────────────────
// Get shared media for a chat
// ─────────────────────────────────────────

export async function getChatSharedMedia(chatId: string, userId: string) {
  // Verify membership
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  if (!member) throw new AppError("Access denied", 403);

  return prisma.message.findMany({
    where: {
      chatId,
      deleted: false,
      type: { in: ["IMAGE", "VIDEO", "AUDIO", "VOICE_NOTE", "FILE"] },
    },
    select: {
      id: true,
      type: true,
      mediaUrl: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      createdAt: true,
      sender: { include: { profile: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}
