/**
 * Story Cleanup Cron Job
 * Run this on a schedule (e.g., every hour via cron or a job scheduler).
 *
 * Example crontab entry (every hour):
 *   0 * * * * cd /app && node dist/jobs/cleanup-stories.js >> /var/log/cleanup.log 2>&1
 *
 * Or use node-cron inside the main process (see bottom of file).
 */

import { purgeExpiredStories } from "../services/story.service";
import { logger } from "../utils/logger";

export async function runStoryCleanup() {
  try {
    const count = await purgeExpiredStories();
    if (count > 0) {
      logger.info(`Story cleanup: removed ${count} expired stories`);
    }
  } catch (err) {
    logger.error("Story cleanup failed", err);
  }
}

// Run immediately if called directly
if (require.main === module) {
  import("../config/env").then(() => {
    runStoryCleanup().then(() => process.exit(0));
  });
}
