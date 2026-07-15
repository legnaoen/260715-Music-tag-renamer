const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('musicRenamer', {
  chooseFolder: () => ipcRenderer.invoke('folder:choose'),
  getLastFolder: () => ipcRenderer.invoke('folder:last'),
  scanFolder: (folderPath) => ipcRenderer.invoke('folder:scan', folderPath),
  analyzeMissingTags: (folderPath) => ipcRenderer.invoke('tags:analyze', folderPath),
  onAnalyzeProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('tags:analyze-progress', listener);
    return () => ipcRenderer.removeListener('tags:analyze-progress', listener);
  },
  applyTitles: (items) => ipcRenderer.invoke('titles:apply', items),
  getPathForFile: (file) => webUtils.getPathForFile(file)
});
