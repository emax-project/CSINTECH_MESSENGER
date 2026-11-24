import { prisma } from '../db.js';

/** ADMIN_EMAIL env (comma-separated) → lowercase email list. 이 목록이 '최초 관리자'다. */
export function getAdminEmails() {
  return (process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** 최초 관리자(ADMIN_EMAIL 목록) 여부. 관리자 권한을 다른 계정에 줄 수 있는 것은 이 계정뿐이다. */
export function isAdminEmail(email) {
  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) return false;
  const userEmail = (email || '').trim().toLowerCase();
  return adminEmails.includes(userEmail);
}

/** 관리자 여부 = 최초 관리자이거나 관리자 권한을 부여받은 계정. user: { email, adminGranted } */
export function isAdminUser(user) {
  if (!user) return false;
  return isAdminEmail(user.email) || user.adminGranted === true;
}

/**
 * Require admin (ADMIN_EMAIL 목록 또는 권한을 부여받은 계정) for req.userId.
 * On failure, sends 503/403 and returns null. On success, returns { email }.
 */
export async function assertAdmin(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { email: true, adminGranted: true },
  });
  if (user && isAdminUser(user)) return user;
  if (getAdminEmails().length === 0 && !user?.adminGranted) {
    res.status(503).json({ error: 'Admin not configured (ADMIN_EMAIL)' });
    return null;
  }
  res.status(403).json({ error: 'Admin only' });
  return null;
}

/** 최초 관리자(ADMIN_EMAIL 목록)만 통과. 관리자 권한 부여·해제에 쓴다. */
export async function assertRootAdmin(req, res) {
  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) {
    res.status(503).json({ error: 'Admin not configured (ADMIN_EMAIL)' });
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true },
  });
  if (!user || !isAdminEmail(user.email)) {
    res.status(403).json({ error: 'ROOT_ADMIN_ONLY' });
    return null;
  }
  return user;
}

/**
 * 감사 권한자(대화·첨부 원본 조회·내보내기)만 통과. 관리자 권한과는 별개이며,
 * 최초 관리자가 부여한 계정(auditGranted)만 가능하다. 실패하면 403을 보내고 null을 돌려준다.
 */
export async function assertAuditor(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, name: true, auditGranted: true, disabled: true },
  });
  if (!user || user.disabled || user.auditGranted !== true) {
    res.status(403).json({ error: 'AUDITOR_ONLY' });
    return null;
  }
  return user;
}
