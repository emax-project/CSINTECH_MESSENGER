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
  return db.messageArchive.create({
    data: {
      messageId: message.id,
      roomId: message.roomId,
      senderId: message.senderId,
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
