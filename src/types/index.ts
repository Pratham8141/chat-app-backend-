import { Request } from "express";
import { User, Profile } from "@prisma/client";

// ─────────────────────────────────────────
// Augmented Express Request
// ─────────────────────────────────────────

export interface AuthRequest extends Request {
  user?: AuthUser;
  sessionId?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  profile?: Profile;
}

// ─────────────────────────────────────────
// API Response Shapes
// ─────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  cursor?: string;
}

// ─────────────────────────────────────────
// Auth Types
// ─────────────────────────────────────────

export interface JwtPayload {
  sub: string;      // user id
  email: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ─────────────────────────────────────────
// Socket Types
// ─────────────────────────────────────────

export interface SocketUser {
  userId: string;
  socketId: string;
  online: boolean;
}

export interface TypingPayload {
  chatId: string;
  userId: string;
  isTyping: boolean;
}

export interface MessagePayload {
  chatId: string;
  content?: string;
  type: string;
  mediaUrl?: string;
  replyToId?: string;
}

export interface CallSignalPayload {
  callId: string;
  targetUserId: string;
  signal: unknown;
  type: "VOICE" | "VIDEO";
}

// ─────────────────────────────────────────
// Extended Domain Types
// ─────────────────────────────────────────

export type UserWithProfile = User & {
  profile: Profile | null;
};

export interface ChatSummary {
  id: string;
  type: string;
  name?: string;
  avatarUrl?: string;
  description?: string;
  lastMessage?: MessageSummary;
  memberCount?: number;
  unreadCount: number;
  pinned: boolean;
  muted: boolean;
  archived: boolean;
  peer?: ProfilePublic;
}

export interface MessageSummary {
  id: string;
  content?: string;
  type: string;
  senderId: string;
  senderName?: string;
  createdAt: Date;
}

export interface ProfilePublic {
  id: string;
  userId: string;
  name: string;
  username: string;
  avatarUrl?: string;
  online: boolean;
  lastSeen: Date;
  bio?: string;
}

export interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  fcmToken?: string;
}
