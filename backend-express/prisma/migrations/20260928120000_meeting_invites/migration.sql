-- Zoom voice / video calls: a notification type for meeting invites, and a link column
-- (the Zoom join URL) on notifications.
ALTER TYPE "NotificationType" ADD VALUE 'MEETING_INVITE';

ALTER TABLE "notifications" ADD COLUMN "actionUrl" TEXT;
