import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../../config.js';
import { prisma } from '../../db.js';
import { badRequest, forbidden, notFound } from '../../utils/httpError.js';
import { recordAudit } from '../audit-log/audit-log.service.js';
import { assertAccessible, assertProjectPermission } from '../projects/projects.service.js';

// Files are stored on local disk under a random name (never the user's file name, which
// could contain "../" and escape the folder). The original name is kept only in the database.
const UPLOADS_DIR = config.uploadsDir;
mkdirSync(UPLOADS_DIR, { recursive: true });

const MAX_SIZE_BYTES = config.maxUploadSizeMb * 1024 * 1024;

// Executables and scripts are rejected outright.
const ALLOWED_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'md', 'csv', 'json', 'zip', 'fig',
]);

// multer parses multipart/form-data uploads. memoryStorage keeps the file in req.file.buffer
// until we have validated it; `limits` makes multer abort oversized uploads early.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SIZE_BYTES } });

const UPLOADED_BY = { select: { id: true, firstName: true, lastName: true, avatarColor: true } };

// multer decodes the original file name as latin1; convert it back so Hebrew names survive.
const decodeFileName = (name) => Buffer.from(name, 'latin1').toString('utf8');

function extensionOf(fileName) {
  const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw badRequest(`File type ".${ext || 'unknown'}" is not allowed`);
  }
  return ext;
}

// The task must be in a project the actor can access - and, when `permission` is given,
// they must hold that permission in that project.
async function requireAccessibleTask(actor, taskId, permission) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, project: { organizationId: actor.organizationId } },
  });
  if (!task) throw notFound('Task not found');
  if (permission) await assertProjectPermission(actor, task.projectId, permission);
  else await assertAccessible(actor, task.projectId);
  return task;
}

async function requireAccessibleAttachment(actor, attachmentId) {
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, task: { project: { organizationId: actor.organizationId } } },
    include: { task: true },
  });
  if (!attachment?.task) throw notFound('Attachment not found');
  const project = await assertAccessible(actor, attachment.task.projectId);
  return { attachment, canModerate: project.can('content.moderate') };
}

// ---------- Routes ----------
// Mounted at /api:
//   /api/tasks/:taskId/attachments      (list, upload)
//   /api/attachments/:id/download       (download)
//   /api/attachments/:id                (delete)

export const attachmentsRouter = Router();

attachmentsRouter.get('/tasks/:taskId/attachments', async (req, res) => {
  await requireAccessibleTask(req.user, req.params.taskId);
  res.json(
    await prisma.attachment.findMany({
      where: { taskId: req.params.taskId },
      orderBy: { uploadedAt: 'desc' },
      include: { uploadedBy: UPLOADED_BY },
    }),
  );
});

// The form field must be called "file".
attachmentsRouter.post('/tasks/:taskId/attachments', upload.single('file'), async (req, res) => {
  const actor = req.user;
  const taskId = req.params.taskId;
  const file = req.file;
  if (!file) throw badRequest('No file was uploaded');

  const fileName = decodeFileName(file.originalname);
  const ext = extensionOf(fileName);
  const task = await requireAccessibleTask(actor, taskId, 'attachments.upload'); // check before writing to disk

  const storageKey = `${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOADS_DIR, storageKey), file.buffer);

  const attachment = await prisma.attachment.create({
    data: {
      taskId,
      fileName,
      fileType: file.mimetype,
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      storageKey,
      uploadedById: actor.userId,
    },
    include: { uploadedBy: UPLOADED_BY },
  });

  await prisma.activityEntry.create({
    data: { taskId, actorId: actor.userId, action: 'ATTACHMENT_UPLOADED', detail: `Uploaded "${fileName}"` },
  });
  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: 'ATTACHMENT_UPLOADED',
    entityType: 'Attachment',
    entityId: attachment.id,
    projectId: task.projectId,
    taskId,
    metadata: { fileName },
  });

  res.status(201).json(attachment);
});

// Downloads need the Authorization header, so the frontend fetches this as a blob.
attachmentsRouter.get('/attachments/:id/download', async (req, res) => {
  const { attachment } = await requireAccessibleAttachment(req.user, req.params.id);

  let body;
  try {
    body = await readFile(path.join(UPLOADS_DIR, attachment.storageKey));
  } catch {
    throw notFound('The stored file is missing');
  }

  res.setHeader('Content-Type', attachment.fileType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`);
  res.send(body);
});

// The uploader, or the project's manager, can delete an attachment.
attachmentsRouter.delete('/attachments/:id', async (req, res) => {
  const { attachment, canModerate } = await requireAccessibleAttachment(req.user, req.params.id);
  if (attachment.uploadedById !== req.user.userId && !canModerate) {
    throw forbidden('You can only delete attachments you uploaded');
  }

  await prisma.attachment.delete({ where: { id: attachment.id } });
  await unlink(path.join(UPLOADS_DIR, attachment.storageKey)).catch(() => undefined);
  res.json(attachment);
});
