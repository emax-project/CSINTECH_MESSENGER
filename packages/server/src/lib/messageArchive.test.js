import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveMessage } from './messageArchive.js';

function fakeDb(existing = null) {
  const calls = { created: [], updated: [] };
  return {
    calls,
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
