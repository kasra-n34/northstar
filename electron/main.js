import { app, BrowserWindow, ipcMain, Notification, shell } from 'electron'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

async function waitForBackend(port = 3001) {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/api/health`)
      if (res.ok) return
    } catch {}
    await new Promise(r => setTimeout(r, 300))
  }
}

async function startBackend() {
  const userData = app.getPath('userData')
  process.env.NORTHSTAR_DATA_DIR = userData
  process.env.NORTHSTAR_ENV_PATH = path.join(userData, '.env')

  // On first run, copy .env from packaged backend if user already set up their key
  if (!fs.existsSync(process.env.NORTHSTAR_ENV_PATH)) {
    const sourceEnv = path.join(process.resourcesPath, 'backend', '.env')
    if (fs.existsSync(sourceEnv)) {
      fs.copyFileSync(sourceEnv, process.env.NORTHSTAR_ENV_PATH)
    }
  }

  const serverPath = path.join(process.resourcesPath, 'backend', 'server.js')
  await import(pathToFileURL(serverPath).href)
  await waitForBackend()
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  // Route all new-window navigations to the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '..', 'northstar-frontend', 'dist', 'index.html'))
  }
}

ipcMain.on('notify', (_event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show()
  }
})

ipcMain.on('open-external', (_event, url) => {
  shell.openExternal(url)
})

app.whenReady().then(async () => {
  if (!isDev) await startBackend()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
