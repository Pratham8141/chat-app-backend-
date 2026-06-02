import { Response } from "express";
import { AuthRequest } from "../types";
import { sendSuccess, buildPagination } from "../utils/response";
import * as userService from "../services/user.service";
import * as chatService from "../services/chat.service";
import * as messageService from "../services/message.service";
import * as storyService from "../services/story.service";
import * as mediaService from "../services/media.service";
import * as communityService from "../services/community.service";
import * as callService from "../services/call.service";
import * as notificationService from "../services/notification.service";

// ─────────────────────────────────────────
// USER CONTROLLER
// ─────────────────────────────────────────

export const userController = {
  async getProfile(req: AuthRequest, res: Response) {
    const { userId } = req.params;
    const profile = await userService.getProfileByUserId(userId, req.user!.id);
    sendSuccess(res, profile);
  },

  async getProfileByUsername(req: AuthRequest, res: Response) {
    const { username } = req.params;
    const profile = await userService.getProfileByUsername(username, req.user!.id);
    sendSuccess(res, profile);
  },

  async updateProfile(req: AuthRequest, res: Response) {
    const profile = await userService.updateProfile(req.user!.id, req.body);
    sendSuccess(res, profile, "Profile updated");
  },

  async uploadAvatar(req: AuthRequest, res: Response) {
    if (!req.file) throw Object.assign(new Error("No file"), { statusCode: 400 });
    const url = await mediaService.uploadAvatar(
      req.user!.id,
      req.file.buffer,
      req.file.mimetype
    );
    sendSuccess(res, { avatarUrl: url }, "Avatar updated");
  },

  async blockUser(req: AuthRequest, res: Response) {
    await userService.blockUser(req.user!.id, req.body.targetId);
    sendSuccess(res, null, "User blocked");
  },

  async unblockUser(req: AuthRequest, res: Response) {
    await userService.unblockUser(req.user!.id, req.params.userId);
    sendSuccess(res, null, "User unblocked");
  },

  async getBlockedUsers(req: AuthRequest, res: Response) {
    const list = await userService.getBlockedUsers(req.user!.id);
    sendSuccess(res, list);
  },

  async reportUser(req: AuthRequest, res: Response) {
    const report = await userService.reportUser(
      req.user!.id,
      req.body.targetId,
      req.body.reason,
      req.body.description
    );
    sendSuccess(res, report, "Report submitted", 201);
  },

  async getSettings(req: AuthRequest, res: Response) {
    const settings = await userService.getUserSettings(req.user!.id);
    sendSuccess(res, settings);
  },

  async updateSettings(req: AuthRequest, res: Response) {
    const settings = await userService.updateUserSettings(req.user!.id, req.body);
    sendSuccess(res, settings, "Settings updated");
  },

  async updateFcmToken(req: AuthRequest, res: Response) {
    await userService.updateFcmToken(req.user!.id, req.body.fcmToken);
    sendSuccess(res, null, "FCM token updated");
  },
};

// ─────────────────────────────────────────
// CHAT CONTROLLER
// ─────────────────────────────────────────

export const chatController = {
  async getChats(req: AuthRequest, res: Response) {
    const chats = await chatService.getUserChats(req.user!.id);
    sendSuccess(res, chats);
  },

  async getChatById(req: AuthRequest, res: Response) {
    const chat = await chatService.getChatById(req.params.chatId, req.user!.id);
    sendSuccess(res, chat);
  },

  async createDirectChat(req: AuthRequest, res: Response) {
    const chat = await chatService.getOrCreateDirectChat(
      req.user!.id,
      req.body.userId
    );
    sendSuccess(res, chat, "Chat created", 201);
  },

  async createGroupChat(req: AuthRequest, res: Response) {
    const { name, description, memberIds } = req.body;
    const chat = await chatService.createGroupChat(
      req.user!.id,
      name,
      description,
      memberIds
    );
    sendSuccess(res, chat, "Group created", 201);
  },

  async updateChatMember(req: AuthRequest, res: Response) {
    const member = await chatService.updateChatMember(
      req.params.chatId,
      req.user!.id,
      req.body
    );
    sendSuccess(res, member, "Updated");
  },

  async leaveChat(req: AuthRequest, res: Response) {
    await chatService.leaveChat(req.params.chatId, req.user!.id);
    sendSuccess(res, null, "Left chat");
  },

  async markRead(req: AuthRequest, res: Response) {
    await chatService.markChatRead(req.params.chatId, req.user!.id);
    sendSuccess(res, null, "Marked as read");
  },

  async getSharedMedia(req: AuthRequest, res: Response) {
    const media = await mediaService.getChatSharedMedia(
      req.params.chatId,
      req.user!.id
    );
    sendSuccess(res, media);
  },
};

// ─────────────────────────────────────────
// MESSAGE CONTROLLER
// ─────────────────────────────────────────

export const messageController = {
  async getMessages(req: AuthRequest, res: Response) {
    const { chatId } = req.params;
    const { cursor, limit } = req.query as { cursor?: string; limit?: string };
    const result = await messageService.getMessages(
      chatId,
      req.user!.id,
      cursor,
      limit ? parseInt(limit) : undefined
    );
    sendSuccess(res, result);
  },

  async sendMessage(req: AuthRequest, res: Response) {
    const message = await messageService.sendMessage({
      chatId: req.params.chatId,
      senderId: req.user!.id,
      ...req.body,
    });
    sendSuccess(res, message, "Message sent", 201);
  },

  async editMessage(req: AuthRequest, res: Response) {
    const message = await messageService.editMessage(
      req.params.messageId,
      req.user!.id,
      req.body.content
    );
    sendSuccess(res, message, "Message edited");
  },

  async deleteMessage(req: AuthRequest, res: Response) {
    await messageService.deleteMessage(req.params.messageId, req.user!.id);
    sendSuccess(res, null, "Message deleted");
  },

  async addReaction(req: AuthRequest, res: Response) {
    const reaction = await messageService.reactToMessage(
      req.params.messageId,
      req.user!.id,
      req.body.emoji
    );
    sendSuccess(res, reaction);
  },

  async removeReaction(req: AuthRequest, res: Response) {
    await messageService.removeReaction(req.params.messageId, req.user!.id);
    sendSuccess(res, null, "Reaction removed");
  },

  async markRead(req: AuthRequest, res: Response) {
    const { messageIds } = req.body;
    await messageService.markMessagesRead(
      req.params.chatId,
      req.user!.id,
      messageIds
    );
    sendSuccess(res, null, "Marked as read");
  },

  async forwardMessage(req: AuthRequest, res: Response) {
    const messages = await messageService.forwardMessage(
      req.params.messageId,
      req.user!.id,
      req.body.targetChatIds
    );
    sendSuccess(res, messages, "Message forwarded");
  },

  async starMessage(req: AuthRequest, res: Response) {
    await messageService.starMessage(req.params.messageId, req.user!.id);
    sendSuccess(res, null, "Message starred");
  },

  async unstarMessage(req: AuthRequest, res: Response) {
    await messageService.unstarMessage(req.params.messageId, req.user!.id);
    sendSuccess(res, null, "Message unstarred");
  },

  async getStarredMessages(req: AuthRequest, res: Response) {
    const messages = await messageService.getStarredMessages(req.user!.id);
    sendSuccess(res, messages);
  },
};

// ─────────────────────────────────────────
// STORY CONTROLLER
// ─────────────────────────────────────────

export const storyController = {
  async getFeed(req: AuthRequest, res: Response) {
    const feed = await storyService.getStoriesFeed(req.user!.id);
    sendSuccess(res, feed);
  },

  async getMyStories(req: AuthRequest, res: Response) {
    const stories = await storyService.getMyStories(req.user!.id);
    sendSuccess(res, stories);
  },

  async createStory(req: AuthRequest, res: Response) {
    const { mediaUrl, mediaType, caption, duration } = req.body;
    const story = await storyService.createStory(
      req.user!.id,
      mediaUrl,
      mediaType,
      caption,
      duration
    );
    sendSuccess(res, story, "Story posted", 201);
  },

  async viewStory(req: AuthRequest, res: Response) {
    await storyService.viewStory(req.params.storyId, req.user!.id);
    sendSuccess(res, null, "Viewed");
  },

  async reactToStory(req: AuthRequest, res: Response) {
    const reaction = await storyService.reactToStory(
      req.params.storyId,
      req.user!.id,
      req.body.emoji
    );
    sendSuccess(res, reaction);
  },

  async deleteStory(req: AuthRequest, res: Response) {
    await storyService.deleteStory(req.params.storyId, req.user!.id);
    sendSuccess(res, null, "Story deleted");
  },
};

// ─────────────────────────────────────────
// MEDIA CONTROLLER
// ─────────────────────────────────────────

export const mediaController = {
  async uploadMedia(req: AuthRequest, res: Response) {
    if (!req.file) throw Object.assign(new Error("No file"), { statusCode: 400 });
    const { type } = req.body;
    const result = await mediaService.uploadMedia(
      req.user!.id,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      type ?? "IMAGE"
    );
    sendSuccess(res, result, "Uploaded", 201);
  },

  async uploadStoryMedia(req: AuthRequest, res: Response) {
    if (!req.file) throw Object.assign(new Error("No file"), { statusCode: 400 });
    const url = await mediaService.uploadStoryMedia(
      req.user!.id,
      req.file.buffer,
      req.file.mimetype
    );
    sendSuccess(res, { url });
  },

  async deleteMedia(req: AuthRequest, res: Response) {
    await mediaService.deleteMedia(req.params.mediaId, req.user!.id);
    sendSuccess(res, null, "Media deleted");
  },
};

// ─────────────────────────────────────────
// COMMUNITY CONTROLLER
// ─────────────────────────────────────────

export const communityController = {
  async list(req: AuthRequest, res: Response) {
    const { page, limit, q } = req.query as Record<string, string>;
    const result = await communityService.listCommunities(
      parseInt(page ?? "1"),
      parseInt(limit ?? "20"),
      q
    );
    const pagination = buildPagination(result.total, parseInt(page ?? "1"), parseInt(limit ?? "20"));
    sendSuccess(res, result.communities, undefined, 200, pagination);
  },

  async getById(req: AuthRequest, res: Response) {
    const community = await communityService.getCommunityById(
      req.params.communityId,
      req.user!.id
    );
    sendSuccess(res, community);
  },

  async create(req: AuthRequest, res: Response) {
    const { name, description, bannerColor, iconColor, category, channels } = req.body;
    const community = await communityService.createCommunity(
      req.user!.id,
      name,
      description,
      bannerColor ?? "#5B5FEF",
      iconColor ?? "#7C3AED",
      category,
      channels ?? ["general"]
    );
    sendSuccess(res, community, "Community created", 201);
  },

  async join(req: AuthRequest, res: Response) {
    await communityService.joinCommunity(req.params.communityId, req.user!.id);
    sendSuccess(res, null, "Joined community");
  },

  async leave(req: AuthRequest, res: Response) {
    await communityService.leaveCommunity(req.params.communityId, req.user!.id);
    sendSuccess(res, null, "Left community");
  },

  async createAnnouncement(req: AuthRequest, res: Response) {
    const ann = await communityService.createAnnouncement(
      req.params.communityId,
      req.user!.id,
      req.body.content
    );
    sendSuccess(res, ann, "Announcement posted", 201);
  },
};

// ─────────────────────────────────────────
// CALL CONTROLLER
// ─────────────────────────────────────────

export const callController = {
  async initiate(req: AuthRequest, res: Response) {
    const call = await callService.initiateCall(
      req.user!.id,
      req.body.receiverId,
      req.body.type
    );
    sendSuccess(res, call, "Call initiated", 201);
  },

  async answer(req: AuthRequest, res: Response) {
    const call = await callService.answerCall(req.params.callId, req.user!.id);
    sendSuccess(res, call, "Call answered");
  },

  async end(req: AuthRequest, res: Response) {
    const call = await callService.endCall(req.params.callId, req.user!.id);
    sendSuccess(res, call, "Call ended");
  },

  async getHistory(req: AuthRequest, res: Response) {
    const { page, limit } = req.query as Record<string, string>;
    const result = await callService.getCallHistory(
      req.user!.id,
      parseInt(page ?? "1"),
      parseInt(limit ?? "30")
    );
    const pagination = buildPagination(result.total, parseInt(page ?? "1"), parseInt(limit ?? "30"));
    sendSuccess(res, result.calls, undefined, 200, pagination);
  },
};

// ─────────────────────────────────────────
// NOTIFICATION CONTROLLER
// ─────────────────────────────────────────

export const notificationController = {
  async getNotifications(req: AuthRequest, res: Response) {
    const { page, limit } = req.query as Record<string, string>;
    const result = await notificationService.getNotifications(
      req.user!.id,
      parseInt(page ?? "1"),
      parseInt(limit ?? "30")
    );
    sendSuccess(res, result);
  },

  async markRead(req: AuthRequest, res: Response) {
    const { ids } = req.body;
    await notificationService.markNotificationsRead(req.user!.id, ids);
    sendSuccess(res, null, "Marked as read");
  },
};

// ─────────────────────────────────────────
// SEARCH CONTROLLER
// ─────────────────────────────────────────

export const searchController = {
  async search(req: AuthRequest, res: Response) {
    const { q, type, page, limit } = req.query as Record<string, string>;
    const pageNum = parseInt(page ?? "1");
    const limitNum = parseInt(limit ?? "20");
    const skip = (pageNum - 1) * limitNum;

    const results: Record<string, unknown> = {};

    if (!type || type === "all" || type === "users") {
      const r = await userService.searchUsers(q, req.user!.id, pageNum, limitNum);
      results.users = r.users;
    }

    if (!type || type === "all" || type === "messages") {
      const { prisma } = await import("../config/prisma");
      const messages = await prisma.message.findMany({
        where: {
          content: { contains: q, mode: "insensitive" },
          deleted: false,
          chat: { members: { some: { userId: req.user!.id } } },
        },
        take: limitNum,
        skip,
        include: {
          sender: { include: { profile: true } },
          chat: { select: { id: true, type: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      results.messages = messages;
    }

    if (!type || type === "all" || type === "communities") {
      const r = await communityService.listCommunities(pageNum, limitNum, q);
      results.communities = r.communities;
    }

    sendSuccess(res, results);
  },
};
