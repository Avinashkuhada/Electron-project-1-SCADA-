import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { spawn } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

let serverProcess = null

function startBackendServer() {
  const rootDir = join(__dirname, '../..')
  const serverPath = join(rootDir, 'server.cjs')
  console.info('[main] Starting backend server with system Node:', serverPath)

  serverProcess = spawn('node', [serverPath], {
    cwd: rootDir,
    shell: false,
    stdio: 'inherit'
  })

  serverProcess.on('error', (err) => {
    console.error('[main] Failed to start server.cjs:', err)
  })
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    frame: false,
    fullscreen: true,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  console.info('[main] BrowserWindow created')

  mainWindow.webContents.on('did-finish-load', () => {
    console.info('[main] Renderer finished loading:', mainWindow.webContents.getURL())
  })

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.error('[main] Renderer failed to load:', {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame
      })
    }
  )

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[main] Renderer process exited:', details)
  })

  mainWindow.on('ready-to-show', () => {
    console.info('[main] Renderer ready; showing window')
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const rendererUrl = process.env['ELECTRON_RENDERER_URL']
    console.info('[main] Loading development renderer:', rendererUrl)
    mainWindow.loadURL(rendererUrl).catch((error) => {
      console.error('[main] Failed to load development renderer:', error)
    })
  } else {
    const rendererPath = join(__dirname, '../renderer/index.html')
    console.info('[main] Loading production renderer:', rendererPath)
    mainWindow.loadFile(rendererPath).catch((error) => {
      console.error('[main] Failed to load production renderer:', error)
    })
  }

  if (is.dev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

app
  .whenReady()
  .then(() => {
    console.info('[main] Application ready; starting backend and window')
    electronApp.setAppUserModelId('com.electron')
    startBackendServer()

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    ipcMain.on('ping', () => console.log('pong'))
    createWindow()

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
  .catch((error) => {
    console.error('[main] Application startup failed:', error)
    app.quit()
  })

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
