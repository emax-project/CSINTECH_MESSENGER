/**
 * 계정의 로그인 세션(토큰)을 모두 무효화하고 접속 중인 소켓도 끊는다.
 * 계정 잠금·관리자 강제 해제처럼 "그 계정의 기존 로그인을 더는 인정하지 않는" 때 쓴다.
 */
let ioRef = null;

/** 서버 시작 때 socket.io 인스턴스를 등록한다(라우트가 아닌 곳에서도 소켓을 끊을 수 있게) */
export function registerIo(io) {
  ioRef = io;
}

/** 반환: 지운 세션 수. db·io는 테스트에서 바꿔 끼울 수 있다. */
export async function revokeUserSessions(userId, { db, io = ioRef } = {}) {
  if (!db) db = (await import('../db.js')).prisma;
  const sessions = await db.userSession.findMany({ where: { userId: String(userId) }, select: { id: true } });
  if (sessions.length === 0) return 0;
  await db.userSession.deleteMany({ where: { userId: String(userId) } });
  for (const s of sessions) io?.in(`session:${s.id}`).disconnectSockets(true);
  return sessions.length;
}
