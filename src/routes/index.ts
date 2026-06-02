import { Router } from "express";
import { authenticate } from "../middleware";
import { validate } from "../middleware";
import { authRateLimit, messageRateLimit, uploadImage, uploadAny } from "../middleware";
import * as authCtrl from "../controllers/auth.controller";
import {
  userController as userCtrl,
  chatController as chatCtrl,
  messageController as msgCtrl,
  storyController as storyCtrl,
  mediaController as mediaCtrl,
  communityController as communityCtrl,
  callController as callCtrl,
  notificationController as notifCtrl,
  searchController as searchCtrl,
} from "../controllers/index";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  updateProfileSchema,
  updateFcmTokenSchema,
  createDirectChatSchema,
  createGroupChatSchema,
  updateChatMemberSchema,
  sendMessageSchema,
  editMessageSchema,
  addReactionSchema,
  forwardMessageSchema,
  createStorySchema,
  storyReactionSchema,
  createCommunitySchema,
  announcementSchema,
  initiateCallSchema,
  reportUserSchema,
  updateSettingsSchema,
  searchSchema,
  paginationSchema,
} from "../validations";

const router = Router();

// ─────────────────────────────────────────
// AUTH  /api/v1/auth
// ─────────────────────────────────────────

const auth = Router();
auth.post("/register", authRateLimit, validate(registerSchema), authCtrl.register);
auth.post("/login", authRateLimit, validate(loginSchema), authCtrl.login);
auth.post("/refresh", validate(refreshTokenSchema), authCtrl.refresh);
auth.post("/logout", authenticate, authCtrl.logout);
auth.post("/forgot-password", authRateLimit, validate(forgotPasswordSchema), authCtrl.forgotPassword);
auth.post("/reset-password", authRateLimit, authCtrl.resetPassword);
auth.get("/me", authenticate, authCtrl.me);

router.use("/auth", auth);

// ─────────────────────────────────────────
// USERS  /api/v1/users
// ─────────────────────────────────────────

const users = Router();
users.use(authenticate);

users.get("/search", searchCtrl.search);                         // search users
users.get("/:userId", userCtrl.getProfile);
users.get("/username/:username", userCtrl.getProfileByUsername);
users.patch("/me", validate(updateProfileSchema), userCtrl.updateProfile);
users.post("/me/avatar", uploadImage.single("avatar"), userCtrl.uploadAvatar);
users.patch("/me/fcm-token", validate(updateFcmTokenSchema), userCtrl.updateFcmToken);
users.get("/me/settings", userCtrl.getSettings);
users.patch("/me/settings", validate(updateSettingsSchema), userCtrl.updateSettings);
users.get("/me/blocked", userCtrl.getBlockedUsers);
users.post("/block", userCtrl.blockUser);
users.delete("/block/:userId", userCtrl.unblockUser);
users.post("/report", validate(reportUserSchema), userCtrl.reportUser);

router.use("/users", users);

// ─────────────────────────────────────────
// CHATS  /api/v1/chats
// ─────────────────────────────────────────

const chats = Router();
chats.use(authenticate);

chats.get("/", chatCtrl.getChats);
chats.post("/direct", validate(createDirectChatSchema), chatCtrl.createDirectChat);
chats.post("/group", validate(createGroupChatSchema), chatCtrl.createGroupChat);
chats.get("/:chatId", chatCtrl.getChatById);
chats.patch("/:chatId/member", validate(updateChatMemberSchema), chatCtrl.updateChatMember);
chats.delete("/:chatId/leave", chatCtrl.leaveChat);
chats.post("/:chatId/read", chatCtrl.markRead);
chats.get("/:chatId/media", chatCtrl.getSharedMedia);

// Messages nested under chats
chats.get("/:chatId/messages", msgCtrl.getMessages);
chats.post("/:chatId/messages", messageRateLimit, validate(sendMessageSchema), msgCtrl.sendMessage);
chats.post("/:chatId/messages/read", msgCtrl.markRead);

router.use("/chats", chats);

// ─────────────────────────────────────────
// MESSAGES  /api/v1/messages
// ─────────────────────────────────────────

const messages = Router();
messages.use(authenticate);

messages.patch("/:messageId", validate(editMessageSchema), msgCtrl.editMessage);
messages.delete("/:messageId", msgCtrl.deleteMessage);
messages.post("/:messageId/reactions", validate(addReactionSchema), msgCtrl.addReaction);
messages.delete("/:messageId/reactions", msgCtrl.removeReaction);
messages.post("/:messageId/forward", validate(forwardMessageSchema), msgCtrl.forwardMessage);
messages.post("/:messageId/star", msgCtrl.starMessage);
messages.delete("/:messageId/star", msgCtrl.unstarMessage);
messages.get("/starred", msgCtrl.getStarredMessages);

router.use("/messages", messages);

// ─────────────────────────────────────────
// STORIES  /api/v1/stories
// ─────────────────────────────────────────

const stories = Router();
stories.use(authenticate);

stories.get("/feed", storyCtrl.getFeed);
stories.get("/mine", storyCtrl.getMyStories);
stories.post("/", validate(createStorySchema), storyCtrl.createStory);
stories.post("/:storyId/view", storyCtrl.viewStory);
stories.post("/:storyId/react", validate(storyReactionSchema), storyCtrl.reactToStory);
stories.delete("/:storyId", storyCtrl.deleteStory);

router.use("/stories", stories);

// ─────────────────────────────────────────
// MEDIA  /api/v1/media
// ─────────────────────────────────────────

const media = Router();
media.use(authenticate);

media.post("/upload", uploadAny.single("file"), mediaCtrl.uploadMedia);
media.post("/upload/story", uploadAny.single("file"), mediaCtrl.uploadStoryMedia);
media.delete("/:mediaId", mediaCtrl.deleteMedia);

router.use("/media", media);

// ─────────────────────────────────────────
// COMMUNITIES  /api/v1/communities
// ─────────────────────────────────────────

const communities = Router();
communities.use(authenticate);

communities.get("/", communityCtrl.list);
communities.post("/", validate(createCommunitySchema), communityCtrl.create);
communities.get("/:communityId", communityCtrl.getById);
communities.post("/:communityId/join", communityCtrl.join);
communities.delete("/:communityId/leave", communityCtrl.leave);
communities.post("/:communityId/announcements", validate(announcementSchema), communityCtrl.createAnnouncement);

router.use("/communities", communities);

// ─────────────────────────────────────────
// CALLS  /api/v1/calls
// ─────────────────────────────────────────

const calls = Router();
calls.use(authenticate);

calls.get("/history", validate(paginationSchema, "query"), callCtrl.getHistory);
calls.post("/", validate(initiateCallSchema), callCtrl.initiate);
calls.post("/:callId/answer", callCtrl.answer);
calls.post("/:callId/end", callCtrl.end);

router.use("/calls", calls);

// ─────────────────────────────────────────
// NOTIFICATIONS  /api/v1/notifications
// ─────────────────────────────────────────

const notifications = Router();
notifications.use(authenticate);

notifications.get("/", notifCtrl.getNotifications);
notifications.post("/read", notifCtrl.markRead);

router.use("/notifications", notifications);

// ─────────────────────────────────────────
// SEARCH  /api/v1/search
// ─────────────────────────────────────────

const search = Router();
search.use(authenticate);
search.get("/", validate(searchSchema, "query"), searchCtrl.search);

router.use("/search", search);

// ─────────────────────────────────────────
// HEALTH  /api/v1/health
// ─────────────────────────────────────────

router.get("/health", (_req, res) => {
  res.json({ success: true, status: "ok", timestamp: new Date().toISOString() });
});

export default router;
