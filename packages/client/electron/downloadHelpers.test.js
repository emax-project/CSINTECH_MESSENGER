const test = require('node:test');
const assert = require('node:assert/strict');
const { canAutoOpen } = require('./downloadHelpers');

test('문서·이미지는 자동으로 연다', () => {
  assert.equal(canAutoOpen('C:\\Users\\a\\Downloads\\견적서.xlsx'), true);
  assert.equal(canAutoOpen('/tmp/사진.JPG'), true);
  assert.equal(canAutoOpen('report.pdf'), true);
});

test('실행 파일·스크립트는 자동으로 열지 않는다', () => {
  for (const name of ['a.exe', 'a.BAT', 'a.ps1', 'a.msi', 'a.js', 'a.lnk', 'a.html', 'a.svg', 'a.jar']) {
    assert.equal(canAutoOpen(name), false, name);
  }
});

test('확장자가 없으면 열지 않는다', () => {
  assert.equal(canAutoOpen('README'), false);
  assert.equal(canAutoOpen(''), false);
});
