UPDATE "AuditLog" AS audit
SET "actorEmail" = "User"."email"
FROM "User"
WHERE audit."actorUserId" = "User"."id"
  AND audit."actorEmail" IS NULL;
