import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  notify:       (title, body) => ipcRenderer.send('notify', { title, body }),
  openExternal: (url)         => ipcRenderer.send('open-external', url),
})
