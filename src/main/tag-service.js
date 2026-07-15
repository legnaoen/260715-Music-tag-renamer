const fs = require('node:fs/promises');
const path = require('node:path');
const mm = require('music-metadata');
const NodeID3 = require('node-id3');
const { buildTitle, classifyTrack } = require('../core/title-rules');
const { analyzeAudioFile } = require('./audio-analysis');

function trackFromMetadata(filePath, common = {}) {
  const fileName = path.basename(filePath);
  const tagTitle = common.title || '';
  const fallbackTitle = path.basename(fileName, path.extname(fileName));
  const track = {
    path: filePath,
    fileName,
    tagTitle,
    title: tagTitle || fallbackTitle,
    titleSource: tagTitle ? 'tag' : 'fileName',
    bpm: common.bpm?.[0] ?? common.bpm ?? '',
    key: common.key || ''
  };
  const state = classifyTrack(track);
  const titleFallbackWarning = track.titleSource === 'fileName'
    ? '제목 태그 없음: 파일명을 제목으로 사용합니다.'
    : '';
  const warning = [titleFallbackWarning, state.warning].filter(Boolean).join(' ');
  return { ...track, previewTitle: buildTitle(track), ...state, warning };
}

async function readTrack(filePath) {
  const metadata = await mm.parseFile(filePath, { skipCovers: true });
  return trackFromMetadata(filePath, metadata.common || {});
}

async function collectMp3Files(folderPath) {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(folderPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectMp3Files(entryPath));
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.mp3') {
      files.push(entryPath);
    }
  }
  return files;
}

async function scanFolder(folderPath) {
  const files = (await collectMp3Files(folderPath)).sort((a, b) => a.localeCompare(b));
  const results = [];
  for (const filePath of files) {
    try {
      results.push(await readTrack(filePath));
    } catch (error) {
      results.push({
        path: filePath,
        fileName: path.basename(filePath),
        status: 'error',
        selectable: false,
        warning: error.message
      });
    }
  }
  return results;
}

async function applyTitles(items) {
  const log = { timestamp: new Date().toISOString(), entries: [] };
  for (const item of items) {
    try {
      if (!item.previewTitle || item.status !== 'ready') {
        log.entries.push({ path: item.path, status: 'excluded', oldTitle: item.title, reason: item.warning });
        continue;
      }
      const updated = NodeID3.update({ title: item.previewTitle }, item.path);
      if (!updated) throw new Error('ID3 태그를 저장하지 못했습니다. 파일이 다른 프로그램에서 사용 중인지 확인하세요.');
      log.entries.push({ path: item.path, status: 'success', oldTitle: item.title, newTitle: item.previewTitle });
    } catch (error) {
      log.entries.push({ path: item.path, status: 'error', oldTitle: item.title, error: error.message });
    }
  }
  const logPath = path.join(path.dirname(items[0]?.path || process.cwd()), `.music-tag-renamer-${Date.now()}.json`);
  await fs.writeFile(logPath, JSON.stringify(log, null, 2), 'utf8');
  return { ...log, logPath };
}

async function analyzeMissingTags(folderPath, onProgress = () => {}) {
  const tracks = await scanFolder(folderPath);
  const targets = tracks.filter((track) => track.status === 'missing' && (!track.bpm || !track.key));
  const log = { timestamp: new Date().toISOString(), entries: [] };
  const total = targets.length;
  let completed = 0;

  onProgress({ type: 'start', total, completed });

  for (const track of targets) {
    onProgress({ type: 'file-start', total, completed, path: track.path, fileName: track.fileName });
    try {
      const analysis = await analyzeAudioFile(track.path);
      const bpm = track.bpm || analysis.bpm;
      const key = track.key || analysis.key;
      if (!bpm || !key) {
        const entry = {
          path: track.path,
          status: 'skipped',
          reason: 'BPM 또는 Key를 분석하지 못했습니다.',
          analysis
        };
        log.entries.push(entry);
        completed += 1;
        onProgress({ type: 'file-done', total, completed, path: track.path, fileName: track.fileName, entry });
        continue;
      }

      const updated = NodeID3.update({ bpm, initialKey: key }, track.path);
      if (!updated) throw new Error('ID3 태그를 저장하지 못했습니다. 파일이 다른 프로그램에서 사용 중인지 확인하세요.');
      const entry = {
        path: track.path,
        status: 'success',
        bpm,
        key,
        confidence: analysis.confidence
      };
      log.entries.push(entry);
      completed += 1;
      onProgress({ type: 'file-done', total, completed, path: track.path, fileName: track.fileName, entry });
    } catch (error) {
      const entry = { path: track.path, status: 'error', error: error.message };
      log.entries.push(entry);
      completed += 1;
      onProgress({ type: 'file-done', total, completed, path: track.path, fileName: track.fileName, entry });
    }
  }

  const logPath = path.join(folderPath, `.music-tag-analysis-${Date.now()}.json`);
  await fs.writeFile(logPath, JSON.stringify(log, null, 2), 'utf8');
  const refreshedTracks = await scanFolder(folderPath);
  onProgress({ type: 'complete', total, completed, logPath });
  return { ...log, logPath, tracks: refreshedTracks };
}

module.exports = { scanFolder, applyTitles, analyzeMissingTags, trackFromMetadata };
