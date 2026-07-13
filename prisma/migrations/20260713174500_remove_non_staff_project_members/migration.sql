-- Admin access is global and clients use the portal. Project responsibilities
-- belong only to Staff accounts.
DELETE FROM "ProjectMember" AS pm
USING "User" AS u
WHERE pm."userId" = u.id
  AND u.role <> 'STAFF';
