import { z } from "zod";

// ─────────────────────────────────────────
// Auth Schemas
// ─────────────────────────────────────────

export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers and underscores only"),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8).max(128),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export const verifyOtpSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  token: z.string().length(6),
  type: z.enum(["email", "sms"]),
});

// ─────────────────────────────────────────
// Profile Schemas
// ─────────────────────────────────────────

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_]+$/)
    .optional(),
  bio: z.string().max(300).optional(),
  website: z.string().url().optional().or(z.literal("")),
  location: z.string().max(100).optional(),
  coverColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  phone: z.string().optional(),
});

export const updateFcmTokenSchema = z.object({
  fcmToken: z.string(),
});

// ─────────────────────────────────────────
// Chat Schemas
// ─────────────────────────────────────────

export const createDirectChatSchema = z.object({
  userId: z.string(),
});

export const createGroupChatSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  memberIds: z.array(z.string()).min(1).max(255),
});

export const updateChatMemberSchema = z.object({
  pinned: z.boolean().optional(),
  muted: z.boolean().optional(),
  archived: z.boolean().optional(),
});

// ─────────────────────────────────────────
// Message Schemas
// ─────────────────────────────────────────

export const sendMessageSchema = z.object({
  content: z.string().max(4000).optional(),
  type: z
    .enum([
      "TEXT",
      "IMAGE",
      "VIDEO",
      "AUDIO",
      "VOICE_NOTE",
      "FILE",
      "GIF",
      "STICKER",
      "LOCATION",
      "CONTACT",
      "POLL",
    ])
    .default("TEXT"),
  mediaUrl: z.string().url().optional(),
  fileName: z.string().max(255).optional(),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
  duration: z.number().optional(),
  replyToId: z.string().optional(),
});

export const editMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

export const addReactionSchema = z.object({
  emoji: z.string().max(10),
});

export const forwardMessageSchema = z.object({
  targetChatIds: z.array(z.string()).min(1).max(10),
});

// ─────────────────────────────────────────
// Group Schemas
// ─────────────────────────────────────────

export const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export const addGroupMemberSchema = z.object({
  userIds: z.array(z.string()).min(1),
});

export const updateGroupRoleSchema = z.object({
  role: z.enum(["MEMBER", "ADMIN"]),
});

// ─────────────────────────────────────────
// Story Schemas
// ─────────────────────────────────────────

export const createStorySchema = z.object({
  mediaUrl: z.string().url(),
  mediaType: z.enum(["IMAGE", "VIDEO"]),
  caption: z.string().max(500).optional(),
  duration: z.number().min(1000).max(15000).default(5000),
});

export const storyReactionSchema = z.object({
  emoji: z.string().max(10),
});

export const storyReplySchema = z.object({
  content: z.string().min(1).max(1000),
});

// ─────────────────────────────────────────
// Community Schemas
// ─────────────────────────────────────────

export const createCommunitySchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(1000).optional(),
  bannerColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  iconColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  category: z.string().max(50).optional(),
  channels: z.array(z.string().min(1).max(50)).max(10).default(["general"]),
});

export const createChannelSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(300).optional(),
});

export const announcementSchema = z.object({
  content: z.string().min(1).max(2000),
});

// ─────────────────────────────────────────
// Call Schemas
// ─────────────────────────────────────────

export const initiateCallSchema = z.object({
  receiverId: z.string(),
  type: z.enum(["VOICE", "VIDEO"]),
});

// ─────────────────────────────────────────
// Search Schemas
// ─────────────────────────────────────────

export const searchSchema = z.object({
  q: z.string().min(1).max(100),
  type: z.enum(["all", "users", "chats", "messages", "groups", "communities"]).default("all"),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

// ─────────────────────────────────────────
// Settings Schemas
// ─────────────────────────────────────────

export const updateSettingsSchema = z.object({
  pushNotifications: z.boolean().optional(),
  messageNotifications: z.boolean().optional(),
  storyNotifications: z.boolean().optional(),
  mentionNotifications: z.boolean().optional(),
  callNotifications: z.boolean().optional(),
  notificationSound: z.boolean().optional(),
  notificationVibrate: z.boolean().optional(),
  lastSeenVisibility: z.enum(["EVERYONE", "CONTACTS", "NOBODY"]).optional(),
  onlineStatusVisibility: z.enum(["EVERYONE", "CONTACTS", "NOBODY"]).optional(),
  readReceiptsEnabled: z.boolean().optional(),
  profilePhotoVisibility: z.enum(["EVERYONE", "CONTACTS", "NOBODY"]).optional(),
  storyVisibility: z.enum(["EVERYONE", "CONTACTS", "NOBODY"]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  language: z.string().max(10).optional(),
  fontSize: z.enum(["small", "medium", "large"]).optional(),
  mediaAutoDownload: z.boolean().optional(),
});

// ─────────────────────────────────────────
// Report / Block Schemas
// ─────────────────────────────────────────

export const reportUserSchema = z.object({
  targetId: z.string(),
  reason: z.enum([
    "SPAM",
    "HARASSMENT",
    "INAPPROPRIATE_CONTENT",
    "FAKE_ACCOUNT",
    "VIOLENCE",
    "OTHER",
  ]),
  description: z.string().max(1000).optional(),
});

export const blockUserSchema = z.object({
  targetId: z.string(),
});

// ─────────────────────────────────────────
// Pagination Schema
// ─────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
