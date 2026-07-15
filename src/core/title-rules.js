const PREFIX = /^\s*\d+(?:\.\d+)?\s*\([^)]*\)\s+/;

function normalize(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function buildTitle({ title, bpm, key }) {
  const cleanTitle = normalize(title);
  const cleanBpm = normalize(bpm);
  const cleanKey = normalize(key);
  if (!cleanTitle || !cleanBpm || !cleanKey) return null;
  if (PREFIX.test(cleanTitle)) return cleanTitle;
  return `${cleanBpm} (${cleanKey}) ${cleanTitle}`;
}

function classifyTrack(track) {
  const title = normalize(track.title);
  const bpm = normalize(track.bpm);
  const key = normalize(track.key);
  if (!title || !bpm || !key) {
    return { status: 'missing', selectable: false, warning: '제목·BPM·Key 중 누락된 태그가 있습니다.' };
  }
  if (PREFIX.test(title)) {
    return { status: 'done', selectable: false, warning: 'BPM·Key 접두어가 이미 있습니다.' };
  }
  return { status: 'ready', selectable: true, warning: '' };
}

module.exports = { buildTitle, classifyTrack, PREFIX };
