import { initDB, uid } from './database.js';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

const IMG_DIR = 'creator_hub_images';

// ── Helpers ──

function esc(v) {
  if (v == null) return 'NULL';
  if (typeof v === 'number') return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
}

// ── Generations ──

async function getAllGenerations(toolFilter) {
  const db = await initDB();
  const sql = toolFilter
    ? `SELECT * FROM generations WHERE tool = ? ORDER BY createdAt DESC`
    : `SELECT * FROM generations ORDER BY createdAt DESC`;
  const res = toolFilter
    ? await db.query(sql, [toolFilter])
    : await db.query(sql);
  return (res.values || []).map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : {}
  }));
}

async function getGeneration(id) {
  const db = await initDB();
  const res = await db.query('SELECT * FROM generations WHERE id = ?', [id]);
  if (!res.values?.length) return null;
  const row = res.values[0];
  return { ...row, metadata: row.metadata ? JSON.parse(row.metadata) : {} };
}

async function saveGeneration(item) {
  const db = await initDB();
  // Check if already exists by serverId
  if (item.serverId) {
    const existing = await db.query('SELECT id FROM generations WHERE serverId = ?', [item.serverId]);
    if (existing.values?.length) return existing.values[0].id;
  }
  const id = item.id || uid();
  const meta = typeof item.metadata === 'string' ? item.metadata : JSON.stringify(item.metadata || {});
  await db.run(
    `INSERT OR REPLACE INTO generations (id, serverId, tool, title, prompt, result, metadata, imageLocalPath, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, item.serverId || null, item.tool, item.title || '', item.prompt || '', item.result || '', meta, item.imageLocalPath || null, item.createdAt || new Date().toISOString()]
  );
  return id;
}

async function updateGenerationImage(id, localPath) {
  const db = await initDB();
  await db.run('UPDATE generations SET imageLocalPath = ? WHERE id = ?', [localPath, id]);
}

async function removeGeneration(id) {
  const db = await initDB();
  const gen = await getGeneration(id);
  if (gen?.imageLocalPath) {
    try { await Filesystem.deleteFile({ path: gen.imageLocalPath, directory: Directory.Data }); } catch (_) {}
  }
  await db.run('DELETE FROM playlist_items WHERE generationId = ?', [id]);
  await db.run('DELETE FROM generations WHERE id = ?', [id]);
}

// ── Posts ──

async function getAllPosts() {
  const db = await initDB();
  const res = await db.query('SELECT * FROM posts ORDER BY createdAt DESC');
  return res.values || [];
}

async function savePost(post) {
  const db = await initDB();
  if (post.serverId) {
    const existing = await db.query('SELECT id FROM posts WHERE serverId = ?', [post.serverId]);
    if (existing.values?.length) return existing.values[0].id;
  }
  const id = post.id || uid();
  await db.run(
    `INSERT OR REPLACE INTO posts (id, serverId, title, body, mediaUrl, embedType, imageUrl, imageLocalPath, category, likesCount, commentsCount, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, post.serverId || null, post.title || '', post.body || '', post.mediaUrl || '', post.embedType || '', post.imageUrl || '', post.imageLocalPath || null, post.category || '', post.likesCount || 0, post.commentsCount || 0, post.createdAt || new Date().toISOString()]
  );
  return id;
}

async function updatePostImage(id, localPath) {
  const db = await initDB();
  await db.run('UPDATE posts SET imageLocalPath = ? WHERE id = ?', [localPath, id]);
}

async function removePost(id) {
  const db = await initDB();
  const res = await db.query('SELECT imageLocalPath FROM posts WHERE id = ?', [id]);
  if (res.values?.[0]?.imageLocalPath) {
    try { await Filesystem.deleteFile({ path: res.values[0].imageLocalPath, directory: Directory.Data }); } catch (_) {}
  }
  await db.run('DELETE FROM posts WHERE id = ?', [id]);
}

// ── Playlists ──

async function getAllPlaylists() {
  const db = await initDB();
  const playlists = (await db.query('SELECT * FROM playlists ORDER BY createdAt DESC')).values || [];
  for (const pl of playlists) {
    const items = (await db.query(
      `SELECT pi.id as itemId, pi.position, g.* FROM playlist_items pi
       JOIN generations g ON pi.generationId = g.id
       WHERE pi.playlistId = ? ORDER BY pi.position`,
      [pl.id]
    )).values || [];
    pl.items = items.map(row => ({
      itemId: row.itemId,
      position: row.position,
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    }));
  }
  return playlists;
}

async function createPlaylist(name) {
  const db = await initDB();
  const id = uid();
  await db.run(
    'INSERT INTO playlists (id, name, source, createdAt) VALUES (?, ?, ?, ?)',
    [id, name, 'local', new Date().toISOString()]
  );
  return id;
}

async function renamePlaylist(id, name) {
  const db = await initDB();
  await db.run('UPDATE playlists SET name = ? WHERE id = ?', [name, id]);
}

async function addToPlaylist(playlistId, generationId) {
  const db = await initDB();
  // Get next position
  const res = await db.query('SELECT MAX(position) as maxPos FROM playlist_items WHERE playlistId = ?', [playlistId]);
  const pos = (res.values?.[0]?.maxPos ?? -1) + 1;
  const id = uid();
  await db.run(
    'INSERT INTO playlist_items (id, playlistId, generationId, position) VALUES (?, ?, ?, ?)',
    [id, playlistId, generationId, pos]
  );
}

async function removeFromPlaylist(itemId) {
  const db = await initDB();
  await db.run('DELETE FROM playlist_items WHERE id = ?', [itemId]);
}

async function removePlaylist(id) {
  const db = await initDB();
  await db.run('DELETE FROM playlist_items WHERE playlistId = ?', [id]);
  await db.run('DELETE FROM playlists WHERE id = ?', [id]);
}

// ── Image caching ──

async function downloadImage(url, filename) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const reader = new FileReader();
    const base64 = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const path = `${IMG_DIR}/${filename}`;
    await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Data,
      recursive: true
    });
    return path;
  } catch (e) {
    console.warn('Image download failed:', e);
    return null;
  }
}

function getLocalImageUri(path) {
  if (!path) return null;
  try {
    return Capacitor.convertFileSrc(
      `${Filesystem.getUri({ path, directory: Directory.Data })}`
    );
  } catch {
    return null;
  }
}

async function getLocalImageUrl(path) {
  if (!path) return null;
  try {
    const result = await Filesystem.getUri({ path, directory: Directory.Data });
    return Capacitor.convertFileSrc(result.uri);
  } catch {
    return null;
  }
}

// ── Stats ──

async function getCounts() {
  const db = await initDB();
  const gens = (await db.query('SELECT COUNT(*) as cnt FROM generations')).values?.[0]?.cnt || 0;
  const posts = (await db.query('SELECT COUNT(*) as cnt FROM posts')).values?.[0]?.cnt || 0;
  const pls = (await db.query('SELECT COUNT(*) as cnt FROM playlists')).values?.[0]?.cnt || 0;
  return { generations: gens, posts, playlists: pls };
}

export {
  getAllGenerations, getGeneration, saveGeneration, updateGenerationImage, removeGeneration,
  getAllPosts, savePost, updatePostImage, removePost,
  getAllPlaylists, createPlaylist, renamePlaylist, addToPlaylist, removeFromPlaylist, removePlaylist,
  downloadImage, getLocalImageUri, getLocalImageUrl,
  getCounts
};
