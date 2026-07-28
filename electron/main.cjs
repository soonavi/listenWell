const { app, BrowserWindow, shell, dialog } = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')

let mainWindow = null
// True from the moment the user accepts a download until it lands or fails.
// Quitting during that window throws the download away, which is what made the
// app offer the same version again on every launch.
let downloadingUpdate = false

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

  mainWindow = win
  return win
}

/** The window, or null once it has been closed. */
function liveWindow() {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

function showDownloadProgress(percent) {
  const win = liveWindow()
  if (!win) return
  win.setProgressBar(percent < 0 ? -1 : Math.max(0, Math.min(1, percent)))
  win.setTitle(percent < 0 ? 'ListenWell' : `ListenWell — downloading update ${Math.round(percent * 100)}%`)
}

// Updates are checked once at launch and applied only when the user says so.
// The app is unsigned, so Windows SmartScreen still warns on the downloaded
// installer — auto-update removes the "go and find the new release" step, not
// the warning.
function setUpAutoUpdates() {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = false
  // Already the default, but the dialog below promises it out loud, so it is
  // worth stating rather than inheriting.
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', async ({ version }) => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Download', 'Not now'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update available',
      message: `ListenWell ${version} is available.`,
      detail: 'Download it now? It is around 110 MB; the window title and taskbar show the progress, and the update installs when you next quit.',
    })
    if (response !== 0) return

    // Accepting used to be the last visible thing that happened. The installer
    // is ~110 MB, nothing on screen changed, and closing the window quit the
    // app and killed the transfer — so the next launch offered the same
    // version again, forever. Progress is now visible and the quit is held.
    downloadingUpdate = true
    showDownloadProgress(0)
    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      downloadingUpdate = false
      showDownloadProgress(-1)
      // A check nobody asked for can fail quietly. A download they clicked a
      // button for cannot: silence there is indistinguishable from the bug.
      await dialog.showMessageBox({
        type: 'error',
        title: 'Update failed',
        message: `Could not download ListenWell ${version}.`,
        detail: `${error?.message || error}\n\nYou can install it by hand from the releases page instead.`,
      })
      // Nothing is holding the app open any more.
      if (!liveWindow() && process.platform !== 'darwin') app.quit()
    }
  })

  autoUpdater.on('download-progress', ({ percent }) => {
    showDownloadProgress((percent || 0) / 100)
  })

  autoUpdater.on('update-downloaded', async ({ version }) => {
    downloadingUpdate = false
    showDownloadProgress(-1)

    // The window can already be gone: the user closed it mid-download and the
    // process was kept alive to finish the job. There is nobody to ask, and
    // quitting applies the update that was explicitly requested.
    if (!liveWindow()) {
      autoUpdater.quitAndInstall()
      return
    }

    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: `ListenWell ${version} is ready to install.`,
      detail: 'Choosing Later installs it the next time you quit.',
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
  // Hold the process open while an accepted update is still transferring.
  // `update-downloaded` installs it and exits; a failure quits from its own
  // handler. Without this, closing the window mid-download discarded it.
  if (downloadingUpdate) return
  if (process.platform !== 'darwin') app.quit()
})
