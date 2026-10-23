/**
 * GeStock — application de bureau Windows (Electron).
 *
 * Au démarrage :
 *   1. les données sont placées dans %APPDATA%\GeStock\data (GESTOCK_DATA_DIR) ;
 *   2. le serveur Express embarqué (server/app.mjs) écoute sur 127.0.0.1:<port libre> ;
 *   3. une fenêtre native charge l'application.
 *
 * Une seule instance autorisée ; les liens externes (WhatsApp…) s'ouvrent
 * dans le navigateur système.
 */

const { app, BrowserWindow, shell, dialog, nativeImage } = require('electron');
const path = require('node:path');
const net = require('node:net');
const { pathToFileURL } = require('node:url');

app.setName('GeStock');

// Dossier de données persistant — doit être défini AVANT l'import de db.mjs
process.env.GESTOCK_DATA_DIR = path.join(app.getPath('userData'), 'data');

// Journal de démarrage (diagnostic en mode packagé — pas de console visible)
const fs = require('node:fs');
const LOG_FILE = path.join(app.getPath('userData'), 'startup.log');
const log = (...args) => {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${args.join(' ')}\n`);
  } catch { /* noop */ }
  console.log(...args);
};

let mainWindow = null;
let server = null;

/* ------------------------------------------------------------------ */
/* Serveur embarqué                                                    */
/* ------------------------------------------------------------------ */

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

async function startEmbeddedServer() {
  // En production : bundle ESM unique (autonome — aucun import nu résolu
  // depuis app.asar). En dev : modules ESM sources.
  const bundleBase = path.join(__dirname, '..', 'server', 'server.bundle.mjs');
  const bundlePath = [bundleBase, bundleBase.replace('app.asar', 'app.asar.unpacked')]
    .find(p => fs.existsSync(p));
  const entry = bundlePath
    ? pathToFileURL(bundlePath).href
    : pathToFileURL(path.join(__dirname, '..', 'server', 'desktop-entry.mjs')).href;
  const { createApp } = await import(entry);

  const staticDir = path.join(__dirname, '..', 'dist');
  const { app: expressApp, store } = await createApp({ staticDir });
  const port = await freePort();
  await new Promise((resolve, reject) => {
    server = expressApp.listen(port, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  log(`[GeStock] Serveur embarqué → http://127.0.0.1:${port} (${store.engine})`);
  return port;
}

/* ------------------------------------------------------------------ */
/* Fenêtre                                                             */
/* ------------------------------------------------------------------ */

function createWindow(port) {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  let icon;
  try { icon = nativeImage.createFromPath(iconPath); } catch { icon = undefined; }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 680,
    title: 'GeStock — Gestion Commerciale',
    backgroundColor: '#001F3F',
    autoHideMenuBar: true,
    icon,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) =>
    console.error(`[GeStock] did-fail-load ${code} ${desc} ${url}`));

  // Liens externes (WhatsApp wa.me, etc.) → navigateur système
  const appOrigin = `http://127.0.0.1:${port}`;
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') || url.startsWith('mailto:')) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(appOrigin)) {
      event.preventDefault();
      if (url.startsWith('http') || url.startsWith('mailto:')) shell.openExternal(url);
    }
  });

  mainWindow.loadURL(`${appOrigin}/`)
    .catch(err => console.error('[GeStock] loadURL erreur :', err.message));
}

/* ------------------------------------------------------------------ */
/* Purge unique du stockage web                                        */
/* ------------------------------------------------------------------ */

/**
 * Efface localStorage / IndexedDB / caches du moteur Chromium UNE SEULE FOIS
 * (drapeau fichier dans data/) : les résidus laissés par les anciennes
 * versions — localStorage cloisonné par port, brouillons, anciennes clés —
 * sont définitivement éliminés. La base SQLite (data/gestock.db) n'est pas
 * touchée ; le jeton de session est recréé à la connexion suivante.
 */
const WIPE_FLAG = path.join(process.env.GESTOCK_DATA_DIR, '.webcache_cleared_v1');

async function wipeWebStorageOnce() {
  try {
    if (fs.existsSync(WIPE_FLAG)) return;
    const { session } = require('electron');
    await session.defaultSession.clearStorageData({
      storages: [
        'appcache',
        'cachestorage',
        'cookies',
        'filesystem',
        'indexdb',
        'localstorage',
        'serviceworkers',
        'shadercache',
        'websql'
      ]
    });
    fs.mkdirSync(path.dirname(WIPE_FLAG), { recursive: true });
    fs.writeFileSync(WIPE_FLAG, new Date().toISOString());
    log('[GeStock] Stockage web purgé (localStorage/IndexedDB/cache — une fois)');
  } catch (err) {
    log('[GeStock] Purge du stockage web impossible :', err.message || err);
  }
}

/* ------------------------------------------------------------------ */
/* Cycle de vie                                                        */
/* ------------------------------------------------------------------ */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      log('[GeStock] Démarrage — entry resolution en cours');
      await wipeWebStorageOnce();
      const port = await startEmbeddedServer();
      createWindow(port);
    } catch (err) {
      log('[GeStock] Échec du démarrage :', err.stack || err.message || String(err));
      dialog.showErrorBox(
        'GeStock — Erreur de démarrage',
        `Le serveur embarqué n'a pas pu démarrer.\n\n${err.message || err}`
      );
      app.quit();
    }
  });

  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { try { server?.close(); } catch { /* noop */ } });
}
