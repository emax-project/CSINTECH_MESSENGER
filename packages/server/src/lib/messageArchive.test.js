import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveMessage } from './messageArchive.js';

function fakeDb(existing = null) {
  const calls = { created: [], updated: [] };
  return {
    calls,
    user: { findUnique: async () => ({ name: '홍길동', email: 'a@b.c' }) },
    messageArchive: {
      findUnique: async () => existing,
      create: async ({ data }) => { calls.created.push(data); return data; },
      update: async (args) => { calls.updated.push(args); return args; },
    },
  };
}

const message = {
  id: 'm1', roomId: 'r1', senderId: 'u1', content: '원본 내용', createdAt: new Date('2026-11-01T00:00:00Z'),
  fileUrl: '/uploads/a.pdf', fileName: 'a.pdf', fileSize: 10n, fileMimeType: 'application/pdf',
};

test('삭제 시 원본 내용과 파일 정보를 그대로 보존한다', async () => {
  const db = fakeDb();
  await archiveMessage(message, 'DELETED', db);
  assert.equal(db.calls.created.length, 1);
  assert.equal(db.calls.created[0].content, '원본 내용');
  assert.equal(db.calls.created[0].fileUrl, '/uploads/a.pdf');
  assert.equal(db.calls.created[0].reason, 'DELETED');
  // 보낸 계정이 나중에 지워져도 누구의 대화인지 알 수 있게 이름·이메일을 함께 남긴다
  assert.equal(db.calls.created[0].senderName, '홍길동');
  assert.equal(db.calls.created[0].senderEmail, 'a@b.c');
});

test('이미 보존된 메시지의 원본 내용은 덮어쓰지 않는다', async () => {
  const db = fakeDb({ messageId: 'm1', content: '원본 내용', fileUrl: null });
  await archiveMessage({ ...message, content: '[삭제된 메시지]' }, 'EXPIRED', db);
  assert.equal(db.calls.created.length, 0);
  assert.equal(db.calls.updated.length, 1);
  assert.equal(db.calls.updated[0].data.content, undefined);
  assert.equal(db.calls.updated[0].data.fileUrl, '/uploads/a.pdf');
});

test('보존본에 파일 정보가 이미 있으면 아무것도 바꾸지 않는다', async () => {
  const db = fakeDb({ messageId: 'm1', content: 'x', fileUrl: '/uploads/a.pdf' });
  await archiveMessage(message, 'EXPIRED', db);
  assert.equal(db.calls.created.length + db.calls.updated.length, 0);
});
