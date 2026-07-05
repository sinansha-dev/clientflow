ALTER TABLE "ProjectFile"
  ADD COLUMN IF NOT EXISTS "folderId" UUID,
  ADD COLUMN IF NOT EXISTS "originalFileName" TEXT,
  ADD COLUMN IF NOT EXISTS "storagePath" TEXT,
  ADD COLUMN IF NOT EXISTS "uploadedById" UUID,
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'INTERNAL',
  ADD COLUMN IF NOT EXISTS "downloadCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "deliverableStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE TABLE "ClientPortalAccess" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "clientId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "lastLogin" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'PENDING_INVITATION',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientPortalAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortalFolder" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "parentFolderId" UUID,
  "folderName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "PortalFolder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectFileVersion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "fileId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "fileName" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "storagePath" TEXT NOT NULL,
  "uploadedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectFileVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliverableApproval" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "deliverableId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "comments" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliverableApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RevisionRequest" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "deliverableId" UUID NOT NULL,
  "requestedById" UUID NOT NULL,
  "description" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RevisionRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortalMessage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "authorId" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "internalOnly" BOOLEAN NOT NULL DEFAULT false,
  "edited" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "PortalMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortalMessageAttachment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "messageId" UUID NOT NULL,
  "fileId" UUID,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalMessageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortalActivity" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "userId" UUID,
  "type" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FileDownload" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "fileId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FileDownload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientPortalAccess_clientId_userId_key" ON "ClientPortalAccess"("clientId", "userId");
CREATE INDEX "ClientPortalAccess_clientId_idx" ON "ClientPortalAccess"("clientId");
CREATE INDEX "ClientPortalAccess_userId_idx" ON "ClientPortalAccess"("userId");
CREATE INDEX "ClientPortalAccess_status_idx" ON "ClientPortalAccess"("status");
CREATE UNIQUE INDEX "PortalFolder_projectId_parentFolderId_folderName_key" ON "PortalFolder"("projectId", "parentFolderId", "folderName");
CREATE INDEX "PortalFolder_projectId_idx" ON "PortalFolder"("projectId");
CREATE INDEX "PortalFolder_parentFolderId_idx" ON "PortalFolder"("parentFolderId");
CREATE INDEX "PortalFolder_deletedAt_idx" ON "PortalFolder"("deletedAt");
CREATE UNIQUE INDEX "ProjectFileVersion_fileId_version_key" ON "ProjectFileVersion"("fileId", "version");
CREATE INDEX "ProjectFileVersion_fileId_idx" ON "ProjectFileVersion"("fileId");
CREATE INDEX "ProjectFileVersion_uploadedById_idx" ON "ProjectFileVersion"("uploadedById");
CREATE INDEX "DeliverableApproval_projectId_idx" ON "DeliverableApproval"("projectId");
CREATE INDEX "DeliverableApproval_deliverableId_idx" ON "DeliverableApproval"("deliverableId");
CREATE INDEX "DeliverableApproval_clientId_idx" ON "DeliverableApproval"("clientId");
CREATE INDEX "DeliverableApproval_status_idx" ON "DeliverableApproval"("status");
CREATE INDEX "RevisionRequest_projectId_idx" ON "RevisionRequest"("projectId");
CREATE INDEX "RevisionRequest_deliverableId_idx" ON "RevisionRequest"("deliverableId");
CREATE INDEX "RevisionRequest_requestedById_idx" ON "RevisionRequest"("requestedById");
CREATE INDEX "RevisionRequest_status_idx" ON "RevisionRequest"("status");
CREATE INDEX "PortalMessage_projectId_idx" ON "PortalMessage"("projectId");
CREATE INDEX "PortalMessage_authorId_idx" ON "PortalMessage"("authorId");
CREATE INDEX "PortalMessage_internalOnly_idx" ON "PortalMessage"("internalOnly");
CREATE INDEX "PortalMessage_deletedAt_idx" ON "PortalMessage"("deletedAt");
CREATE INDEX "PortalMessageAttachment_messageId_idx" ON "PortalMessageAttachment"("messageId");
CREATE INDEX "PortalMessageAttachment_fileId_idx" ON "PortalMessageAttachment"("fileId");
CREATE INDEX "PortalActivity_projectId_idx" ON "PortalActivity"("projectId");
CREATE INDEX "PortalActivity_userId_idx" ON "PortalActivity"("userId");
CREATE INDEX "PortalActivity_type_idx" ON "PortalActivity"("type");
CREATE INDEX "FileDownload_fileId_idx" ON "FileDownload"("fileId");
CREATE INDEX "FileDownload_userId_idx" ON "FileDownload"("userId");
CREATE INDEX "FileDownload_createdAt_idx" ON "FileDownload"("createdAt");
CREATE INDEX IF NOT EXISTS "ProjectFile_folderId_idx" ON "ProjectFile"("folderId");
CREATE INDEX IF NOT EXISTS "ProjectFile_uploadedById_idx" ON "ProjectFile"("uploadedById");
CREATE INDEX IF NOT EXISTS "ProjectFile_visibility_idx" ON "ProjectFile"("visibility");
CREATE INDEX IF NOT EXISTS "ProjectFile_deliverableStatus_idx" ON "ProjectFile"("deliverableStatus");
CREATE INDEX IF NOT EXISTS "ProjectFile_deletedAt_idx" ON "ProjectFile"("deletedAt");

ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT "ClientPortalAccess_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT "ClientPortalAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortalFolder" ADD CONSTRAINT "PortalFolder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortalFolder" ADD CONSTRAINT "PortalFolder_parentFolderId_fkey" FOREIGN KEY ("parentFolderId") REFERENCES "PortalFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "PortalFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectFileVersion" ADD CONSTRAINT "ProjectFileVersion_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "ProjectFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectFileVersion" ADD CONSTRAINT "ProjectFileVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliverableApproval" ADD CONSTRAINT "DeliverableApproval_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliverableApproval" ADD CONSTRAINT "DeliverableApproval_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "ProjectFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliverableApproval" ADD CONSTRAINT "DeliverableApproval_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevisionRequest" ADD CONSTRAINT "RevisionRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevisionRequest" ADD CONSTRAINT "RevisionRequest_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "ProjectFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevisionRequest" ADD CONSTRAINT "RevisionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PortalMessage" ADD CONSTRAINT "PortalMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortalMessage" ADD CONSTRAINT "PortalMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PortalMessageAttachment" ADD CONSTRAINT "PortalMessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "PortalMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortalMessageAttachment" ADD CONSTRAINT "PortalMessageAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "ProjectFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PortalActivity" ADD CONSTRAINT "PortalActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortalActivity" ADD CONSTRAINT "PortalActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FileDownload" ADD CONSTRAINT "FileDownload_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "ProjectFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileDownload" ADD CONSTRAINT "FileDownload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
