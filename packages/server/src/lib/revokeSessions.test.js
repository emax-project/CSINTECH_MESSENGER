import test from 'node:test';
import assert from 'node:assert/strict';
import { revokeUserSessions } from './revokeSessions.js';

function fakeDb(sessions) {
  const calls = { deleted: [] };
  return {
    calls,
    userSession: {
      findMany: async ({ where }) => sessions.filter((s) => s.userId === where.userId).map((s) => ({ id: s.id })),
      deleteMany: async ({ where }) => { calls.deleted.push(where.userId); return { count: 1 }; },
    },
  };
}
function fakeIo() {
  const disconnected = [];
  return { disconnected, in: (room) => ({ disconnectSockets: (close) => disconnected.push([room, close]) }) };
}

test('그 계정의 세션을 모두 지우고 세션별 소켓을 끊는다', async () => {
  const db = fakeDb([{ id: 's1', userId: 'u1' }, { id: 's2', userId: 'u1' }, { id: 's3', userId: 'u2' }]);
  const io = fakeIo();
  assert.equal(await revokeUserSessions('u1', { db, io }), 2);
  assert.deepEqual(db.calls.deleted, ['u1']);
  assert.deepEqual(io.disconnected, [['session:s1', true], ['session:s2', true]]);
});

test('세션이 없으면 아무것도 지우지 않는다', async () => {
  const db = fakeDb([]);
  assert.equal(await revokeUserSessions('u9', { db, io: fakeIo() }), 0);
  assert.deepEqual(db.calls.deleted, []);
});

test('소켓 서버가 없어도(io 미등록) 세션은 지운다', async () => {
  const db = fakeDb([{ id: 's1', userId: 'u1' }]);
  assert.equal(await revokeUserSessions('u1', { db, io: null }), 1);
  assert.deepEqual(db.calls.deleted, ['u1']);
});
