const { app, BrowserWindow, shell, dialog } = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0c0c0e',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Open external links in the default browser instead of a new Electron window
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

// Updates are checked once at launch and applied only when the user says so.
// The app is unsigned, so Windows SmartScreen still warns on the downloaded
// installer — auto-update removes the "go and find the new release" step, not
// the warning.
function setUpAutoUpdates() {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = false
  autoUpdater.on('update-available', async ({ version }) => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Download', 'Not now'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update available',
      message: `ListenWell ${version} is available.`,
      detail: 'Download it now? The update installs when you next quit.',
    })
    if (response === 0) autoUpdater.downloadUpdate()
  })

  autoUpdater.on('update-downloaded', async ({ version }) => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: `ListenWell ${version} is ready to install.`,
    })
    if (response === 0) autoUpdater.quitAndInstall()
  })

  // A failed check is not worth interrupting anyone over.
  autoUpdater.on('error', (err) => console.error('Update check failed:', err?.message))

  autoUpdater.checkForUpdates().catch(() => {})
}

app.whenReady().then(() => {
  createWindow()
  setUpAutoUpdates()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
