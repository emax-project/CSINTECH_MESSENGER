import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

// 차단 목록: 실행 가능한 위험 파일 + 브라우저에서 열었을 때 그 자체로
// 스크립트를 실행할 수 있는 웹 콘텐츠 파일 (저장형 XSS 방지)
const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif', '.vbs', '.wsf',
  '.html', '.htm', '.xhtml', '.shtml', '.mhtml', '.svg',
];

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return cb(new Error('실행 파일은 업로드할 수 없습니다'), false);
  }
  cb(null, true);
}

export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

const AVATAR_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
function avatarFileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!AVATAR_EXTENSIONS.includes(ext)) {
    return cb(new Error('이미지 파일만 업로드할 수 있습니다 (jpg, png, gif, webp)'), false);
  }
  cb(null, true);
}

export const avatarUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: avatarFileFilter,
});
