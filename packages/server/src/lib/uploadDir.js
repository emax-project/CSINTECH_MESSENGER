import path from 'node:path';

/** 업로드 파일이 저장되는 폴더. DB·multer에 의존하지 않아 암호화 모듈과 테스트에서도 쓸 수 있다. */
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
