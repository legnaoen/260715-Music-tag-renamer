const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { scanFolder, applyTitles, analyzeMissingTags } = require('./tag-service');

function settingsPath() { return path.join(app.getPath('userData'), 'settings.json'); }
async function readSettings() {
  try { return JSON.parse(await fs.readFile(settingsPath(), 'utf8')); }
  catch { return {}; }
}
async function saveLastFolder(folderPath) {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify({ lastFolder: folderPath }, null, 2), 'utf8');
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280, height: 820, minWidth: 960, minHeight: 620,
    webPreferences: { preload: path.join(__dirname, '../preload/preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  window.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  ipcMain.handle('folder:choose', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.canceled) return null;
    await saveLastFolder(result.filePaths[0]);
    return result.filePaths[0];
  });
  ipcMain.handle('folder:last', () => readSettings().then((settings) => settings.lastFolder || null));
  ipcMain.handle('folder:scan', async (_event, folderPath) => {
    await saveLastFolder(folderPath);
    return scanFolder(folderPath);
  });
  ipcMain.handle('tags:analyze', async (event, folderPath) => analyzeMissingTags(folderPath, (progress) => {
    event.sender.send('tags:analyze-progress', progress);
  }));
  ipcMain.handle('titles:apply', (_event, items) => applyTitles(items));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
