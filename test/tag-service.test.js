const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { trackFromMetadata } = require('../src/main/tag-service');

test('uses the file name when the title tag is missing', () => {
  const filePath = path.join('music', '파일명 제목 테스트.mp3');
  const track = trackFromMetadata(filePath, { bpm: 120, key: 'Fm' });

  assert.equal(track.tagTitle, '');
  assert.equal(track.title, '파일명 제목 테스트');
  assert.equal(track.titleSource, 'fileName');
  assert.equal(track.status, 'ready');
  assert.equal(track.selectable, true);
  assert.equal(track.previewTitle, '120 (Fm) 파일명 제목 테스트');
  assert.match(track.warning, /제목 태그 없음/);
});
