import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

const sqlite = new SQLiteConnection(CapacitorSQLite);
let db = null;

const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS generations (
  id TEXT PRIMARY KEY,
  serverId TEXT UNIQUE,
  tool TEXT NOT NULL,
  title TEXT,
  prompt TEXT,
  result TEXT,
  metadata TEXT,
  imageLocalPath TEXT,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  serverId TEXT UNIQUE,
  title TEXT,
  body TEXT,
  mediaUrl TEXT,
  embedType TEXT,
  imageUrl TEXT,
  imageLocalPath TEXT,
  category TEXT,
  likesCount INTEGER DEFAULT 0,
  commentsCount INTEGER DEFAULT 0,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT DEFAULT 'local',
  spotifyId TEXT,
  image TEXT,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS playlist_items (
  id TEXT PRIMARY KEY,
  playlistId TEXT NOT NULL,
  generationId TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  FOREIGN KEY (playlistId) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (generationId) REFERENCES generations(id) ON DELETE CASCADE
);
`;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

async function initDB() {
  if (db) return db;

  const platform = Capacitor.getPlatform();

  if (platform === 'web') {
    const { defineCustomElements } = await import('jeep-sqlite/loader');
    defineCustomElements(window);
    await customElements.whenDefined('jeep-sqlite');
    await sqlite.initWebStore();
  }

  await sqlite.checkConnectionsConsistency();
  const isConn = (await sqlite.isConnection('creator_hub', false)).result;

  if (isConn) {
    db = await sqlite.retrieveConnection('creator_hub', false);
  } else {
    db = await sqlite.createConnection('creator_hub', false, 'no-encryption', 1, false);
  }

  await db.open();
  await db.execute(CREATE_TABLES);

  return db;
}

async function reconnectDB() {
  if (db) {
    try { await db.close(); } catch (_) {}
    try { await sqlite.closeConnection('creator_hub', false); } catch (_) {}
    db = null;
  }
  return initDB();
}

export { initDB, uid, reconnectDB };
