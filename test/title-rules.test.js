const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTitle, classifyTrack } = require('../src/core/title-rules');

test('formats BPM, Key, and title', () => assert.equal(buildTitle({ title: 'Track Name', bpm: 124, key: 'Am' }), '124 (Am) Track Name'));
test('excludes missing metadata', () => assert.equal(classifyTrack({ title: 'Track', bpm: '', key: 'Am' }).status, 'missing'));
test('does not duplicate an existing prefix', () => {
  const track = { title: '124 (Am) Track Name', bpm: 124, key: 'Am' };
  assert.equal(classifyTrack(track).status, 'done');
  assert.equal(buildTitle(track), track.title);
});
