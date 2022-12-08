// import {startEncrypt} from './encrypt';
import {app, BrowserWindow, ipcMain, shell, type OpenDialogOptions} from 'electron';
import {basename, join} from 'path';
import {URL} from 'url';
import {startEncrypt} from './encrypt';
const {dialog} = require('electron');
import {curry} from 'lodash';

async function createWindow() {
  const browserWindow = new BrowserWindow({
    width: 400,
    height: 640,
    minWidth: 400,
    minHeight: 640,
    show: false, // Use the 'ready-to-show' event to show the instantiated BrowserWindow.
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Sandbox disabled because the demo of preload script depend on the Node.js api
      webviewTag: false, // The webview tag is not recommended. Consider alternatives like an iframe or Electron's BrowserView. @see https://www.electronjs.org/docs/latest/api/webview-tag#warning
      preload: join(app.getAppPath(), 'packages/preload/dist/index.cjs'),
    },
  });

  const sendMessage = (channel: string, message: unknown) => {
    browserWindow.webContents.send(channel, message);
  };
  const curriedSendMessage = curry(sendMessage);
  const sendEncryptMessage = curriedSendMessage('encryptMsg');
  const sendEncryptEndMessage = curriedSendMessage('encryptEnd');

  ipcMain.handle('selectFile', async (_, type: ('file' | 'dir')[]) => {
    let properties = [] as OpenDialogOptions['properties'];
    if (properties !== undefined) {
      if (type.includes('file')) {
        properties.push('openFile');
      }
      if (type.includes('dir')) {
        properties.push('openDirectory');
      }
      if (type.includes('file') && type.includes('dir')) {
        properties = undefined;
      }
    }
    const res = await dialog.showOpenDialog({properties});
    const filePath = res.filePaths[0] ?? '';
    browserWindow.webContents.send('filePath', {path: filePath, basename: basename(filePath)});
  });
  ipcMain.handle(
    'startEncrypt',
    async (
      _,
      args: {
        password: string;
        inputPath: string;
        options?: {
          outputDir?: string;
        };
      },
    ) => {
      await startEncrypt(
        args.password,
        args.inputPath,
        sendEncryptMessage,
        sendEncryptEndMessage,
        args.options,
      );
      browserWindow.webContents.send('encryptEnd', -1);
    },
  );

  ipcMain.handle('showFile', (event, path: string) => {
    shell.showItemInFolder(path);
  });

  /**
   * If the 'show' property of the BrowserWindow's constructor is omitted from the initialization options,
   * it then defaults to 'true'. This can cause flickering as the window loads the html content,
   * and it also has show problematic behaviour with the closing of the window.
   * Use `show: false` and listen to the  `ready-to-show` event to show the window.
   *
   * @see https://github.com/electron/electron/issues/25012 for the afford mentioned issue.
   */
  browserWindow.on('ready-to-show', () => {
    browserWindow?.show();

    if (import.meta.env.DEV) {
      browserWindow?.webContents.openDevTools();
    }
  });

  /**
   * URL for main window.
   * Vite dev server for development.
   * `file://../renderer/index.html` for production and test.
   */
  const pageUrl =
    import.meta.env.DEV && import.meta.env.VITE_DEV_SERVER_URL !== undefined
      ? import.meta.env.VITE_DEV_SERVER_URL
      : new URL('../renderer/dist/index.html', 'file://' + __dirname).toString();

  await browserWindow.loadURL(pageUrl);

  return browserWindow;
}

/**
 * Restore an existing BrowserWindow or Create a new BrowserWindow.
 */
export async function restoreOrCreateWindow() {
  let window = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());

  if (window === undefined) {
    window = await createWindow();
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.focus();
}
