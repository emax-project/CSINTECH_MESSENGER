/**
 * 저장 시 암호화(대화 내용·첨부 파일). AES-256-GCM.
 *
 * - 키: 환경변수 DATA_ENCRYPTION_KEY (base64 32바이트 또는 hex 64자). 서버를 운영하는 쪽이 직접 만들어 .env에 넣는다.
 *   키가 없으면 암호화를 끄고 기존처럼 평문으로 저장한다. 이미 암호화된 값은 키가 있어야 읽을 수 있다.
 * - 대화 내용: 'enc:v1:' + base64(iv 12바이트 | 인증 태그 16바이트 | 암호문). 접두어로 암호화 여부를 구분하므로
 *   평문과 암호문이 섞여 있어도 읽을 수 있다(기존 데이터를 천천히 변환할 수 있다).
 * - 첨부 파일: 'CSEF1\0'(6바이트) | iv(12) | 암호문 | 태그(16). 머리 표시가 없으면 평문 파일로 본다.
 * 키를 잃어버리면 암호화된 데이터는 복구할 수 없다. 키는 서버 밖에도 안전하게 보관해야 한다.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { UPLOAD_DIR } from './uploadDir.js';

const TEXT_PREFIX = 'enc:v1:';
const FILE_MAGIC = Buffer.from('CSEF1\0', 'latin1');
const IV_LEN = 12;
const TAG_LEN = 16;
export const FILE_HEADER_LEN = FILE_MAGIC.length + IV_LEN;
export const UNDECRYPTABLE_TEXT = '[복호화할 수 없는 내용]';

let cachedKey; // undefined = 아직 안 읽음, null = 키 없음

/** 환경변수에서 키를 읽는다. 형식이 틀리면 서버가 잘못된 설정으로 조용히 평문 저장하지 않도록 예외를 던진다. */
export function loadKey(raw = process.env.DATA_ENCRYPTION_KEY) {
  const value = (raw || '').trim();
  if (!value) return null;
  let key = null;
  if (/^[0-9a-fA-F]{64}$/.test(value)) key = Buffer.from(value, 'hex');
  else {
    const buf = Buffer.from(value, 'base64');
    if (buf.length === 32) key = buf;
  }
  if (!key) throw new Error('DATA_ENCRYPTION_KEY 형식이 올바르지 않습니다 (32바이트를 hex 64자 또는 base64로)');
  return key;
}

export function getKey() {
  if (cachedKey === undefined) cachedKey = loadKey();
  return cachedKey;
}

/** 테스트에서 키를 바꿔 끼울 때 쓴다 */
export function resetKeyCache() {
  cachedKey = undefined;
}

export function isEncryptionEnabled() {
  return getKey() !== null;
}

export function isEncryptedText(value) {
  return typeof value === 'string' && value.startsWith(TEXT_PREFIX);
}

/** 키가 있으면 암호화하고, 없거나 이미 암호화된 값이면 그대로 돌려준다. */
export function encryptText(plain) {
  const key = getKey();
  if (!key || typeof plain !== 'string' || isEncryptedText(plain)) return plain;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${TEXT_PREFIX}${Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64')}`;
}

/** 암호화된 값이면 풀어서 돌려준다. 키가 없거나 틀려 풀 수 없으면 안내 문구를 돌려주고 서버는 계속 동작한다. */
export function decryptText(value) {
  if (!isEncryptedText(value)) return value;
  const key = getKey();
  if (!key) return UNDECRYPTABLE_TEXT;
  try {
    const raw = Buffer.from(value.slice(TEXT_PREFIX.length), 'base64');
    const iv = raw.subarray(0, IV_LEN);
    const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(raw.subarray(IV_LEN + TAG_LEN)), decipher.final()]).toString('utf8');
  } catch {
    return UNDECRYPTABLE_TEXT;
  }
}

/** 조회 결과(중첩된 include 포함) 안의 암호화된 문자열을 모두 풀어 준다. */
export function decryptDeep(value) {
  if (typeof value === 'string') return isEncryptedText(value) ? decryptText(value) : value;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) value[i] = decryptDeep(value[i]);
    return value;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const k of Object.keys(value)) value[k] = decryptDeep(value[k]);
  }
  return value;
}

// ───── 파일 ─────

// 아래 파일 함수들은 호출한 쪽이 무엇을 넘기든 업로드 폴더(root) 안의 파일만 다룬다.
// 경로를 절대 경로로 바꾼 뒤 root로 시작하는지 바로 확인하고, 확인한 값만 파일 접근에 쓴다.

async function readBytes(fh, length, position) {
  const buf = Buffer.alloc(length);
  const { bytesRead } = await fh.read(buf, 0, length, position);
  return buf.subarray(0, bytesRead);
}

export async function isEncryptedFile(rawPath, root = UPLOAD_DIR) {
  const rootDir = path.resolve(root) + path.sep;
  const filePath = path.resolve(rawPath);
  if (!filePath.startsWith(rootDir)) throw new Error('INVALID_FILE_PATH');
  const fh = await fs.promises.open(filePath, 'r');
  try {
    const head = await readBytes(fh, FILE_MAGIC.length, 0);
    return head.length === FILE_MAGIC.length && head.equals(FILE_MAGIC);
  } finally {
    await fh.close();
  }
}

/** 평문 파일을 암호화해 같은 경로에 덮어쓴다. 키가 없거나 이미 암호화된 파일이면 아무것도 하지 않고 false. */
export async function encryptFileInPlace(rawPath, root = UPLOAD_DIR) {
  const key = getKey();
  if (!key) return false;
  const rootDir = path.resolve(root) + path.sep;
  const filePath = path.resolve(rawPath);
  if (!filePath.startsWith(rootDir)) throw new Error('INVALID_FILE_PATH');
  if (await isEncryptedFile(filePath, root)) return false;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const tmp = `${filePath}.enc-tmp`;
  const out = fs.createWriteStream(tmp);
  out.write(Buffer.concat([FILE_MAGIC, iv]));
  const appendTag = new Transform({
    transform(chunk, _enc, cb) { cb(null, chunk); },
    flush(cb) { this.push(cipher.getAuthTag()); cb(); },
  });
  try {
    await pipeline(fs.createReadStream(filePath), cipher, appendTag, out);
    await fs.promises.rename(tmp, filePath);
  } catch (err) {
    await fs.promises.rm(tmp, { force: true });
    throw err;
  }
  return true;
}

/**
 * 저장된 파일을 읽는 스트림을 연다. 암호화된 파일이면 복호화해서, 평문이면 그대로 내보낸다.
 * 반환: { size(내려줄 바이트 수), stream }
 */
export async function openStoredFile(rawPath, root = UPLOAD_DIR) {
  const rootDir = path.resolve(root) + path.sep;
  const filePath = path.resolve(rawPath);
  if (!filePath.startsWith(rootDir)) throw new Error('INVALID_FILE_PATH');
  const fh = await fs.promises.open(filePath, 'r');
  let size;
  let head;
  let tagBuf;
  try {
    size = (await fh.stat()).size;
    head = await readBytes(fh, FILE_HEADER_LEN, 0);
    tagBuf = size >= FILE_HEADER_LEN + TAG_LEN ? await readBytes(fh, TAG_LEN, size - TAG_LEN) : null;
  } finally {
    await fh.close();
  }
  const encrypted = head.length >= FILE_MAGIC.length && head.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC);
  if (!encrypted) {
    return { size, stream: fs.createReadStream(filePath) };
  }
  const key = getKey();
  if (!key) throw new Error('ENCRYPTION_KEY_MISSING');
  const iv = head.subarray(FILE_MAGIC.length);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tagBuf);
  const source = fs.createReadStream(filePath, { start: FILE_HEADER_LEN, end: size - TAG_LEN - 1 });
  const stream = source.pipe(decipher);
  source.on('error', (err) => stream.destroy(err));
  return { size: size - FILE_HEADER_LEN - TAG_LEN, stream };
}
