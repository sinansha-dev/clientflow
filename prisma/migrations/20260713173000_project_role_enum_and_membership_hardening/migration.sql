-- Replace free-text project roles with a constrained enum and ensure every primary manager is a member.
CREATE TYPE "ProjectRole" AS ENUM (
  'PROJECT_MANAGER',
  'LEAD_DEVELOPER',
  'DEVELOPER',
  'DESIGNER',
  'QA',
  'VIEWER'
);

ALTER TABLE "ProjectMember" ADD COLUMN "projectRoleNew" "ProjectRole";

UPDATE "ProjectMember"
SET "projectRoleNew" = CASE
  WHEN "projectRole" IN ('PROJECT_MANAGER', 'Project Manager') THEN 'PROJECT_MANAGER'::"ProjectRole"
  WHEN "projectRole" IN ('LEAD_DEVELOPER', 'Lead Developer') THEN 'LEAD_DEVELOPER'::"ProjectRole"
  WHEN "projectRole" IN ('DESIGNER', 'Designer', 'UI/UX Designer') THEN 'DESIGNER'::"ProjectRole"
  WHEN "projectRole" IN ('QA', 'QA Tester') THEN 'QA'::"ProjectRole"
  WHEN "projectRole" IN ('VIEWER', 'Viewer') THEN 'VIEWER'::"ProjectRole"
  ELSE 'DEVELOPER'::"ProjectRole"
END;

ALTER TABLE "ProjectMember" ALTER COLUMN "projectRoleNew" SET NOT NULL;
ALTER TABLE "ProjectMember" DROP COLUMN "projectRole";
ALTER TABLE "ProjectMember" RENAME COLUMN "projectRoleNew" TO "projectRole";

INSERT INTO "ProjectMember" (
  "id",
  "projectId",
  "userId",
  "projectRole",
  "joinedAt",
  "assignedById",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  p."id",
  p."projectManagerId",
  'PROJECT_MANAGER'::"ProjectRole",
  p."createdAt",
  CASE WHEN assigner."id" IS NOT NULL THEN p."createdBy" ELSE NULL END,
  p."createdAt",
  NOW()
FROM "Project" p
LEFT JOIN "User" assigner ON assigner."id" = p."createdBy"
WHERE p."deletedAt" IS NULL
ON CONFLICT ("projectId", "userId")
DO UPDATE SET "projectRole" = 'PROJECT_MANAGER'::"ProjectRole";
