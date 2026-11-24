/**
 * 암호화를 켜기 전에 쌓인 평문 대화·첨부 파일을 암호화한다. 몇 번 실행해도 안전하고(이미 암호화된 건 건너뜀),
 * 중간에 멈춰도 다시 실행하면 이어서 진행한다. DATA_ENCRYPTION_KEY가 설정되어 있어야 한다.
 *
 * 서버 컨테이너에서:
 *   docker exec -w /app <server> node --input-type=module -e "import('./src/lib/encryptExisting.js').then(m=>m.encryptExisting({dryRun:true}).then(console.log))"
 * dryRun: false 로 바꾸면 실제로 변환한다. 변환 전에 DB 백업과 uploads 볼륨 백업을 먼저 받아 두세요.
 */
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../db.js';
import { UPLOAD_DIR } from '../upload.js';
import { encryptFileInPlace, isEncryptedFile, isEncryptionEnabled } from './dataCrypto.js';

const BATCH = 500;
const NOT_ENCRYPTED = { NOT: { content: { startsWith: 'enc:v1:' } } };

async function convertContent(model, dryRun, onProgress) {
  let done = 0;
  let cursor;
  for (;;) {
    const rows = await model.findMany({
      where: NOT_ENCRYPTED,
      select: { id: true, content: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;
    if (!dryRun) {
      for (const row of rows) {
        // 확장된 클라이언트가 저장할 때 암호화한다
        await model.update({ where: { id: row.id }, data: { content: row.content } });
      }
    }
    done += rows.length;
    onProgress?.(done);
  }
  return done;
}

async function convertFiles(dryRun) {
  const urls = new Set();
  for (const m of await prisma.message.findMany({ where: { fileUrl: { not: null } }, select: { fileUrl: true } })) urls.add(m.fileUrl);
  for (const a of await prisma.messageArchive.findMany({ where: { fileUrl: { not: null } }, select: { fileUrl: true } })) urls.add(a.fileUrl);
  let converted = 0;
  let missing = 0;
  for (const url of urls) {
    const filePath = path.join(UPLOAD_DIR, path.basename(url));
    if (!fs.existsSync(filePath)) { missing += 1; continue; }
    if (await isEncryptedFile(filePath)) continue;
    if (!dryRun) await encryptFileInPlace(filePath);
    converted += 1;
  }
  return { converted, missing };
}

export async function encryptExisting({ dryRun = true } = {}) {
  if (!isEncryptionEnabled()) throw new Error('DATA_ENCRYPTION_KEY가 설정되어 있지 않습니다');
  const log = (msg) => console.log(`[encrypt-existing] ${msg}`);
  const messages = await convertContent(prisma.message, dryRun, (n) => n % 5000 === 0 && log(`대화 ${n}건 처리`));
  const archives = await convertContent(prisma.messageArchive, dryRun, null);
  const files = await convertFiles(dryRun);
  const result = { dryRun, messages, archives, files: files.converted, missingFiles: files.missing };
  log(JSON.stringify(result));
  return result;
}
