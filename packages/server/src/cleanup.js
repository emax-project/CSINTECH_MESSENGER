import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { prisma } from './db.js';
import { UPLOAD_DIR } from './upload.js';
import { archiveMessage } from './lib/messageArchive.js';
import { getSecurityPolicy } from './lib/securityPolicy.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function removeUploadFile(fileUrl) {
  if (!fileUrl) return;
  const filename = path.basename(fileUrl);
  const filePath = path.join(UPLOAD_DIR, filename);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error(`[cleanup] 파일 삭제 실패 ${filename}:`, err.message);
  }
}

/**
 * 관리자가 정한 보관 기간(retention.messageDays)이 지난 대화·원본·첨부 파일을 서버에서도 지운다.
 * 0이면 영구 보관이라 아무것도 지우지 않는다.
 */
export async function purgeExpiredByRetention(now = new Date()) {
  const { retention } = await getSecurityPolicy();
  if (!retention.messageDays) return { archives: 0, messages: 0 };
  const cutoff = new Date(now.getTime() - retention.messageDays * DAY_MS);
  let archives = 0;
  let messages = 0;

  for (;;) {
    const batch = await prisma.messageArchive.findMany({
      where: { messageCreatedAt: { lt: cutoff } },
      select: { id: true, fileUrl: true },
      take: 500,
    });
    if (batch.length === 0) break;
    for (const a of batch) removeUploadFile(a.fileUrl);
    await prisma.messageArchive.deleteMany({ where: { id: { in: batch.map((a) => a.id) } } });
    archives += batch.length;
  }

  for (;;) {
    const batch = await prisma.message.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true, fileUrl: true },
      take: 500,
    });
    if (batch.length === 0) break;
    const ids = batch.map((m) => m.id);
    // 답장 관계가 삭제를 막지 않도록 먼저 끊는다
    await prisma.message.updateMany({ where: { replyToId: { in: ids } }, data: { replyToId: null } });
    for (const m of batch) removeUploadFile(m.fileUrl);
    await prisma.message.deleteMany({ where: { id: { in: ids } } });
    messages += batch.length;
  }
  return { archives, messages };
}

export function startCleanupJob() {
  // 보관 기간이 지난 감사 로그·대화·원본 정리 (매일 03:10). 기간은 관리자 설정(0 = 영구).
  cron.schedule('10 3 * * *', async () => {
    try {
      const { retention } = await getSecurityPolicy();
      if (retention.fileAuditDays) {
        const cutoff = new Date(Date.now() - retention.fileAuditDays * DAY_MS);
        const { count } = await prisma.fileTransferAudit.deleteMany({ where: { createdAt: { lt: cutoff } } });
        if (count > 0) console.log(`[cleanup] 파일 전송 감사 로그 ${count}건 삭제`);
      }
      if (retention.auditAccessDays) {
        const cutoff = new Date(Date.now() - retention.auditAccessDays * DAY_MS);
        const { count } = await prisma.auditAccessLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
        if (count > 0) console.log(`[cleanup] 감사 조회 이력 ${count}건 삭제`);
      }
      const purged = await purgeExpiredByRetention();
      if (purged.archives || purged.messages) {
        console.log(`[cleanup] 보관 기간 경과: 원본 ${purged.archives}건, 대화 ${purged.messages}건 삭제`);
      }
    } catch (err) {
      console.error('[cleanup] 보관 기간 정리 실패:', err);
    }
  });

  // 만료된 그룹웨어 SSO 토큰 정리 (매시 5분) — 유효 시간이 60초라 1시간 지난 건 모두 지워도 된다
  cron.schedule('5 * * * *', async () => {
    try {
      const { count } = await prisma.ssoToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } } });
      if (count > 0) console.log(`[cleanup] SSO 토큰 ${count}건 삭제`);
    } catch (err) {
      console.error('[cleanup] SSO 토큰 정리 실패:', err);
    }
  });

  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log('[cleanup] Starting expired file cleanup...');
    try {
      const now = new Date();

      const expiredMessages = await prisma.message.findMany({
        where: {
          fileExpiresAt: { lte: now },
          fileUrl: { not: null },
        },
      });

      if (expiredMessages.length === 0) {
        console.log('[cleanup] No expired files found.');
        return;
      }

      console.log(`[cleanup] Found ${expiredMessages.length} expired file(s).`);

      for (const msg of expiredMessages) {
        // 사용자에게는 만료로 보이지만 서버에는 파일과 원본을 남긴다(삭제는 보관 기간이 지난 뒤)
        await prisma.$transaction(async (tx) => {
          await archiveMessage(msg, 'EXPIRED', tx);
          await tx.message.update({
            where: { id: msg.id },
            data: {
              fileUrl: null,
              fileName: null,
              fileSize: null,
              fileMimeType: null,
              fileExpiresAt: null,
              content: '[파일 만료됨]',
            },
          });
        });
      }

      console.log(`[cleanup] Cleanup complete. Processed ${expiredMessages.length} message(s).`);
    } catch (err) {
      console.error('[cleanup] Error during cleanup:', err);
    }
  });

  console.log('[cleanup] File cleanup job scheduled (every hour).');
}
