/**
 * 삭제·만료로 화면에서 사라지는 대화와 첨부 파일의 원본을 서버에 남긴다.
 * 사용자에게는 기존처럼 '[삭제된 메시지]' / '[파일 만료됨]'으로 보이고,
 * 원본은 감사 권한자만 조회할 수 있다.
 */
/**
 * message: Message 행(content, fileUrl 등 변경 전 값). reason: 'DELETED' | 'EXPIRED'.
 * 이미 보존된 메시지는 원본 내용을 건드리지 않고, 아직 없는 파일 정보만 채운다
 * (삭제된 뒤 파일이 만료되는 경우를 위해).
 */
export async function archiveMessage(message, reason, db) {
  if (!db) db = (await import('../db.js')).prisma;
  const existing = await db.messageArchive.findUnique({ where: { messageId: message.id } });
  if (existing) {
    if (!existing.fileUrl && message.fileUrl) {
      await db.messageArchive.update({
        where: { messageId: message.id },
        data: {
          fileUrl: message.fileUrl,
          fileName: message.fileName ?? null,
          fileSize: message.fileSize ?? null,
          fileMimeType: message.fileMimeType ?? null,
        },
      });
    }
    return existing;
  }
  const sender = await db.user.findUnique({ where: { id: message.senderId }, select: { name: true, email: true } });
  return db.messageArchive.create({
    data: {
      messageId: message.id,
      roomId: message.roomId,
      senderId: message.senderId,
      senderName: sender?.name ?? null,
      senderEmail: sender?.email ?? null,
      content: message.content ?? '',
      messageCreatedAt: message.createdAt,
      fileUrl: message.fileUrl ?? null,
      fileName: message.fileName ?? null,
      fileSize: message.fileSize ?? null,
      fileMimeType: message.fileMimeType ?? null,
      reason,
    },
  });
}

/**
 * 계정을 삭제하면 그 계정이 보낸 메시지도 함께 지워지므로, 지우기 전에 모두 서버에 보존한다.
 * 이미 보존된 메시지는 그대로 둔다. 반환값은 새로 보존한 건수.
 */
export async function archiveMessagesBySender(userId, db) {
  if (!db) db = (await import('../db.js')).prisma;
  return db.$executeRaw`
    INSERT INTO "MessageArchive"
      ("id", "messageId", "roomId", "senderId", "senderName", "senderEmail", "content", "messageCreatedAt",
       "fileUrl", "fileName", "fileSize", "fileMimeType", "reason", "archivedAt")
    SELECT gen_random_uuid()::text, m."id", m."roomId", m."senderId", u."name", u."email", m."content", m."createdAt",
           m."fileUrl", m."fileName", m."fileSize", m."fileMimeType", 'USER_REMOVED', now()
    FROM "Message" m
    JOIN "User" u ON u."id" = m."senderId"
    WHERE m."senderId" = ${userId}
    ON CONFLICT ("messageId") DO NOTHING`;
}
