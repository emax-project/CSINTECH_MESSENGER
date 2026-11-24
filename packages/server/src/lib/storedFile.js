import { pipeline } from 'node:stream/promises';
import { openStoredFile } from './dataCrypto.js';

/**
 * 저장된 첨부 파일을 응답으로 내려보낸다. 암호화된 파일은 복호화해서, 평문 파일은 그대로.
 * 헤더(Content-Disposition 등)는 호출한 쪽에서 먼저 설정한다.
 */
export async function sendStoredFile(res, filePath) {
  const { size, stream } = await openStoredFile(filePath);
  res.setHeader('Content-Length', String(size));
  try {
    await pipeline(stream, res);
  } catch (err) {
    // 중간에 끊겼거나 변조된 파일이면 응답을 끊어 불완전한 파일이 정상으로 보이지 않게 한다
    console.error('[storedFile] 전송 실패:', err?.message || err);
    res.destroy(err);
  }
}
