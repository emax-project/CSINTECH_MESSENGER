// 첨부파일 다운로드 후 처리 — 자동 열기 대상 판정
// 실행 파일·스크립트는 열면 곧바로 실행되므로 자동으로 열지 않고 폴더에서 위치만 보여 준다.
const path = require('path');

const NO_AUTO_OPEN_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif', '.cpl', '.msc', '.dll', '.sys',
  '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.ps1', '.psm1', '.hta', '.jar', '.reg', '.lnk', '.url',
  '.html', '.htm', '.xhtml', '.shtml', '.mhtml', '.svg',
  '.sh', '.command', '.app', '.dmg', '.pkg', '.deb', '.rpm',
]);

function canAutoOpen(filePath) {
  const ext = path.extname(String(filePath || '')).toLowerCase();
  return ext !== '' && !NO_AUTO_OPEN_EXTENSIONS.has(ext);
}

module.exports = { canAutoOpen };
