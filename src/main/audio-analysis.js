const { spawn } = require('node:child_process');
const ffmpegPath = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
const { Essentia, EssentiaWASM } = require('essentia.js');

const SAMPLE_RATE = 44100;
const DEFAULT_SECONDS = 90;

let essentia;

function getEssentia() {
  if (!essentia) essentia = new Essentia(EssentiaWASM);
  return essentia;
}

function decodeMp3ToMonoFloat(filePath, seconds = DEFAULT_SECONDS) {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      filePath,
      '-t',
      String(seconds),
      '-ac',
      '1',
      '-ar',
      String(SAMPLE_RATE),
      '-f',
      'f32le',
      '-acodec',
      'pcm_f32le',
      'pipe:1'
    ];
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    const stdout = [];
    const stderr = [];

    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(stderr).toString('utf8') || `ffmpeg exited with code ${code}`));
        return;
      }
      const buffer = Buffer.concat(stdout);
      const samples = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
      resolve(new Float32Array(samples));
    });
  });
}

function formatKey(key, scale) {
  if (!key || key === 'none') return '';
  return scale === 'minor' ? `${key}m` : key;
}

async function analyzeAudioFile(filePath, options = {}) {
  const audio = await decodeMp3ToMonoFloat(filePath, options.seconds);
  const api = getEssentia();
  const signal = api.arrayToVector(audio);
  try {
    const rhythm = api.RhythmExtractor2013(signal, 180, 'multifeature', 70);
    const key = api.KeyExtractor(
      signal,
      true,
      4096,
      4096,
      12,
      3500,
      60,
      25,
      0.2,
      'edma',
      SAMPLE_RATE,
      0.0001,
      440,
      'cosine',
      'hann'
    );
    return {
      bpm: rhythm.bpm ? String(Math.round(rhythm.bpm)) : '',
      key: formatKey(key.key, key.scale),
      confidence: {
        bpm: rhythm.confidence ?? null,
        key: key.strength ?? null
      }
    };
  } finally {
    if (typeof signal.delete === 'function') signal.delete();
  }
}

module.exports = { analyzeAudioFile, decodeMp3ToMonoFloat, formatKey };
