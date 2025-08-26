const { contextBridge, ipcRenderer } = require('electron');

// 보안을 위해 제한된 API만 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 앱 정보
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  
  // 파일 시스템 (제한적 접근)
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  
  // 메뉴 이벤트 리스너
  onNewConversation: (callback) => ipcRenderer.on('new-conversation', callback),
  onOpenConversation: (callback) => ipcRenderer.on('open-conversation', callback),
  onSaveConversation: (callback) => ipcRenderer.on('save-conversation', callback),
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),
  onOpenMcpTools: (callback) => ipcRenderer.on('open-mcp-tools', callback),
  onOpenUserGuide: (callback) => ipcRenderer.on('open-user-guide', callback),
  onOpenDeveloperTools: (callback) => ipcRenderer.on('open-developer-tools', callback),
  
  // 이벤트 리스너 제거
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // 시스템 정보
  getSystemInfo: () => ({
    platform: process.platform,
    arch: process.arch,
    version: process.version,
    electronVersion: process.versions.electron
  })
});

// 개발 모드에서만 콘솔 로그 활성화
if (process.env.NODE_ENV === 'development') {
  contextBridge.exposeInMainWorld('devTools', {
    log: (...args) => console.log(...args),
    error: (...args) => console.error(...args),
    warn: (...args) => console.warn(...args)
  });
}
