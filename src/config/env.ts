import dotenv from "dotenv";
dotenv.config();

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  env: optional("NODE_ENV", "development"),
  port: parseInt(optional("PORT", "3000"), 10),
  apiVersion: optional("API_VERSION", "v1"),
  frontendUrl: optional("FRONTEND_URL", "http://localhost:8081"),

  db: {
    url: required("DATABASE_URL"),
  },

  supabase: {
    url: required("SUPABASE_URL"),
    anonKey: required("SUPABASE_ANON_KEY"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    buckets: {
      avatars: optional("SUPABASE_BUCKET_AVATARS", "avatars"),
      covers: optional("SUPABASE_BUCKET_COVERS", "covers"),
      messages: optional("SUPABASE_BUCKET_MESSAGES", "messages"),
      stories: optional("SUPABASE_BUCKET_STORIES", "stories"),
      documents: optional("SUPABASE_BUCKET_DOCUMENTS", "documents"),
      thumbnails: optional("SUPABASE_BUCKET_THUMBNAILS", "thumbnails"),
    },
  },

  jwt: {
    secret: required("JWT_SECRET"),
    accessExpiresIn: optional("JWT_ACCESS_EXPIRES_IN", "15m"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    refreshExpiresIn: optional("JWT_REFRESH_EXPIRES_IN", "30d"),
  },

  firebase: {
    projectId: process.env["FIREBASE_PROJECT_ID"],
    privateKey: process.env["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n"),
    clientEmail: process.env["FIREBASE_CLIENT_EMAIL"],
  },

  rateLimit: {
    windowMs: parseInt(optional("RATE_LIMIT_WINDOW_MS", "900000"), 10),
    max: parseInt(optional("RATE_LIMIT_MAX", "100"), 10),
    authMax: parseInt(optional("AUTH_RATE_LIMIT_MAX", "20"), 10),
  },

  upload: {
    maxFileSizeMb: parseInt(optional("MAX_FILE_SIZE_MB", "100"), 10),
    maxImageSizeMb: parseInt(optional("MAX_IMAGE_SIZE_MB", "20"), 10),
    maxVideoSizeMb: parseInt(optional("MAX_VIDEO_SIZE_MB", "100"), 10),
    maxAudioSizeMb: parseInt(optional("MAX_AUDIO_SIZE_MB", "25"), 10),
    maxDocumentSizeMb: parseInt(optional("MAX_DOCUMENT_SIZE_MB", "50"), 10),
  },

  story: {
    expiryHours: parseInt(optional("STORY_EXPIRY_HOURS", "24"), 10),
  },

  log: {
    level: optional("LOG_LEVEL", "info"),
  },
};
