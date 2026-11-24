/**
 * 감사 조회: 감사 권한자만 사용자·기간·대화방을 지정해 대화와 첨부 파일(삭제·만료로 숨겨진 원본 포함)을
 * 조회하고 내보낸다. 조회·내보내기·파일 내려받기는 모두 AuditAccessLog에 남는다.
 */
import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';
import { assertAuditor } from '../lib/admin.js';
import { UPLOAD_DIR } from '../upload.js';
import { sendStoredFile } from '../lib/storedFile.js';
import { isEncryptionEnabled } from '../lib/dataCrypto.js';
import {
  AUDIT_CSV_HEADER,
  AUDIT_EXPORT_MAX,
  auditParamsForLog,
  auditRowToCsv,
  parseAuditFilter,
  parseAuditLimit,
} from '../lib/auditQuery.js';

export const auditRouter = Router();
auditRouter.use(authMiddleware);

const STATUS_LABEL = { NORMAL: '정상', DELETED: '삭제됨', EXPIRED: '파일 만료', ORPHAN: '계정·대화방 삭제 등' };

function toNumber(v) {
  return typeof v === 'bigint' ? Number(v) : v ?? null;
}

async function logAccess(userId, action, params, resultCount) {
  await prisma.auditAccessLog.create({ data: { userId, action, params, resultCount } });
}

function archiveWhere(filter, before) {
  const where = { messageCreatedAt: { gte: filter.from, lte: filter.to } };
  if (before) where.messageCreatedAt = { ...where.messageCreatedAt, lt: before };
  if (filter.roomId) where.roomId = filter.roomId;
  if (filter.userId) where.senderId = filter.userId;
  return where;
}

/**
 * 조건에 맞는 대화(현재 메시지 + 서버 보존 원본)를 최근순으로 limit개까지 모은다.
 * 내용이 암호화되어 있으면 DB에서 직접 찾을 수 없으므로 풀어서 비교한다(최대 5만 건까지 살핀다).
 */
async function queryAuditRows(filter, limit, before) {
  if (!filter.q || !isEncryptionEnabled()) return queryAuditRowsDb(filter, limit, before);
  const needle = filter.q.toLowerCase();
  const found = [];
  let cursor = before;
  let scanned = 0;
  let more = false;
  while (found.length <= limit && scanned < 50000) {
    const { rows, nextBefore } = await queryAuditRowsDb({ ...filter, q: '' }, 1000, cursor);
    scanned += rows.length;
    for (const row of rows) {
      if (`${row.content}\n${row.originalContent ?? ''}`.toLowerCase().includes(needle)) found.push(row);
    }
    if (!nextBefore) { more = false; break; }
    cursor = nextBefore;
    more = true;
  }
  const page = found.slice(0, limit);
  const overflow = found.length > limit;
  // 더 찾을 게 있으면 다음 조회가 이어서 살피도록 위치를 알려 준다(넘친 경우엔 보여 준 마지막 대화 다음부터)
  const nextBefore = overflow ? page[page.length - 1].createdAt : more ? cursor : null;
  return { rows: page, nextBefore };
}

async function queryAuditRowsDb(filter, limit, before) {
  const liveWhere = { createdAt: { gte: filter.from, lte: filter.to } };
  if (before) liveWhere.createdAt = { ...liveWhere.createdAt, lt: before };
  if (filter.roomId) liveWhere.roomId = filter.roomId;
  if (filter.userId) liveWhere.senderId = filter.userId;
  if (filter.q) {
    // 삭제된 대화는 화면용 내용이 덮어써져 있으므로 보존 원본에서도 찾는다
    const matched = await prisma.messageArchive.findMany({
      where: { ...archiveWhere(filter, before), content: { contains: filter.q, mode: 'insensitive' } },
      select: { messageId: true },
      take: 5000,
    });
    liveWhere.OR = [
      { content: { contains: filter.q, mode: 'insensitive' } },
      { id: { in: matched.map((m) => m.messageId) } },
    ];
  }

  const live = await prisma.message.findMany({
    where: liveWhere,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    include: { sender: { select: { name: true, email: true } } },
  });

  const archiveByMessage = new Map(
    (await prisma.messageArchive.findMany({ where: { messageId: { in: live.map((m) => m.id) } } })).map((a) => [a.messageId, a]),
  );

  // 메시지 자체가 사라진(방 삭제 등) 보존 원본
  let orphans = [];
  {
    const archives = await prisma.messageArchive.findMany({
      where: {
        ...archiveWhere(filter, before),
        ...(filter.q ? { content: { contains: filter.q, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ messageCreatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const stillThere = new Set(
      (await prisma.message.findMany({ where: { id: { in: archives.map((a) => a.messageId) } }, select: { id: true } })).map((m) => m.id),
    );
    orphans = archives.filter((a) => !stillThere.has(a.messageId));
  }

  const senderIds = [...new Set(orphans.map((a) => a.senderId))];
  const orphanSenders = new Map(
    (await prisma.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, name: true, email: true } })).map((u) => [u.id, u]),
  );
  const roomIds = [...new Set([...live.map((m) => m.roomId), ...orphans.map((a) => a.roomId)])];
  const roomNames = await roomNameMap(roomIds);

  const rows = [
    ...live.map((m) => {
      const a = archiveByMessage.get(m.id);
      const status = m.deletedAt ? 'DELETED' : a?.reason === 'EXPIRED' ? 'EXPIRED' : 'NORMAL';
      const hasOriginal = status !== 'NORMAL' && a;
      return {
        id: m.id,
        createdAt: m.createdAt,
        roomId: m.roomId,
        roomName: roomNames.get(m.roomId) || '',
        senderId: m.senderId,
        senderName: m.sender?.name || '',
        senderEmail: m.sender?.email || '',
        content: m.content,
        status,
        originalContent: hasOriginal ? a.content : null,
        fileName: m.fileName || a?.fileName || null,
        fileSize: toNumber(m.fileSize ?? a?.fileSize),
        hasFile: !!(m.fileUrl || a?.fileUrl),
      };
    }),
    ...orphans.map((a) => ({
      id: a.messageId,
      createdAt: a.messageCreatedAt,
      roomId: a.roomId,
      roomName: roomNames.get(a.roomId) || '',
      senderId: a.senderId,
      senderName: orphanSenders.get(a.senderId)?.name || a.senderName || '',
      senderEmail: orphanSenders.get(a.senderId)?.email || a.senderEmail || '',
      content: a.content,
      status: 'ORPHAN',
      originalContent: a.content,
      fileName: a.fileName,
      fileSize: toNumber(a.fileSize),
      hasFile: !!a.fileUrl,
    })),
  ].sort((x, y) => y.createdAt - x.createdAt);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  return { rows: page, nextBefore: hasMore ? page[page.length - 1].createdAt : null };
}

/** 방 이름: 이름이 없는 1:1 대화는 참여자 이름을 이어서 보여 준다. */
async function roomNameMap(roomIds) {
  if (roomIds.length === 0) return new Map();
  const rooms = await prisma.room.findMany({
    where: { id: { in: roomIds } },
    select: { id: true, name: true, members: { select: { user: { select: { name: true } } }, take: 6 } },
  });
  return new Map(rooms.map((r) => [r.id, r.name || r.members.map((m) => m.user?.name).filter(Boolean).join(', ')]));
}

const FILTER_ERRORS = {
  AUDIT_TARGET_REQUIRED: '사용자 또는 대화방을 지정해 주세요',
  AUDIT_PERIOD_REQUIRED: '조회 기간(시작·끝)을 지정해 주세요',
  AUDIT_PERIOD_INVALID: '조회 기간이 올바르지 않습니다',
  AUDIT_PERIOD_TOO_LONG: '조회 기간은 최대 1년까지 지정할 수 있습니다',
};

function filterOrFail(req, res) {
  const parsed = parseAuditFilter(req.query);
  if (parsed.error) {
    res.status(400).json({ error: parsed.error, message: FILTER_ERRORS[parsed.error] });
    return null;
  }
  return parsed.filter;
}

/** 사용자 검색(조회 대상 선택용) */
auditRouter.get('/users', async (req, res) => {
  try {
    if (!(await assertAuditor(req, res))) return;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 1) return res.json({ users: [] });
    const users = await prisma.user.findMany({
      where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
      take: 20,
    });
    return res.json({ users });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'AUDIT_USERS_FAILED' });
  }
});

/** 대화방 검색(조회 대상 선택용): 방 이름 또는 참여자 이름 */
auditRouter.get('/rooms', async (req, res) => {
  try {
    if (!(await assertAuditor(req, res))) return;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 1) return res.json({ rooms: [] });
    const rooms = await prisma.room.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { members: { some: { user: { name: { contains: q, mode: 'insensitive' } } } } },
        ],
      },
      select: { id: true, name: true, isGroup: true, members: { select: { user: { select: { name: true } } }, take: 6 } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    return res.json({
      rooms: rooms.map((r) => ({
        id: r.id,
        name: r.name || '',
        isGroup: r.isGroup,
        memberNames: r.members.map((m) => m.user?.name).filter(Boolean),
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'AUDIT_ROOMS_FAILED' });
  }
});

/** 대화 조회. ?userId=&roomId=&from=&to=&q=&limit=&before= (사용자·대화방 중 하나와 기간은 필수) */
auditRouter.get('/messages', async (req, res) => {
  try {
    const me = await assertAuditor(req, res);
    if (!me) return;
    const filter = filterOrFail(req, res);
    if (!filter) return;
    const limit = parseAuditLimit(req.query.limit);
    const before = req.query.before ? new Date(String(req.query.before)) : null;
    const result = await queryAuditRows(filter, limit, before && !Number.isNaN(before.getTime()) ? before : null);
    await logAccess(me.id, 'SEARCH', auditParamsForLog(filter, { limit, before: before ? before.toISOString() : undefined }), result.rows.length);
    return res.json({ ...result, statusLabels: STATUS_LABEL });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'AUDIT_SEARCH_FAILED' });
  }
});

/** 같은 조건의 대화를 CSV로 내보내기(최대 5만 건). 첨부 파일은 파일명만 담기며 파일은 개별로 내려받는다. */
auditRouter.get('/export', async (req, res) => {
  try {
    const me = await assertAuditor(req, res);
    if (!me) return;
    const filter = filterOrFail(req, res);
    if (!filter) return;

    const lines = [AUDIT_CSV_HEADER.join(',')];
    let before = null;
    let total = 0;
    let truncated = false;
    while (total < AUDIT_EXPORT_MAX) {
      const { rows, nextBefore } = await queryAuditRows(filter, 1000, before);
      for (const row of rows) {
        if (total >= AUDIT_EXPORT_MAX) { truncated = true; break; }
        lines.push(auditRowToCsv({ ...row, status: STATUS_LABEL[row.status] }));
        total += 1;
      }
      if (!nextBefore) break;
      before = nextBefore;
      if (total >= AUDIT_EXPORT_MAX) { truncated = true; break; }
    }
    await logAccess(me.id, 'EXPORT', auditParamsForLog(filter, { truncated: truncated || undefined }), total);

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-${stamp}.csv"`);
    res.setHeader('X-Audit-Truncated', truncated ? '1' : '0');
    return res.send(`﻿${lines.join('\r\n')}\r\n`);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'AUDIT_EXPORT_FAILED' });
  }
});

/** 첨부 파일 내려받기(만료·삭제된 파일 포함). 대화방 참여 여부·다운로드 제한과 무관하게 감사 권한으로 허용하고 이력을 남긴다. */
auditRouter.get('/files/:messageId', async (req, res) => {
  try {
    const me = await assertAuditor(req, res);
    if (!me) return;
    const messageId = String(req.params.messageId);
    const [message, archive] = await Promise.all([
      prisma.message.findUnique({ where: { id: messageId }, select: { fileUrl: true, fileName: true, fileMimeType: true, roomId: true } }),
      prisma.messageArchive.findUnique({ where: { messageId } }),
    ]);
    const fileUrl = message?.fileUrl || archive?.fileUrl;
    if (!fileUrl) return res.status(404).json({ error: 'FILE_NOT_FOUND' });
    const filePath = path.join(UPLOAD_DIR, path.basename(fileUrl));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'FILE_MISSING_ON_DISK' });

    const downloadName = message?.fileName || archive?.fileName || path.basename(fileUrl);
    const mime = message?.fileMimeType || archive?.fileMimeType;
    await logAccess(me.id, 'FILE_DOWNLOAD', JSON.stringify({ messageId, roomId: message?.roomId || archive?.roomId, fileName: downloadName }), 1);

    const asciiFallback = /^[\x20-\x7e]*$/.test(downloadName) ? downloadName : 'download';
    res.setHeader('Content-Disposition', `attachment; filename="${asciiFallback.replace(/"/g, '\\"')}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
    if (mime) res.setHeader('Content-Type', mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    await sendStoredFile(res, filePath);
    return;
  } catch (err) {
    console.error(err);
    if (res.headersSent) return res.destroy(err);
    return res.status(500).json({ error: 'AUDIT_FILE_FAILED' });
  }
});

/** 감사 조회 이력(누가 언제 무엇을 조회·내보냈는지). 최근순. */
auditRouter.get('/logs', async (req, res) => {
  try {
    if (!(await assertAuditor(req, res))) return;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const logs = await prisma.auditAccessLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
    const users = new Map(
      (await prisma.user.findMany({ where: { id: { in: [...new Set(logs.map((l) => l.userId))] } }, select: { id: true, name: true, email: true } })).map((u) => [u.id, u]),
    );
    return res.json({
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        params: l.params,
        resultCount: l.resultCount,
        createdAt: l.createdAt,
        userName: users.get(l.userId)?.name || '',
        userEmail: users.get(l.userId)?.email || '',
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'AUDIT_LOGS_FAILED' });
  }
});
