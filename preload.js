const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  listModels: () => ipcRenderer.invoke('list-models'),
  sendMessage: (messages) => ipcRenderer.invoke('send-message', messages),
  loadHistory: () => ipcRenderer.invoke('load-history'),
  onStream: (callback) => ipcRenderer.on('ollama-stream', (_, chunk) => callback(chunk)),
  onStreamEnd: (callback) => ipcRenderer.on('ollama-stream-end', callback)
})