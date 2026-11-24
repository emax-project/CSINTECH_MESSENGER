import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  decryptDeep, decryptText, encryptFileInPlace, encryptText, isEncryptedFile, isEncryptedText,
  loadKey, openStoredFile, resetKeyCache, UNDECRYPTABLE_TEXT,
} from './dataCrypto.js';

const KEY_A = crypto.randomBytes(32).toString('hex');
const KEY_B = crypto.randomBytes(32).toString('base64');

function useKey(raw) {
  if (raw) process.env.DATA_ENCRYPTION_KEY = raw; else delete process.env.DATA_ENCRYPTION_KEY;
  resetKeyCache();
}
async function readAll(stream) {
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return Buffer.concat(chunks);
}

test('키 형식: hex 64자·base64 32바이트는 통과, 그 밖은 예외, 비어 있으면 null', () => {
  assert.equal(loadKey(KEY_A).length, 32);
  assert.equal(loadKey(KEY_B).length, 32);
  assert.equal(loadKey(''), null);
  assert.throws(() => loadKey('짧은키'));
});

test('텍스트 암호화: 왕복·접두어·같은 글도 매번 다른 암호문', () => {
  useKey(KEY_A);
  const a = encryptText('안녕하세요 비밀 대화');
  assert.ok(isEncryptedText(a));
  assert.notEqual(a, encryptText('안녕하세요 비밀 대화'));
  assert.equal(decryptText(a), '안녕하세요 비밀 대화');
  assert.equal(encryptText(a), a); // 이중 암호화하지 않는다
});

test('키가 없으면 평문 그대로 저장하고, 평문은 그대로 읽는다', () => {
  useKey(null);
  assert.equal(encryptText('평문'), '평문');
  assert.equal(decryptText('평문'), '평문');
});

test('키가 없거나 틀리면 서버를 죽이지 않고 안내 문구를 돌려준다', () => {
  useKey(KEY_A);
  const enc = encryptText('secret');
  useKey(null);
  assert.equal(decryptText(enc), UNDECRYPTABLE_TEXT);
  useKey(KEY_B);
  assert.equal(decryptText(enc), UNDECRYPTABLE_TEXT);
});

test('변조된 암호문은 복호화되지 않는다', () => {
  useKey(KEY_A);
  const enc = encryptText('secret');
  const tampered = enc.slice(0, -4) + (enc.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  assert.equal(decryptText(tampered), UNDECRYPTABLE_TEXT);
});

test('중첩된 조회 결과 안의 암호문을 모두 푼다', () => {
  useKey(KEY_A);
  const tree = { messages: [{ content: encryptText('하나'), replyTo: { content: encryptText('둘') } }], at: new Date(0), n: 3 };
  const out = decryptDeep(tree);
  assert.equal(out.messages[0].content, '하나');
  assert.equal(out.messages[0].replyTo.content, '둘');
  assert.ok(out.at instanceof Date);
});

test('파일 암호화: 디스크에는 암호문, 내려받을 때는 원본, 이미 암호화된 파일은 건드리지 않는다', async () => {
  useKey(KEY_A);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'enc-test-'));
  const file = path.join(dir, 'a.bin');
  const original = crypto.randomBytes(300_000);
  fs.writeFileSync(file, original);

  assert.equal(await encryptFileInPlace(file), true);
  assert.equal(await isEncryptedFile(file), true);
  assert.ok(!fs.readFileSync(file).includes(original.subarray(1000, 1064)));
  assert.equal(await encryptFileInPlace(file), false);

  const { size, stream } = await openStoredFile(file);
  const back = await readAll(stream);
  assert.equal(size, original.length);
  assert.ok(back.equals(original));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('평문(기존) 파일은 그대로 내려준다', async () => {
  useKey(KEY_A);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'enc-test-'));
  const file = path.join(dir, 'plain.txt');
  fs.writeFileSync(file, 'hello');
  const { size, stream } = await openStoredFile(file);
  assert.equal(size, 5);
  assert.equal((await readAll(stream)).toString(), 'hello');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('변조된 파일은 끝까지 읽는 도중 오류가 난다', async () => {
  useKey(KEY_A);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'enc-test-'));
  const file = path.join(dir, 'b.bin');
  fs.writeFileSync(file, crypto.randomBytes(5000));
  await encryptFileInPlace(file);
  const data = fs.readFileSync(file);
  data[200] ^= 0xff;
  fs.writeFileSync(file, data);
  const { stream } = await openStoredFile(file);
  await assert.rejects(() => readAll(stream));
  fs.rmSync(dir, { recursive: true, force: true });
});
