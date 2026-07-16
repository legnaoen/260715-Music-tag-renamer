let folderPath = '';
let tracks = [];
let isBusy = false;
let activeFilter = 'all';
let analysisProgress = null;
let analysisResult = null;
let analysisStatusByPath = new Map();
let pendingAnalysisResolve = null;
const SECONDS_PER_FILE_ESTIMATE = 6;
const INTRO_STORAGE_KEY = 'musicTagRenamer.hideIntro';
const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function statusLabel(status) {
  return { ready: '가능', missing: '누락', done: '완료', error: '오류' }[status] || status;
}

function analysisLabel(entry) {
  if (!entry) return '';
  if (entry.state === 'pending') return '분석 대기';
  if (entry.state === 'running') return '분석 중...';
  if (entry.state === 'success') return `분석 완료: ${entry.bpm} / ${entry.key}`;
  if (entry.state === 'skipped') return entry.reason || '분석 건너뜀';
  if (entry.state === 'error') return `분석 오류: ${entry.error}`;
  return '';
}

function filteredTracks() {
  if (activeFilter === 'all') return tracks;
  return tracks.filter((track) => track.status === activeFilter);
}

function visibleSelectableTracks() {
  return filteredTracks().filter((track) => track.selectable);
}

function missingCount() {
  return tracks.filter((track) => track.status === 'missing' && (!track.bpm || !track.key)).length;
}

function selectedCount() {
  return tracks.filter((track) => track.selected).length;
}

function formatDuration(seconds) {
  if (seconds < 60) return `약 ${seconds}초`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (!rest) return `약 ${minutes}분`;
  return `약 ${minutes}분 ${rest}초`;
}

function setBusy(value, message) {
  isBusy = value;
  $('drop-zone').classList.toggle('loading', value);
  if (message) $('result-text').textContent = message;
  render();
}

function renderProgress() {
  const modal = $('analysis-progress-modal');
  if (!analysisProgress) {
    modal.classList.add('hidden');
    $('analysis-result-summary').classList.add('hidden');
    $('analysis-result-summary').innerHTML = '';
    return;
  }
  const total = analysisProgress.total || 0;
  const completed = analysisProgress.completed || 0;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const isDone = Boolean(analysisProgress.done);
  modal.classList.remove('hidden');
  $('progress-count').textContent = `${completed} / ${total} (${percent}%)`;
  $('progress-fill').style.width = `${percent}%`;
  $('progress-current').textContent = analysisProgress.current || '대기 중입니다.';
  $('close-analysis-progress').disabled = !isDone;
  $('analysis-modal-hint').textContent = isDone ? '분석 결과를 확인한 뒤 닫을 수 있습니다.' : '분석 중에는 창을 닫을 수 없습니다.';
  renderAnalysisResultSummary();
}

function renderAnalysisResultSummary() {
  const target = $('analysis-result-summary');
  if (!analysisResult) {
    target.classList.add('hidden');
    target.innerHTML = '';
    return;
  }

  const entries = analysisResult.entries || [];
  const byStatus = (status) => entries.filter((entry) => entry.status === status);
  const successCount = byStatus('success').length;
  const skipped = byStatus('skipped');
  const errors = byStatus('error');
  const failed = [...errors, ...skipped];
  const logPath = analysisResult.logPath || '';

  const detail = failed.slice(0, 5).map((entry) => {
    const fileName = entry.path ? entry.path.split(/[\\/]/).pop() : '알 수 없는 파일';
    const reason = entry.error || entry.reason || '원인 정보가 없습니다.';
    return `<li><b>${escapeHtml(fileName)}</b><span>${escapeHtml(reason)}</span></li>`;
  }).join('');
  const more = failed.length > 5 ? `<p class="muted">외 ${failed.length - 5}건은 로그 파일에서 확인할 수 있습니다.</p>` : '';

  target.classList.toggle('has-failure', failed.length > 0);
  target.classList.remove('hidden');
  target.innerHTML = `
    <h3>${failed.length ? '분석 결과: 일부 실패' : '분석 완료'}</h3>
    <p>성공 ${successCount}건 / 건너뜀 ${skipped.length}건 / 오류 ${errors.length}건</p>
    ${failed.length ? `<ul>${detail}</ul>${more}` : ''}
    ${logPath ? `<p class="muted">로그: ${escapeHtml(logPath)}</p>` : ''}
  `;
}

function renderHeaderCheckbox() {
  const checkbox = $('toggle-visible-selection');
  const selectable = visibleSelectableTracks();
  const selected = selectable.filter((track) => track.selected);
  checkbox.disabled = isBusy || selectable.length === 0;
  checkbox.checked = selectable.length > 0 && selected.length === selectable.length;
  checkbox.indeterminate = selected.length > 0 && selected.length < selectable.length;
}

function render() {
  const selected = selectedCount();
  $('folder-path').textContent = folderPath || '폴더가 선택되지 않았습니다.';
  $('drop-zone').classList.toggle('hidden', Boolean(folderPath));
  $('total').textContent = tracks.length;
  $('ready').textContent = tracks.filter((track) => track.status === 'ready').length;
  $('missing').textContent = tracks.filter((track) => track.status === 'missing').length;
  $('done').textContent = tracks.filter((track) => track.status === 'done').length;
  $('errors').textContent = tracks.filter((track) => track.status === 'error').length;
  $('apply').textContent = selected === 0 ? '선택한 항목 변경' : `${selected}항목 변경`;
  $('apply').disabled = isBusy || selected === 0;
  $('analyze-missing').disabled = isBusy || !folderPath || missingCount() === 0;

  document.querySelectorAll('.filter-chip').forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === activeFilter);
  });

  const rows = filteredTracks();
  $('track-list').innerHTML = rows.length
    ? rows.map((track) => {
      const sourceIndex = tracks.indexOf(track);
      const analysisText = analysisLabel(analysisStatusByPath.get(track.path));
      const warning = analysisText || track.warning || '';
      return `<tr data-index="${sourceIndex}">
        <td class="check-col"><input type="checkbox" data-index="${sourceIndex}" ${track.selected ? 'checked' : ''} ${isBusy ? 'disabled' : ''}></td>
        <td>${escapeHtml(track.fileName)}</td>
        <td>${escapeHtml(track.titleSource === 'fileName' ? '—' : (track.title || '—'))}</td>
        <td>${escapeHtml(track.bpm || '—')}</td>
        <td>${escapeHtml(track.key || '—')}</td>
        <td>${escapeHtml(track.previewTitle || '—')}</td>
        <td class="status-${escapeHtml(track.status)}">${statusLabel(track.status)}</td>
        <td>${escapeHtml(warning)}</td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="8" class="empty">현재 필터에 표시할 항목이 없습니다.</td></tr>';

  renderHeaderCheckbox();
  renderProgress();
}

async function refreshTracksAfterChange(message) {
  if (!folderPath) return;
  if (message) $('result-text').textContent = message;
  tracks = (await window.musicRenamer.scanFolder(folderPath)).map((track) => ({ ...track, selected: false }));
  analysisProgress = null;
  analysisResult = null;
  analysisStatusByPath = new Map();
  render();
}

async function load(folder) {
  if (!folder || isBusy) return;
  folderPath = folder;
  analysisProgress = null;
  analysisResult = null;
  analysisStatusByPath = new Map();
  setBusy(true, '폴더를 읽는 중입니다...');
  try {
    tracks = (await window.musicRenamer.scanFolder(folder)).map((track) => ({ ...track, selected: false }));
  } finally {
    setBusy(false);
  }
  render();
}

function prepareAnalysisState() {
  analysisStatusByPath = new Map();
  tracks.forEach((track) => {
    if (track.status === 'missing' && (!track.bpm || !track.key)) {
      analysisStatusByPath.set(track.path, { state: 'pending' });
    }
  });
}

function openConfirmModal(targetCount) {
  const seconds = targetCount * SECONDS_PER_FILE_ESTIMATE;
  $('estimate-files').textContent = `${targetCount}개`;
  $('estimate-time').textContent = formatDuration(seconds);
  $('confirm-summary').textContent = '누락된 BPM/Key 태그를 자동 분석합니다. 파일 수와 PC 상태에 따라 실제 시간은 달라질 수 있습니다.';
  $('confirm-modal').classList.remove('hidden');
  $('confirm-analysis').focus();
  return new Promise((resolve) => {
    pendingAnalysisResolve = resolve;
  });
}

function closeConfirmModal(result) {
  $('confirm-modal').classList.add('hidden');
  if (pendingAnalysisResolve) pendingAnalysisResolve(result);
  pendingAnalysisResolve = null;
}

function showIntroIfNeeded() {
  if (localStorage.getItem(INTRO_STORAGE_KEY) === '1') return;
  $('intro-modal').classList.remove('hidden');
  $('close-intro').focus();
}

function closeIntroModal() {
  if ($('hide-intro-next-time').checked) {
    localStorage.setItem(INTRO_STORAGE_KEY, '1');
  }
  $('intro-modal').classList.add('hidden');
}

function handleAnalyzeProgress(progress) {
  if (!progress) return;
  if (progress.type === 'start') {
    analysisResult = null;
    analysisProgress = { total: progress.total, completed: progress.completed, current: '분석을 시작합니다.', done: false };
  }
  if (progress.type === 'file-start') {
    analysisProgress = {
      total: progress.total,
      completed: progress.completed,
      current: `분석 중: ${progress.fileName}`,
      done: false
    };
    analysisStatusByPath.set(progress.path, { state: 'running' });
  }
  if (progress.type === 'file-done') {
    const entry = progress.entry || {};
    analysisProgress = {
      total: progress.total,
      completed: progress.completed,
      current: `완료: ${progress.fileName}`,
      done: false
    };
    analysisStatusByPath.set(progress.path, {
      state: entry.status,
      bpm: entry.bpm,
      key: entry.key,
      reason: entry.reason,
      error: entry.error
    });
  }
  if (progress.type === 'complete') {
    analysisProgress = {
      total: progress.total,
      completed: progress.completed,
      current: `분석 완료. 결과를 정리하는 중입니다...`,
      done: false
    };
  }
  render();
}

function closeAnalysisProgressModal() {
  if (!analysisProgress?.done) return;
  analysisProgress = null;
  analysisResult = null;
  render();
}

window.musicRenamer.onAnalyzeProgress(handleAnalyzeProgress);

$('choose-folder').addEventListener('click', async () => load(await window.musicRenamer.chooseFolder()));
$('refresh').addEventListener('click', () => load(folderPath));
$('filters').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  activeFilter = button.dataset.filter;
  render();
});
$('toggle-visible-selection').addEventListener('change', (event) => {
  const nextValue = event.target.checked;
  visibleSelectableTracks().forEach((track) => { track.selected = nextValue; });
  render();
});
$('track-list').addEventListener('click', (event) => {
  if (isBusy) return;
  const row = event.target.closest('tr[data-index]');
  if (!row) return;
  const index = Number(row.dataset.index);
  if (!Number.isInteger(index) || !tracks[index]) return;
  if (event.target.matches('input[type="checkbox"]')) {
    tracks[index].selected = event.target.checked;
  } else {
    tracks[index].selected = !tracks[index].selected;
  }
  render();
});
$('close-intro').addEventListener('click', closeIntroModal);
$('intro-modal').addEventListener('click', (event) => {
  if (event.target.id === 'intro-modal') closeIntroModal();
});
$('cancel-analysis').addEventListener('click', () => closeConfirmModal(false));
$('confirm-analysis').addEventListener('click', () => closeConfirmModal(true));
$('confirm-modal').addEventListener('click', (event) => {
  if (event.target.id === 'confirm-modal') closeConfirmModal(false);
});
$('close-analysis-progress').addEventListener('click', closeAnalysisProgressModal);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !$('confirm-modal').classList.contains('hidden')) closeConfirmModal(false);
  if (event.key === 'Escape' && !$('analysis-progress-modal').classList.contains('hidden')) closeAnalysisProgressModal();
});

$('analyze-missing').addEventListener('click', async () => {
  if (!folderPath || isBusy) return;
  const targetCount = missingCount();
  const confirmed = await openConfirmModal(targetCount);
  if (!confirmed) return;

  prepareAnalysisState();
  analysisResult = null;
  analysisProgress = { total: targetCount, completed: 0, current: '분석 준비 중입니다.', done: false };
  setBusy(true, `누락 태그 ${targetCount}개 파일을 자동 분석하는 중입니다. 예상 시간은 ${formatDuration(targetCount * SECONDS_PER_FILE_ESTIMATE)}입니다...`);
  try {
    const result = await window.musicRenamer.analyzeMissingTags(folderPath);
    analysisResult = result;
    const count = (status) => result.entries.filter((entry) => entry.status === status).length;
    tracks = result.tracks.map((track) => ({ ...track, selected: false }));
    analysisProgress = {
      total: targetCount,
      completed: targetCount,
      current: `분석 완료. 성공 ${count('success')}건 / 건너뜀 ${count('skipped')}건 / 오류 ${count('error')}건`,
      done: true
    };
    $('result-text').textContent = `분석 성공 ${count('success')}건 / 건너뜀 ${count('skipped')}건 / 오류 ${count('error')}건\n로그: ${result.logPath}`;
  } catch (error) {
    analysisResult = { entries: [{ status: 'error', error: error.message }], logPath: '' };
    analysisProgress = {
      total: targetCount,
      completed: analysisProgress?.completed || 0,
      current: `분석 실패: ${error.message}`,
      done: true
    };
    $('result-text').textContent = `분석 실패\n${error.message}`;
  } finally {
    setBusy(false);
  }
});

$('apply').addEventListener('click', async () => {
  if (isBusy) return;
  setBusy(true, '선택한 항목의 ID3 제목을 변경하는 중입니다...');
  try {
    const result = await window.musicRenamer.applyTitles(tracks.filter((track) => track.selected));
    const count = (status) => result.entries.filter((entry) => entry.status === status).length;
    const message = `성공 ${count('success')}건 / 제외 ${count('excluded')}건 / 오류 ${count('error')}건\n로그: ${result.logPath}\n목록을 새로고침했습니다.`;
    await refreshTracksAfterChange(message);
  } finally {
    setBusy(false);
  }
});

$('drop-zone').addEventListener('dragenter', (event) => { event.preventDefault(); $('drop-zone').classList.add('dragging'); });
$('drop-zone').addEventListener('dragover', (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
$('drop-zone').addEventListener('dragleave', () => $('drop-zone').classList.remove('dragging'));
$('drop-zone').addEventListener('drop', async (event) => {
  event.preventDefault();
  $('drop-zone').classList.remove('dragging');
  const file = event.dataTransfer.files[0];
  if (!file) return;
  const droppedPath = window.musicRenamer.getPathForFile(file);
  await load(droppedPath);
});

window.musicRenamer.getLastFolder().then((lastFolder) => load(lastFolder));
showIntroIfNeeded();
