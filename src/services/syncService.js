import { saveGeneration, updateGenerationImage, savePost, updatePostImage, downloadImage } from './contentService.js';
import { initDB } from './database.js';

function getApiUrl() {
  const isNative = !!(window.Capacitor?.isNativePlatform?.());
  const isLocalDev = !isNative && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  return isLocalDev ? 'http://localhost:5000' : 'https://lyrics-api.procreatorhub.com';
}

function genTitle(g) {
  const m = g.metadata || {};
  switch (g.tool) {
    case 'lyrics': return m.key ? `${m.key} | ${m.bpm || ''}bpm` : 'Song';
    case 'poetry': return m.title || 'Poem';
    case 'image': return g.prompt?.slice(0, 40) || 'Image';
    case 'rhyme': return g.prompt?.slice(0, 40) || 'Rhyme';
    default: return 'Untitled';
  }
}

async function getExistingServerIds(table) {
  const db = await initDB();
  const res = await db.query(`SELECT serverId FROM ${table} WHERE serverId IS NOT NULL`);
  return new Set((res.values || []).map(r => r.serverId));
}

async function syncGenerations(token, onProgress) {
  const API = getApiUrl();
  const existing = await getExistingServerIds('generations');
  let page = 1;
  let synced = 0;
  let total = 0;

  while (true) {
    const res = await fetch(`${API}/api/ai/history?page=${page}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch generation history');
    const data = await res.json();
    if (page === 1) total = data.total || 0;

    for (const g of data.generations) {
      if (!['lyrics', 'poetry', 'image', 'rhyme'].includes(g.tool)) continue;
      if (existing.has(g._id)) { synced++; continue; }

      const id = await saveGeneration({
        serverId: g._id,
        tool: g.tool,
        title: genTitle(g),
        prompt: g.prompt || '',
        result: g.result || '',
        metadata: g.metadata || {},
        createdAt: g.createdAt
      });

      // Download image for image generations
      if (g.tool === 'image' && id) {
        const imgUrl = `${API}/api/ai/image/${g._id}`;
        const localPath = await downloadImage(imgUrl, `gen_${g._id}.png`);
        if (localPath) await updateGenerationImage(id, localPath);
      }

      synced++;
      if (onProgress) onProgress({ synced, total, type: 'generations' });
    }

    if (page >= data.pages) break;
    page++;
  }

  return synced;
}

async function syncPosts(token, onProgress) {
  const API = getApiUrl();
  const existing = await getExistingServerIds('posts');

  const res = await fetch(`${API}/api/posts/mine`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch posts');
  const posts = await res.json();
  let synced = 0;

  for (const p of posts) {
    if (existing.has(p._id)) { synced++; continue; }

    const id = await savePost({
      serverId: p._id,
      title: p.title || '',
      body: p.body || '',
      mediaUrl: p.mediaUrl || '',
      embedType: p.embedType || '',
      imageUrl: p.imageUrl || '',
      category: p.category || '',
      likesCount: p.likes?.length || 0,
      commentsCount: p.comments?.length || 0,
      createdAt: p.createdAt
    });

    // Download post image if exists
    if (p.imageUrl && id) {
      const localPath = await downloadImage(p.imageUrl, `post_${p._id}.jpg`);
      if (localPath) await updatePostImage(id, localPath);
    }

    synced++;
    if (onProgress) onProgress({ synced, total: posts.length, type: 'posts' });
  }

  return synced;
}

async function syncAll(token, onProgress) {
  const results = { generations: 0, posts: 0 };

  if (onProgress) onProgress({ phase: 'generations', synced: 0, total: 0 });
  results.generations = await syncGenerations(token, (p) => {
    if (onProgress) onProgress({ ...p, phase: 'generations' });
  });

  if (onProgress) onProgress({ phase: 'posts', synced: 0, total: 0 });
  results.posts = await syncPosts(token, (p) => {
    if (onProgress) onProgress({ ...p, phase: 'posts' });
  });

  return results;
}

export { syncGenerations, syncPosts, syncAll };
