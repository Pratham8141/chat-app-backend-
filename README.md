# Message Hub — Backend API

Production-ready Node.js + Express + TypeScript backend for the Message Hub React Native app.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| Framework | Express.js + TypeScript |
| Database | PostgreSQL via Supabase |
| ORM | Prisma |
| Auth | JWT + Refresh Tokens |
| Realtime | Socket.IO |
| Storage | Supabase Storage |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| Validation | Zod |
| Security | Helmet, CORS, Rate Limiting |

---

## Project Structure

```
src/
├── config/
│   ├── env.ts          # Environment variable loader
│   ├── prisma.ts       # Prisma client singleton
│   ├── supabase.ts     # Supabase admin + public clients
│   └── firebase.ts     # Firebase Admin SDK
├── controllers/
│   ├── auth.controller.ts
│   ├── group.controller.ts
│   └── index.ts        # All other controllers
├── middleware/
│   └── index.ts        # Auth, validation, rate limit, upload, error
├── routes/
│   └── index.ts        # All API routes
├── services/
│   ├── auth.service.ts
│   ├── chat.service.ts
│   ├── message.service.ts
│   ├── story.service.ts
│   ├── media.service.ts
│   ├── user.service.ts
│   ├── group.service.ts
│   ├── community.service.ts
│   ├── call.service.ts
│   └── notification.service.ts
├── socket/
│   └── index.ts        # Socket.IO server + all real-time events
├── types/
│   └── index.ts        # TypeScript types
├── utils/
│   ├── logger.ts       # Winston logger
│   ├── response.ts     # API helpers + AppError
│   └── jwt.ts          # JWT sign/verify helpers
├── validations/
│   └── index.ts        # All Zod schemas
├── jobs/
│   └── cleanup-stories.ts  # Story expiry cron job
└── index.ts            # App entry point
prisma/
├── schema.prisma       # Complete database schema
└── seed.ts             # Demo seed data
```

---

## Quick Start

### 1. Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Firebase](https://firebase.google.com) project (for push notifications, optional)

### 2. Install

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your Supabase, Firebase, and JWT credentials
```

### 4. Set up Supabase Storage buckets

In your Supabase dashboard → Storage, create these buckets (set to **public**):

- `avatars`
- `covers`
- `messages`
- `stories`
- `documents`
- `thumbnails`

### 5. Push database schema

```bash
npm run db:generate
npm run db:push
```

### 6. (Optional) Seed demo data

```bash
npm run db:seed
```

### 7. Run in development

```bash
npm run dev
```

API available at: `http://localhost:3000/api/v1`

---

## API Reference

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication
All protected routes require:
```
Authorization: Bearer <accessToken>
```

---

### Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Logout (revoke session) |
| POST | `/auth/forgot-password` | Send password reset email |
| POST | `/auth/reset-password` | Reset password with token |
| GET  | `/auth/me` | Get current user |

### User Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/:userId` | Get user profile |
| GET | `/users/username/:username` | Get profile by username |
| PATCH | `/users/me` | Update my profile |
| POST | `/users/me/avatar` | Upload avatar |
| PATCH | `/users/me/fcm-token` | Update FCM token |
| GET | `/users/me/settings` | Get settings |
| PATCH | `/users/me/settings` | Update settings |
| POST | `/users/block` | Block user |
| DELETE | `/users/block/:userId` | Unblock user |
| GET | `/users/me/blocked` | List blocked users |
| POST | `/users/report` | Report user |

### Chat Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/chats` | Get all chats |
| POST | `/chats/direct` | Create/get direct chat |
| POST | `/chats/group` | Create group chat |
| GET | `/chats/:chatId` | Get chat detail |
| PATCH | `/chats/:chatId/member` | Update pin/mute/archive |
| DELETE | `/chats/:chatId/leave` | Leave chat |
| POST | `/chats/:chatId/read` | Mark chat as read |
| GET | `/chats/:chatId/media` | Shared media gallery |
| GET | `/chats/:chatId/messages` | Get messages (paginated) |
| POST | `/chats/:chatId/messages` | Send message |
| POST | `/chats/:chatId/messages/read` | Mark messages as read |

### Message Endpoints

| Method | Path | Description |
|--------|------|-------------|
| PATCH | `/messages/:messageId` | Edit message |
| DELETE | `/messages/:messageId` | Delete message |
| POST | `/messages/:messageId/reactions` | Add reaction |
| DELETE | `/messages/:messageId/reactions` | Remove reaction |
| POST | `/messages/:messageId/forward` | Forward message |
| POST | `/messages/:messageId/star` | Star message |
| DELETE | `/messages/:messageId/star` | Unstar message |
| GET | `/messages/starred` | Get starred messages |

### Story Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stories/feed` | Get stories feed |
| GET | `/stories/mine` | Get my stories |
| POST | `/stories` | Create story |
| POST | `/stories/:storyId/view` | View story |
| POST | `/stories/:storyId/react` | React to story |
| DELETE | `/stories/:storyId` | Delete story |

### Media Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/media/upload` | Upload media file |
| POST | `/media/upload/story` | Upload story media |
| DELETE | `/media/:mediaId` | Delete media |

### Community Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/communities` | List communities |
| POST | `/communities` | Create community |
| GET | `/communities/:communityId` | Get community detail |
| POST | `/communities/:communityId/join` | Join community |
| DELETE | `/communities/:communityId/leave` | Leave community |
| POST | `/communities/:communityId/announcements` | Post announcement |

### Call Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/calls` | Initiate call |
| POST | `/calls/:callId/answer` | Answer call |
| POST | `/calls/:callId/end` | End call |
| GET | `/calls/history` | Call history |

### Notification Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications` | Get notifications |
| POST | `/notifications/read` | Mark as read |

### Search

| Method | Path | Description |
|--------|------|-------------|
| GET | `/search?q=term&type=all` | Global search |

---

## Socket.IO Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `user:ping` | — | Heartbeat |
| `user:get_online` | — | Request online user list |
| `chat:typing` | `{ chatId }` | Start typing |
| `chat:stop_typing` | `{ chatId }` | Stop typing |
| `chat:recording` | `{ chatId }` | Start voice recording |
| `chat:stop_recording` | `{ chatId }` | Stop recording |
| `message:send` | `{ chatId, content, type, mediaUrl, replyToId, clientMsgId }` | Send message |
| `message:edit` | `{ messageId, content, chatId }` | Edit message |
| `message:delete` | `{ messageId, chatId }` | Delete message |
| `message:react` | `{ messageId, chatId, emoji }` | Add reaction |
| `message:unreact` | `{ messageId, chatId }` | Remove reaction |
| `message:seen` | `{ chatId, messageIds[] }` | Mark as seen |
| `call:offer` | `{ callId, receiverId, signal, type, callerProfile }` | Initiate WebRTC call |
| `call:answer` | `{ callId, signal, callerId }` | Answer call |
| `call:ice_candidate` | `{ callId, targetUserId, candidate }` | ICE exchange |
| `call:end` | `{ callId }` | End call |
| `call:reject` | `{ callId, callerId }` | Reject call |
| `story:view` | `{ storyId, authorId }` | View story |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `user:online` | `{ userId }` | User came online |
| `user:offline` | `{ userId, lastSeen }` | User went offline |
| `user:online_list` | `{ userIds[] }` | All online users |
| `user:pong` | — | Heartbeat response |
| `chat:typing` | `{ chatId, userId, isTyping }` | Typing indicator |
| `chat:recording` | `{ chatId, userId, isRecording }` | Recording indicator |
| `message:receive` | `Message object` | New message |
| `message:delivered` | `{ messageId, chatId, clientMsgId }` | Delivery receipt |
| `message:edited` | `Message object` | Message edited |
| `message:deleted` | `{ messageId, chatId }` | Message deleted |
| `message:reaction_added` | `{ messageId, chatId, userId, emoji }` | Reaction added |
| `message:reaction_removed` | `{ messageId, chatId, userId }` | Reaction removed |
| `message:seen` | `{ chatId, userId, messageIds[], seenAt }` | Read receipt |
| `call:incoming` | `{ callId, callerId, callerProfile, type, signal }` | Incoming call |
| `call:answered` | `{ callId, signal, answeredBy }` | Call answered |
| `call:rejected` | `{ callId, rejectedBy }` | Call rejected |
| `call:ended` | `{ callId, endedBy }` | Call ended |
| `call:unavailable` | `{ callId }` | Receiver offline |
| `call:ice_candidate` | `{ callId, candidate, from }` | ICE candidate |
| `story:viewed` | `{ storyId, viewerId }` | Story viewed |
| `notification:new` | `Notification object` | New notification |

---

## Deployment

### Render

1. Create a new **Web Service** on [render.com](https://render.com)
2. Connect your GitHub repository
3. Set build command: `npm install && npm run db:generate && npm run build`
4. Set start command: `npm start`
5. Add all environment variables from `.env.example`
6. Add a **PostgreSQL** database add-on (or use Supabase URL)

### Railway

1. Install Railway CLI: `npm i -g @railway/cli`
2. `railway login && railway init`
3. `railway add` → select PostgreSQL
4. Set env vars: `railway variables set KEY=value ...`
5. `railway up`

### VPS (Ubuntu)

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone repo
git clone <your-repo> /app/message-hub-backend
cd /app/message-hub-backend

# Install & build
npm install
npm run db:generate
npm run build

# Set environment
cp .env.example .env
nano .env  # fill in values

# Run with PM2
npm install -g pm2
pm2 start dist/index.js --name message-hub-api
pm2 startup && pm2 save

# Nginx reverse proxy (optional)
# proxy_pass http://localhost:3000;
```

---

## Environment Variables Reference

See `.env.example` for the full list. Required vars:

- `DATABASE_URL` — Supabase PostgreSQL connection string
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
- `JWT_SECRET` — At least 32 random characters
- `JWT_REFRESH_SECRET` — At least 32 random characters (different from above)

Optional (push notifications):
- `FIREBASE_PROJECT_ID`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CLIENT_EMAIL`

---

## Frontend Integration (React Native)

```typescript
// api.ts
const BASE_URL = "http://localhost:3000/api/v1";

// Socket connection
import { io } from "socket.io-client";
const socket = io("http://localhost:3000", {
  auth: { token: accessToken },
  transports: ["websocket"],
});
```

Demo accounts after seeding:
- `alice@demo.com` / `Password123!`
- `bob@demo.com` / `Password123!`
- `carol@demo.com` / `Password123!`
