<template>
  <div class="app">
    <!-- Auth bar -->
    <header class="top-bar">
      <h1 class="logo">Creator Hub</h1>
      <div v-if="user" class="user-info">
        <span class="username">{{ user.username }}</span>
        <button class="btn-sm" @click="logout">Log out</button>
      </div>
      <div v-else class="auth-btns">
        <button class="btn-sm" @click="showAuth = 'login'">Log in</button>
        <button class="btn-sm accent" @click="showAuth = 'signup'">Sign up</button>
      </div>
    </header>

    <!-- Auth modal -->
    <div v-if="showAuth" class="modal-overlay" @click.self="showAuth = null">
      <div class="modal">
        <h2>{{ showAuth === 'login' ? 'Log In' : 'Sign Up' }}</h2>
        <form @submit.prevent="handleAuth">
          <input v-if="showAuth === 'signup'" v-model="authForm.username" placeholder="Username" required class="input" />
          <input v-model="authForm.email" type="email" placeholder="Email" required class="input" />
          <input v-model="authForm.password" type="password" placeholder="Password" required class="input" />
          <p v-if="authError" class="error">{{ authError }}</p>
          <button class="btn accent" :disabled="authLoading">{{ authLoading ? 'Please wait...' : (showAuth === 'login' ? 'Log In' : 'Sign Up') }}</button>
        </form>
        <p class="switch-auth">
          {{ showAuth === 'login' ? "Don't have an account?" : 'Already have an account?' }}
          <a href="#" @click.prevent="showAuth = showAuth === 'login' ? 'signup' : 'login'">
            {{ showAuth === 'login' ? 'Sign up' : 'Log in' }}
          </a>
        </p>
      </div>
    </div>

    <!-- Add to playlist modal -->
    <div v-if="showAddToPlaylist" class="modal-overlay" @click.self="showAddToPlaylist = null">
      <div class="modal">
        <h2>Add to Playlist</h2>
        <div class="playlist-pick-list">
          <div v-for="pl in localPlaylists" :key="pl.id" class="playlist-pick-item" @click="handleAddToPlaylist(pl.id)">
            {{ pl.name }} <span class="pick-count">({{ pl.items?.length || 0 }})</span>
          </div>
          <p v-if="!localPlaylists.length" class="empty-msg" style="padding:12px">No playlists yet</p>
        </div>
        <form class="new-pl-form" @submit.prevent="handleCreateAndAdd">
          <input v-model="newPlaylistName" placeholder="New playlist name..." class="input" />
          <button class="btn-sm accent" type="submit" :disabled="!newPlaylistName.trim()">Create & Add</button>
        </form>
      </div>
    </div>

    <!-- Tab bar -->
    <div v-if="user" class="tab-bar">
      <button :class="['tab-btn', { active: activeTab === 'library' }]" @click="activeTab = 'library'">Library</button>
      <button :class="['tab-btn', { active: activeTab === 'posts' }]" @click="activeTab = 'posts'">Posts</button>
      <button :class="['tab-btn', { active: activeTab === 'playlists' }]" @click="activeTab = 'playlists'">Playlists</button>
      <button :class="['tab-btn', { active: activeTab === 'spotify' }]" @click="activeTab = 'spotify'; fetchSpotifyPlaylists()">Spotify</button>
      <button :class="['tab-btn', { active: activeTab === 'youtube' }]" @click="activeTab = 'youtube'; fetchYoutubePlaylists()">YouTube</button>
      <button :class="['tab-btn', { active: activeTab === 'sync' }]" @click="activeTab = 'sync'">Sync</button>
    </div>

    <!-- Not logged in -->
    <div v-if="!user" class="admin-gate">
      <div class="admin-gate-inner">
        <div class="admin-icon">&#127925;</div>
        <h2>Creator Hub</h2>
        <p>Log in to sync your AI generations, posts, and playlists.</p>
      </div>
    </div>

    <!-- Viewer (when an item is selected) -->
    <div v-if="user && activeItem" class="player-layout">
      <div class="viewer-header">
        <button class="btn-sm back-btn" @click="activeItem = null">&larr; Back</button>
        <button class="btn-sm" @click="showAddToPlaylist = activeItem">+ Playlist</button>
      </div>
      <main class="content">
        <div class="now-playing">
          <h2 class="song-title">{{ activeItem.title }}</h2>

          <!-- Lyrics viewer -->
          <template v-if="activeItem.tool === 'lyrics'">
            <div class="meta-row">
              <span v-if="activeItem.metadata?.key" class="pill key-pill">Key: {{ displayKey }}</span>
              <span v-if="activeItem.metadata?.bpm" class="pill">{{ activeItem.metadata.bpm }} BPM</span>
              <div class="transpose-controls" v-if="activeItem.metadata?.key">
                <button class="tp-btn" @click="transposeSemitones--">-</button>
                <span class="tp-val">{{ transposeSemitones >= 0 ? '+' : '' }}{{ transposeSemitones }}</span>
                <button class="tp-btn" @click="transposeSemitones++">+</button>
                <button v-if="transposeSemitones !== 0" class="tp-btn reset" @click="transposeSemitones = 0">Reset</button>
              </div>
            </div>
            <div v-if="activeItem.tool === 'lyrics'" class="volume-row">
              <button class="vol-mute" @click="toggleMute">{{ muted ? 'Unmute' : 'Mute' }}</button>
              <input type="range" min="0" max="1" step="0.01" v-model.number="vol" @input="setVolume(vol)" class="vol-slider" />
              <span class="vol-label">{{ Math.round(vol * 100) }}%</span>
            </div>
            <div class="controls">
              <button v-if="!isSinging" class="btn accent" @click="startSinging">Sing All</button>
              <button v-if="isSinging && !isPaused" class="btn" @click="pauseSinging">Pause</button>
              <button v-if="isSinging && isPaused" class="btn accent" @click="resumeSinging">Resume</button>
              <button v-if="isSinging" class="btn danger" @click="stopSinging">Stop</button>
            </div>
            <div v-if="parsedLines.length" class="lines-container" ref="linesContainer">
              <div v-for="(line, idx) in parsedLines" :key="idx"
                class="lyric-line-wrap"
                :class="{ singing: isSinging && displayLineIdx === idx, past: isSinging && idx < displayLineIdx }"
                @click="handleLineClick(idx)">
                <div class="lyric-line">
                  <span class="line-num">{{ idx + 1 }}</span>
                  <span class="line-text">{{ line.text }}</span>
                  <span v-if="line.note" class="line-note">{{ tpNote(line.note) }}</span>
                  <span v-if="line.chord" class="line-chord">{{ tpChord(line.chord) }}</span>
                  <span v-if="line.direction" class="line-dir">{{ line.direction }}</span>
                </div>
                <div v-if="isSinging && displayLineIdx === idx" class="hold-bar"
                  :style="{ animationDuration: getLineDuration(line.text) + 's' }"></div>
              </div>
            </div>
            <div v-if="activeItem.metadata?.chorus" class="chorus-section">
              <h4 class="chorus-label">Chorus</h4>
              <pre class="chorus-text">{{ activeItem.metadata.chorus }}</pre>
            </div>
          </template>

          <!-- Poetry viewer -->
          <template v-if="activeItem.tool === 'poetry'">
            <div class="poem-section">
              <div v-for="(line, idx) in poemLines" :key="idx" class="poem-line">{{ line }}</div>
              <div v-if="activeItem.metadata?.mood" class="mood-box"><strong>Reading guidance:</strong> {{ activeItem.metadata.mood }}</div>
              <div v-if="activeItem.metadata?.devices?.length" class="devices-section">
                <h4>Literary Devices</h4>
                <div v-for="(d, di) in activeItem.metadata.devices" :key="di" class="device-card">
                  <span class="device-name">{{ d.device }}</span>
                  <span class="device-example">"{{ d.example }}"</span>
                  <span class="device-explain">{{ d.explanation }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- Image viewer -->
          <template v-if="activeItem.tool === 'image'">
            <div class="image-section">
              <div class="image-prompt">{{ activeItem.prompt }}</div>
              <img :src="activeItemImageSrc" class="generated-image" alt="AI Generated" />
            </div>
          </template>

          <!-- Rhyme viewer -->
          <template v-if="activeItem.tool === 'rhyme'">
            <div class="rhyme-section">
              <div class="rhyme-prompt">Word: {{ activeItem.prompt }}</div>
              <div v-if="activeItem.metadata?.rhymes?.length" class="rhyme-group">
                <h4 class="rhyme-group-label">Perfect Rhymes</h4>
                <div class="rhyme-chips">
                  <span v-for="r in activeItem.metadata.rhymes" :key="r" class="rhyme-chip">{{ r }}</span>
                </div>
              </div>
              <div v-if="activeItem.metadata?.multiSyllable?.length" class="rhyme-group">
                <h4 class="rhyme-group-label">Multi-Syllable</h4>
                <div class="rhyme-chips">
                  <span v-for="r in activeItem.metadata.multiSyllable" :key="r" class="rhyme-chip multi">{{ r }}</span>
                </div>
              </div>
              <div v-if="activeItem.metadata?.slantRhymes?.length" class="rhyme-group">
                <h4 class="rhyme-group-label">Slant Rhymes</h4>
                <div class="rhyme-chips">
                  <span v-for="r in activeItem.metadata.slantRhymes" :key="r" class="rhyme-chip slant">{{ r }}</span>
                </div>
              </div>
              <div v-if="activeItem.metadata?.phrases?.length" class="rhyme-group">
                <h4 class="rhyme-group-label">Example Phrases</h4>
                <div v-for="(p, pi) in activeItem.metadata.phrases" :key="pi" class="phrase-line">{{ p }}</div>
              </div>
            </div>
          </template>
        </div>
      </main>
    </div>

    <!-- Library tab -->
    <div v-if="user && !activeItem && activeTab === 'library'" class="platform-section">
      <div class="filter-chips">
        <button :class="['chip', { active: libraryFilter === '' }]" @click="libraryFilter = ''">All</button>
        <button :class="['chip', { active: libraryFilter === 'lyrics' }]" @click="libraryFilter = 'lyrics'">Lyrics</button>
        <button :class="['chip', { active: libraryFilter === 'poetry' }]" @click="libraryFilter = 'poetry'">Poetry</button>
        <button :class="['chip', { active: libraryFilter === 'image' }]" @click="libraryFilter = 'image'">Images</button>
        <button :class="['chip', { active: libraryFilter === 'rhyme' }]" @click="libraryFilter = 'rhyme'">Rhymes</button>
      </div>
      <div v-if="filteredGenerations.length" class="item-grid">
        <div v-for="gen in filteredGenerations" :key="gen.id" class="item-card" @click="openItem(gen)">
          <img v-if="gen.tool === 'image' && gen.imageLocalPath" :src="gen._localUrl" class="item-thumb" />
          <div v-else class="item-icon" :class="'icon-' + gen.tool">{{ toolIcon(gen.tool) }}</div>
          <div class="item-info">
            <span class="item-title">{{ gen.title }}</span>
            <span class="item-type">{{ gen.tool }}</span>
          </div>
          <button class="pl-remove" @click.stop="handleRemoveGeneration(gen.id)" title="Remove">&times;</button>
        </div>
      </div>
      <p v-else class="empty-msg" style="padding:40px">No content yet. Go to Sync to pull from your account.</p>
    </div>

    <!-- Posts tab -->
    <div v-if="user && !activeItem && activeTab === 'posts'" class="platform-section">
      <div v-if="localPosts.length" class="item-grid">
        <div v-for="post in localPosts" :key="post.id" class="item-card post-card">
          <img v-if="post.imageLocalPath || post.imageUrl" :src="post._localUrl || post.imageUrl" class="item-thumb" />
          <div class="item-info">
            <span class="item-title">{{ post.title || post.body?.slice(0, 50) || 'Untitled' }}</span>
            <span class="item-type">{{ post.category || 'Post' }} &middot; {{ post.likesCount }} likes</span>
          </div>
          <button class="pl-remove" @click.stop="handleRemovePost(post.id)" title="Remove">&times;</button>
        </div>
      </div>
      <p v-else class="empty-msg" style="padding:40px">No posts synced yet. Go to Sync to pull your posts.</p>
    </div>

    <!-- Playlists tab -->
    <div v-if="user && !activeItem && activeTab === 'playlists'" class="platform-section">
      <form class="new-pl-form top-form" @submit.prevent="handleCreatePlaylist">
        <input v-model="newPlaylistName" placeholder="New playlist name..." class="input" />
        <button class="btn-sm accent" type="submit" :disabled="!newPlaylistName.trim()">Create</button>
      </form>
      <div v-if="localPlaylists.length" class="playlist-grid">
        <div v-for="pl in localPlaylists" :key="pl.id" class="playlist-card" @click="openPlaylist(pl)">
          <div class="pl-icon">&#9835;</div>
          <div class="playlist-info">
            <span class="playlist-name">{{ pl.name }}</span>
            <span class="playlist-count">{{ pl.items?.length || 0 }} items</span>
          </div>
          <button class="pl-remove" @click.stop="handleRemovePlaylist(pl.id)" title="Remove">&times;</button>
        </div>
      </div>

      <!-- Playlist detail view -->
      <div v-if="activePlaylist" class="playlist-detail">
        <div class="detail-header">
          <button class="btn-sm" @click="activePlaylist = null">&larr; Back</button>
          <h3>{{ activePlaylist.name }}</h3>
        </div>
        <div v-if="activePlaylist.items?.length" class="item-grid">
          <div v-for="item in activePlaylist.items" :key="item.itemId" class="item-card" @click="openItem(item)">
            <div class="item-icon" :class="'icon-' + item.tool">{{ toolIcon(item.tool) }}</div>
            <div class="item-info">
              <span class="item-title">{{ item.title }}</span>
              <span class="item-type">{{ item.tool }}</span>
            </div>
            <button class="pl-remove" @click.stop="handleRemoveFromPlaylist(item.itemId)" title="Remove">&times;</button>
          </div>
        </div>
        <p v-else class="empty-msg" style="padding:20px">Playlist is empty</p>
      </div>
    </div>

    <!-- Spotify tab -->
    <div v-if="user && !activeItem && activeTab === 'spotify'" class="platform-section">
      <div v-if="loadingSpotify" class="loading-msg">Loading Spotify playlists...</div>
      <div v-else-if="!activeSpotifyPlaylist" class="playlist-grid">
        <div v-for="pl in spotifyPlaylists" :key="pl.id" class="playlist-card" @click="fetchSpotifyTracks(pl.id)">
          <img v-if="pl.image" :src="pl.image" class="playlist-thumb" />
          <div class="playlist-info">
            <span class="playlist-name">{{ pl.name }}</span>
            <span class="playlist-count">{{ pl.tracks }} tracks</span>
          </div>
        </div>
        <p v-if="!spotifyPlaylists.length" class="empty-msg">No Spotify playlists found</p>
      </div>
      <div v-else class="track-list-view">
        <button class="btn-sm back-btn" @click="activeSpotifyPlaylist = null; spotifyTracks = []">&larr; Back</button>
        <div v-for="t in spotifyTracks" :key="t.id || t.uri" class="track-item">
          <img v-if="t.album?.images?.[0]?.url" :src="t.album.images[0].url" class="track-thumb" />
          <div class="track-info">
            <span class="track-name">{{ t.name }}</span>
            <span class="track-artist">{{ t.artists?.map(a => a.name).join(', ') }}</span>
          </div>
          <a :href="'https://open.spotify.com/track/' + (t.id || t.uri?.split(':').pop())" target="_blank" class="track-link">Open</a>
        </div>
        <p v-if="!spotifyTracks.length" class="empty-msg">No tracks found</p>
      </div>
    </div>

    <!-- YouTube tab -->
    <div v-if="user && !activeItem && activeTab === 'youtube'" class="platform-section">
      <div v-if="loadingYoutube" class="loading-msg">Loading YouTube playlists...</div>
      <div v-else-if="!activeYoutubePlaylist" class="playlist-grid">
        <div v-for="pl in youtubePlaylists" :key="pl.id" class="playlist-card" @click="fetchYoutubeTracks(pl.id)">
          <img v-if="pl.image" :src="pl.image" class="playlist-thumb" />
          <div class="playlist-info">
            <span class="playlist-name">{{ pl.name }}</span>
            <span class="playlist-count">{{ pl.tracks }} tracks</span>
          </div>
        </div>
        <p v-if="!youtubePlaylists.length" class="empty-msg">No YouTube playlists found</p>
      </div>
      <div v-else class="track-list-view">
        <button class="btn-sm back-btn" @click="activeYoutubePlaylist = null; youtubeTracks = []">&larr; Back</button>
        <div v-for="t in youtubeTracks" :key="t.videoId || t.id" class="track-item">
          <img v-if="t.thumbnail" :src="t.thumbnail" class="track-thumb" />
          <div class="track-info">
            <span class="track-name">{{ t.title || t.name }}</span>
            <span class="track-artist">{{ t.channelTitle || t.artist || '' }}</span>
          </div>
          <a :href="'https://youtube.com/watch?v=' + (t.videoId || t.id)" target="_blank" class="track-link">Open</a>
        </div>
        <p v-if="!youtubeTracks.length" class="empty-msg">No tracks found</p>
      </div>
    </div>

    <!-- Sync tab -->
    <div v-if="user && !activeItem && activeTab === 'sync'" class="platform-section sync-section">
      <div class="sync-card">
        <h3>Sync from ProCreatorHub</h3>
        <p class="sync-desc">Pull your AI generations, images, and posts from procreatorhub.com</p>
        <div class="sync-stats">
          <span class="sync-stat">{{ counts.generations }} generations</span>
          <span class="sync-stat">{{ counts.posts }} posts</span>
          <span class="sync-stat">{{ counts.playlists }} playlists</span>
        </div>
        <p v-if="lastSyncTime" class="sync-last">Last synced: {{ lastSyncTime }}</p>
        <button class="btn accent" @click="handleSync" :disabled="syncing">
          {{ syncing ? syncStatus : 'Sync Now' }}
        </button>
        <p v-if="syncError" class="error" style="margin-top:8px">{{ syncError }}</p>
        <p v-if="syncResult" class="sync-result">{{ syncResult }}</p>
      </div>
    </div>

    <!-- Fixed bottom player bar -->
    <div v-if="isSinging" class="player-bar">
      <div class="pb-progress" :style="{ width: singProgress + '%' }"></div>
      <div class="pb-inner">
        <div class="pb-info">
          <span class="pb-title">{{ activeItem?.title || 'Untitled' }}</span>
          <span class="pb-line">{{ currentSingLine }}</span>
        </div>
        <div class="pb-controls">
          <button v-if="!isPaused" class="pb-btn" @click="pauseSinging">| |</button>
          <button v-else class="pb-btn accent" @click="resumeSinging">&#9654;</button>
          <button class="pb-btn danger" @click="stopSinging">&#9632;</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from "vue";
import { Preferences } from "@capacitor/preferences";
import { useNoteTone } from "./composables/useNoteTone.js";
import { initDB } from "./services/database.js";
import * as content from "./services/contentService.js";
import { syncAll } from "./services/syncService.js";

const {
  singAllLines, pauseSinging, resumeSinging, stopSinging, jumpToLine,
  transposeNote, transposeChord, transposeKey, getLineDuration,
  isSinging, isPaused, currentLineIdx, volume, setVolume
} = useNoteTone();

// ── Auth ──
const isNative = !!(window.Capacitor?.isNativePlatform?.());
const isLocalDev = !isNative && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
const API_URL = isLocalDev ? "http://localhost:5000" : "https://lyrics-api.procreatorhub.com";
const user = ref(null);
const token = ref("");
const showAuth = ref(null);
const authForm = ref({ username: "", email: "", password: "" });
const authError = ref("");
const authLoading = ref(false);
const activeTab = ref('library');

const initAuth = async () => {
  const { value } = await Preferences.get({ key: "lp_token" });
  if (value) {
    token.value = value;
    await checkAuth();
  }
};

const checkAuth = async () => {
  if (!token.value) return;
  try {
    const res = await fetch(API_URL + "/api/users/profile", {
      headers: { Authorization: "Bearer " + token.value }
    });
    if (res.ok) {
      user.value = await res.json();
    } else {
      token.value = "";
      await Preferences.remove({ key: "lp_token" });
    }
  } catch { /* offline */ }
};

const handleAuth = async () => {
  authError.value = "";
  authLoading.value = true;
  const endpoint = showAuth.value === "login" ? "/login" : "/signup";
  const body = showAuth.value === "login"
    ? { email: authForm.value.email, password: authForm.value.password }
    : { username: authForm.value.username, email: authForm.value.email, password: authForm.value.password };
  try {
    let res;
    try {
      res = await fetch(API_URL + "/api/users" + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    } catch {
      throw new Error("Can't reach server");
    }
    let data;
    try { data = await res.json(); } catch { throw new Error(`Server error (${res.status})`); }
    if (!res.ok) throw new Error(data.message || "Auth failed");
    token.value = data.token;
    await Preferences.set({ key: "lp_token", value: data.token });
    user.value = data;
    showAuth.value = null;
    authForm.value = { username: "", email: "", password: "" };
    loadData();
  } catch (e) {
    authError.value = e.message;
  } finally {
    authLoading.value = false;
  }
};

const logout = async () => {
  user.value = null;
  token.value = "";
  await Preferences.remove({ key: "lp_token" });
};

// ── Data ──
const generations = ref([]);
const localPosts = ref([]);
const localPlaylists = ref([]);
const counts = ref({ generations: 0, posts: 0, playlists: 0 });
const activeItem = ref(null);
const activePlaylist = ref(null);
const libraryFilter = ref('');
const newPlaylistName = ref('');
const showAddToPlaylist = ref(null);

const filteredGenerations = computed(() => {
  if (!libraryFilter.value) return generations.value;
  return generations.value.filter(g => g.tool === libraryFilter.value);
});

const toolIcon = (tool) => {
  switch (tool) {
    case 'lyrics': return '&#9835;';
    case 'poetry': return '&#9998;';
    case 'image': return '&#128247;';
    case 'rhyme': return '&#128172;';
    default: return '&#9733;';
  }
};

const loadData = async () => {
  try {
    await initDB();
    generations.value = await content.getAllGenerations();
    // Resolve local image URLs
    for (const gen of generations.value) {
      if (gen.imageLocalPath) {
        gen._localUrl = await content.getLocalImageUrl(gen.imageLocalPath);
      }
    }
    localPosts.value = await content.getAllPosts();
    for (const post of localPosts.value) {
      if (post.imageLocalPath) {
        post._localUrl = await content.getLocalImageUrl(post.imageLocalPath);
      }
    }
    localPlaylists.value = await content.getAllPlaylists();
    counts.value = await content.getCounts();
  } catch (e) {
    console.error('Failed to load data:', e);
  }
};

const openItem = (item) => {
  stopSinging();
  activeItem.value = { ...item };
  transposeSemitones.value = 0;
};

const openPlaylist = (pl) => {
  activePlaylist.value = pl;
};

const handleRemoveGeneration = async (id) => {
  await content.removeGeneration(id);
  await loadData();
};

const handleRemovePost = async (id) => {
  await content.removePost(id);
  await loadData();
};

const handleCreatePlaylist = async () => {
  if (!newPlaylistName.value.trim()) return;
  await content.createPlaylist(newPlaylistName.value.trim());
  newPlaylistName.value = '';
  await loadData();
};

const handleRemovePlaylist = async (id) => {
  await content.removePlaylist(id);
  activePlaylist.value = null;
  await loadData();
};

const handleAddToPlaylist = async (playlistId) => {
  if (!showAddToPlaylist.value) return;
  await content.addToPlaylist(playlistId, showAddToPlaylist.value.id);
  showAddToPlaylist.value = null;
  await loadData();
};

const handleCreateAndAdd = async () => {
  if (!newPlaylistName.value.trim() || !showAddToPlaylist.value) return;
  const plId = await content.createPlaylist(newPlaylistName.value.trim());
  await content.addToPlaylist(plId, showAddToPlaylist.value.id);
  newPlaylistName.value = '';
  showAddToPlaylist.value = null;
  await loadData();
};

const handleRemoveFromPlaylist = async (itemId) => {
  await content.removeFromPlaylist(itemId);
  await loadData();
  // Refresh active playlist
  if (activePlaylist.value) {
    activePlaylist.value = localPlaylists.value.find(p => p.id === activePlaylist.value.id) || null;
  }
};

// ── Sync ──
const syncing = ref(false);
const syncStatus = ref('');
const syncError = ref('');
const syncResult = ref('');
const lastSyncTime = ref('');

const loadLastSync = async () => {
  const { value } = await Preferences.get({ key: "ch_last_sync" });
  if (value) lastSyncTime.value = new Date(value).toLocaleString();
};

const handleSync = async () => {
  if (!token.value) return;
  syncing.value = true;
  syncError.value = '';
  syncResult.value = '';
  syncStatus.value = 'Starting sync...';
  try {
    const results = await syncAll(token.value, (p) => {
      if (p.phase === 'generations') {
        syncStatus.value = `Syncing generations... ${p.synced || 0}`;
      } else if (p.phase === 'posts') {
        syncStatus.value = `Syncing posts... ${p.synced || 0}`;
      }
    });
    const now = new Date().toISOString();
    await Preferences.set({ key: "ch_last_sync", value: now });
    lastSyncTime.value = new Date(now).toLocaleString();
    syncResult.value = `Synced ${results.generations} generations, ${results.posts} posts`;
    await loadData();
  } catch (e) {
    syncError.value = e.message;
  } finally {
    syncing.value = false;
    syncStatus.value = '';
  }
};

// ── Spotify ──
const spotifyPlaylists = ref([]);
const spotifyTracks = ref([]);
const activeSpotifyPlaylist = ref(null);
const loadingSpotify = ref(false);

const fetchSpotifyPlaylists = async () => {
  if (!token.value || spotifyPlaylists.value.length) return;
  loadingSpotify.value = true;
  try {
    const res = await fetch(API_URL + "/api/spotify/playlists", {
      headers: { Authorization: "Bearer " + token.value }
    });
    if (res.ok) {
      const data = await res.json();
      spotifyPlaylists.value = data.playlists || [];
    }
  } catch { /* offline */ }
  finally { loadingSpotify.value = false; }
};

const fetchSpotifyTracks = async (playlistId) => {
  activeSpotifyPlaylist.value = playlistId;
  spotifyTracks.value = [];
  try {
    const res = await fetch(API_URL + "/api/spotify/playlist/" + playlistId + "/tracks");
    if (res.ok) {
      const data = await res.json();
      spotifyTracks.value = data.items || [];
    }
  } catch { /* offline */ }
};

// ── YouTube ──
const youtubePlaylists = ref([]);
const youtubeTracks = ref([]);
const activeYoutubePlaylist = ref(null);
const loadingYoutube = ref(false);

const fetchYoutubePlaylists = async () => {
  if (!token.value || youtubePlaylists.value.length) return;
  loadingYoutube.value = true;
  try {
    const res = await fetch(API_URL + "/api/youtube/playlists", {
      headers: { Authorization: "Bearer " + token.value }
    });
    if (res.ok) {
      const data = await res.json();
      youtubePlaylists.value = data.playlists || [];
    }
  } catch { /* offline */ }
  finally { loadingYoutube.value = false; }
};

const fetchYoutubeTracks = async (playlistId) => {
  activeYoutubePlaylist.value = playlistId;
  youtubeTracks.value = [];
  try {
    const res = await fetch(API_URL + "/api/youtube/playlist/" + playlistId + "/tracks", {
      headers: { Authorization: "Bearer " + token.value }
    });
    if (res.ok) {
      const data = await res.json();
      youtubeTracks.value = data.items || [];
    }
  } catch { /* offline */ }
};

// ── Viewer logic ──
const transposeSemitones = ref(0);
const vol = ref(volume.value);
const muted = ref(false);
let premuteVol = 1;
const linesContainer = ref(null);

const toggleMute = () => {
  if (muted.value) { vol.value = premuteVol; setVolume(premuteVol); muted.value = false; }
  else { premuteVol = vol.value; vol.value = 0; setVolume(0); muted.value = true; }
};

const activeItemImageSrc = computed(() => {
  if (!activeItem.value) return '';
  if (activeItem.value._localUrl) return activeItem.value._localUrl;
  if (activeItem.value.imageUrl) return activeItem.value.imageUrl;
  // Fallback: construct from serverId
  if (activeItem.value.serverId) return `${API_URL}/api/ai/image/${activeItem.value.serverId}`;
  return '';
});

// Lyrics parsing
const parsedLines = computed(() => {
  if (!activeItem.value || activeItem.value.tool !== 'lyrics') return [];
  const meta = activeItem.value.metadata || {};
  const annotations = meta.lineAnnotations || [];
  const map = new Map();
  for (const a of annotations) {
    if (a.line) map.set(a.line.trim().toLowerCase(), a);
  }
  const lyricsText = activeItem.value.result || '';
  return lyricsText.split("\n").map((raw) => {
    const text = raw.trim();
    const a = map.get(text.toLowerCase()) || null;
    return { text: raw, note: a?.note || "", chord: a?.chord || "", direction: a?.direction || "" };
  });
});

const poemLines = computed(() => {
  if (!activeItem.value) return [];
  return (activeItem.value.result || '').split("\n");
});

const displayKey = computed(() => {
  if (!activeItem.value?.metadata?.key) return "";
  return transposeKey(activeItem.value.metadata.key, transposeSemitones.value);
});

const tpNote = (n) => n ? transposeNote(n, transposeSemitones.value) : "";
const tpChord = (c) => c ? transposeChord(c, transposeSemitones.value) : "";

// Singing
const singableLines = computed(() => {
  const lines = [];
  const indexMap = [];
  const keyMatch = activeItem.value?.metadata?.key?.match(/^([A-Ga-g][#b]?)/);
  const defaultNote = keyMatch ? keyMatch[1] + "4" : "C4";
  parsedLines.value.forEach((line, i) => {
    if (line.text.trim()) {
      lines.push({ ...line, note: line.note || defaultNote });
      indexMap.push(i);
    }
  });
  return { lines, indexMap };
});

const startSinging = () => {
  if (!singableLines.value.lines.length) return;
  singAllLines(singableLines.value.lines);
};

const handleLineClick = (idx) => {
  if (!isSinging.value) return;
  const singIdx = singableLines.value.indexMap.indexOf(idx);
  if (singIdx >= 0) jumpToLine(singIdx);
};

const singProgress = computed(() => {
  if (currentLineIdx.value < 0 || !singableLines.value.lines.length) return 0;
  return ((currentLineIdx.value + 1) / singableLines.value.lines.length) * 100;
});
const currentSingLine = computed(() => {
  if (currentLineIdx.value < 0) return "";
  return singableLines.value.lines[currentLineIdx.value]?.text || "";
});
const displayLineIdx = computed(() => {
  if (currentLineIdx.value < 0) return -1;
  return singableLines.value.indexMap[currentLineIdx.value] ?? -1;
});

watch(displayLineIdx, async (idx) => {
  if (idx < 0 || !linesContainer.value) return;
  await nextTick();
  const el = linesContainer.value.children[idx];
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
});

// ── Init ──
onMounted(async () => {
  await initAuth();
  if (user.value) {
    await loadData();
    await loadLastSync();
  }
});

watch(user, async (u) => {
  if (u) {
    await loadData();
    await loadLastSync();
  }
});
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0f0f0f; color: #e5e5e5; font-family: system-ui, -apple-system, sans-serif; }

.app { min-height: 100vh; display: flex; flex-direction: column; }

/* Top bar */
.top-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px; border-bottom: 1px solid #222; background: #141414;
}
.logo { font-size: 1.2rem; font-weight: 800; color: #c4b5fd; }
.user-info { display: flex; align-items: center; gap: 12px; }
.username { font-size: 0.85rem; color: #a78bfa; font-weight: 600; }
.auth-btns { display: flex; gap: 8px; }

.btn-sm {
  padding: 6px 14px; border-radius: 6px; border: 1px solid #333;
  background: transparent; color: #ccc; font-size: 0.8rem; cursor: pointer;
}
.btn-sm:hover { background: #222; }
.btn-sm.accent { background: #6b21a8; color: #fff; border-color: #6b21a8; }
.btn-sm.accent:hover { background: #7c3aed; }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal {
  background: #1a1a1a; border: 1px solid #333; border-radius: 12px;
  padding: 28px; width: 340px; max-width: 90vw;
}
.modal h2 { font-size: 1.2rem; margin-bottom: 16px; color: #e5e5e5; }
.modal form { display: flex; flex-direction: column; gap: 10px; }
.input {
  padding: 10px 12px; border-radius: 8px; border: 1px solid #333;
  background: #0f0f0f; color: #e5e5e5; font-size: 0.9rem;
}
.input:focus { outline: none; border-color: #6b21a8; }
.error { color: #ef4444; font-size: 0.82rem; }
.switch-auth { margin-top: 14px; font-size: 0.82rem; color: #888; }
.switch-auth a { color: #a78bfa; }

.btn {
  padding: 10px 22px; border-radius: 8px; font-weight: 700; font-size: 0.88rem;
  border: 2px solid #333; background: #1a1a1a; color: #ccc; cursor: pointer;
}
.btn:hover { background: #222; }
.btn.accent { background: #6b21a8; color: #fff; border-color: #6b21a8; }
.btn.accent:hover { background: #7c3aed; }
.btn.danger { border-color: #dc2626; color: #ef4444; }
.btn.danger:hover { background: #dc2626; color: #fff; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Admin gate / welcome */
.admin-gate {
  flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px;
}
.admin-gate-inner {
  text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.admin-gate h2 { color: #c4b5fd; font-size: 1.3rem; }
.admin-gate p { color: #888; font-size: 0.9rem; }
.admin-icon { font-size: 2.5rem; }

/* Tab bar */
.tab-bar {
  display: flex; gap: 0; border-bottom: 1px solid #222; background: #141414;
  padding: 0 16px; overflow-x: auto;
}
.tab-btn {
  padding: 10px 18px; background: none; border: none; border-bottom: 2px solid transparent;
  color: #888; font-size: 0.85rem; font-weight: 700; cursor: pointer; white-space: nowrap;
}
.tab-btn.active { color: #c4b5fd; border-bottom-color: #6b21a8; }
.tab-btn:hover { color: #e5e5e5; }

/* Platform sections */
.platform-section { flex: 1; overflow-y: auto; padding: 20px; }
.loading-msg { color: #888; text-align: center; padding: 40px; }
.empty-msg { color: #666; text-align: center; font-size: 0.9rem; }

/* Filter chips */
.filter-chips { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.chip {
  padding: 6px 16px; border-radius: 20px; border: 1px solid #333;
  background: transparent; color: #888; font-size: 0.8rem; font-weight: 600; cursor: pointer;
}
.chip.active { background: #6b21a8; color: #fff; border-color: #6b21a8; }
.chip:hover { border-color: #6b21a8; color: #c4b5fd; }

/* Item grid (library, posts) */
.item-grid { display: flex; flex-direction: column; gap: 6px; }
.item-card {
  display: flex; align-items: center; gap: 12px; padding: 12px;
  background: #1a1a1a; border-radius: 10px; cursor: pointer; border: 1px solid #222;
  transition: background 0.15s;
}
.item-card:hover { background: #222; }
.item-thumb { width: 48px; height: 48px; border-radius: 6px; object-fit: cover; }
.item-icon {
  width: 48px; height: 48px; border-radius: 6px; display: flex;
  align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0;
}
.icon-lyrics { background: #2d1b69; color: #c4b5fd; }
.icon-poetry { background: #1e3a5f; color: #93c5fd; }
.icon-image { background: #14532d; color: #86efac; }
.icon-rhyme { background: #78350f; color: #fbbf24; }
.item-info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.item-title { font-size: 0.88rem; font-weight: 600; color: #e5e5e5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-type { font-size: 0.7rem; color: #666; text-transform: uppercase; }
.pl-remove {
  background: none; border: none; color: #555; font-size: 1.1rem;
  cursor: pointer; padding: 0 4px; flex-shrink: 0;
}
.pl-remove:hover { color: #ef4444; }

/* Playlist grid */
.playlist-grid { display: flex; flex-direction: column; gap: 8px; }
.playlist-card {
  display: flex; align-items: center; gap: 12px; padding: 12px;
  background: #1a1a1a; border-radius: 10px; cursor: pointer; border: 1px solid #222;
  transition: background 0.15s;
}
.playlist-card:hover { background: #222; }
.playlist-thumb { width: 56px; height: 56px; border-radius: 6px; object-fit: cover; }
.playlist-info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.playlist-name { font-size: 0.9rem; font-weight: 700; color: #e5e5e5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.playlist-count { font-size: 0.75rem; color: #888; }
.pl-icon { width: 48px; height: 48px; border-radius: 6px; background: #2d1b69; color: #c4b5fd; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0; }

/* New playlist form */
.new-pl-form { display: flex; gap: 8px; margin-bottom: 12px; }
.new-pl-form .input { flex: 1; }
.top-form { margin-bottom: 16px; }

/* Playlist detail */
.detail-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.detail-header h3 { font-size: 1.1rem; color: #c4b5fd; }

/* Add to playlist modal */
.playlist-pick-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; max-height: 200px; overflow-y: auto; }
.playlist-pick-item {
  padding: 10px 14px; background: #0f0f0f; border-radius: 6px; cursor: pointer;
  font-size: 0.88rem; color: #e5e5e5; border: 1px solid #222;
}
.playlist-pick-item:hover { background: #222; border-color: #6b21a8; }
.pick-count { color: #666; font-size: 0.75rem; }

/* Sync section */
.sync-section { display: flex; justify-content: center; padding-top: 40px; }
.sync-card {
  background: #1a1a1a; border: 1px solid #222; border-radius: 12px;
  padding: 28px; text-align: center; max-width: 400px; width: 100%;
}
.sync-card h3 { color: #c4b5fd; font-size: 1.1rem; margin-bottom: 8px; }
.sync-desc { color: #888; font-size: 0.85rem; margin-bottom: 16px; }
.sync-stats { display: flex; gap: 12px; justify-content: center; margin-bottom: 12px; }
.sync-stat { font-size: 0.8rem; color: #a78bfa; font-weight: 600; }
.sync-last { font-size: 0.75rem; color: #555; margin-bottom: 12px; }
.sync-result { font-size: 0.85rem; color: #22c55e; margin-top: 8px; }

/* Viewer */
.viewer-header {
  display: flex; align-items: center; gap: 10px; padding: 12px 20px;
  border-bottom: 1px solid #222; background: #141414;
}
.player-layout { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.content { flex: 1; overflow-y: auto; padding: 24px; }
.song-title { font-size: 1.5rem; font-weight: 800; color: #c4b5fd; margin-bottom: 12px; }

/* Meta */
.meta-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
.pill {
  padding: 4px 12px; border-radius: 20px; font-size: 0.78rem;
  font-weight: 700; background: #222; color: #a78bfa;
}
.key-pill { background: #6b21a8; color: #fff; }

/* Transpose */
.transpose-controls { display: flex; align-items: center; gap: 4px; }
.tp-btn {
  width: 26px; height: 26px; border-radius: 50%; border: 2px solid #6b21a8;
  background: transparent; color: #c4b5fd; font-weight: 900; font-size: 0.85rem;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.tp-btn:hover { background: #6b21a8; color: #fff; }
.tp-btn.reset { width: auto; border-radius: 12px; padding: 0 10px; font-size: 0.7rem; }
.tp-val { font-size: 0.78rem; color: #888; min-width: 28px; text-align: center; }

/* Volume */
.volume-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.vol-mute {
  padding: 4px 10px; border-radius: 6px; border: 1px solid #333;
  background: transparent; color: #aaa; font-size: 0.75rem; cursor: pointer;
}
.vol-mute:hover { background: #222; }
.vol-slider { flex: 1; max-width: 140px; accent-color: #6b21a8; }
.vol-label { font-size: 0.75rem; color: #666; }

/* Controls */
.controls { display: flex; gap: 10px; margin-bottom: 16px; }

/* Lyrics lines */
.lines-container { display: flex; flex-direction: column; gap: 2px; padding-bottom: 70px; }
.lyric-line-wrap {
  position: relative; border-radius: 6px; transition: background 0.2s; cursor: pointer;
}
.lyric-line-wrap:hover { background: #1a1a1a; }
.lyric-line-wrap.singing { background: #1f1535; }
.lyric-line-wrap.past { opacity: 0.5; }
.lyric-line {
  display: flex; align-items: baseline; gap: 10px; padding: 6px 10px;
}
.line-num { font-size: 0.7rem; color: #444; min-width: 20px; text-align: right; }
.line-text {
  flex: 1; font-family: Georgia, "Times New Roman", serif;
  font-size: 1rem; line-height: 1.8; color: #e5e5e5;
}
.line-note {
  font-size: 0.7rem; font-weight: 800; color: #22c55e;
  background: #14532d33; padding: 2px 8px; border-radius: 10px;
}
.line-chord {
  font-size: 0.7rem; font-weight: 800; color: #f59e0b;
  background: #78350f33; padding: 2px 8px; border-radius: 10px;
}
.line-dir { font-size: 0.65rem; color: #888; font-style: italic; }

/* Hold bar */
.hold-bar {
  height: 3px; background: #22c55e; border-radius: 0 0 6px 6px;
  margin: 0 10px; animation: hold-fill linear forwards; width: 0;
}
@keyframes hold-fill { from { width: 0; } to { width: 100%; } }

/* Chorus */
.chorus-section {
  margin-top: 20px; padding: 16px; background: #141414;
  border-radius: 8px; border-left: 4px solid #f59e0b;
}
.chorus-label { color: #f59e0b; font-size: 0.85rem; margin-bottom: 8px; }
.chorus-text { color: #ccc; font-family: Georgia, serif; white-space: pre-wrap; }

/* Poetry */
.poem-section { margin-top: 16px; }
.poem-line {
  font-family: Georgia, "Times New Roman", serif; font-size: 1rem;
  line-height: 1.9; color: #e5e5e5; padding: 2px 0;
}
.mood-box {
  margin-top: 16px; padding: 12px 16px; background: #1f1535;
  border-radius: 8px; font-size: 0.85rem; color: #c4b5fd;
}
.mood-box strong { font-weight: 800; }
.devices-section { margin-top: 20px; }
.devices-section h4 { color: #c4b5fd; font-size: 0.95rem; margin-bottom: 10px; }
.device-card {
  display: flex; flex-direction: column; gap: 2px;
  padding: 10px 14px; background: #141414; border-radius: 8px;
  margin-bottom: 8px; border: 1px solid #222;
}
.device-name { font-weight: 800; font-size: 0.82rem; color: #a78bfa; text-transform: uppercase; }
.device-example { font-style: italic; font-size: 0.88rem; color: #e5e5e5; font-family: Georgia, serif; }
.device-explain { font-size: 0.8rem; color: #888; }

/* Image section */
.image-section { text-align: center; }
.image-prompt { font-size: 0.85rem; color: #888; margin-bottom: 16px; font-style: italic; }
.generated-image { max-width: 100%; border-radius: 12px; border: 1px solid #333; }

/* Rhyme section */
.rhyme-section { display: flex; flex-direction: column; gap: 16px; }
.rhyme-prompt { font-size: 1rem; font-weight: 700; color: #c4b5fd; }
.rhyme-group { display: flex; flex-direction: column; gap: 8px; }
.rhyme-group-label { font-size: 0.85rem; font-weight: 800; color: #a78bfa; }
.rhyme-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.rhyme-chip {
  padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;
  background: #2d1b69; color: #c4b5fd;
}
.rhyme-chip.multi { background: #14532d; color: #86efac; }
.rhyme-chip.slant { background: #78350f; color: #fbbf24; }
.phrase-line {
  font-family: Georgia, serif; font-size: 0.9rem; color: #ccc;
  padding: 4px 0; line-height: 1.7; font-style: italic;
}

/* Track list */
.track-list-view { display: flex; flex-direction: column; gap: 6px; }
.back-btn { align-self: flex-start; margin-bottom: 8px; }
.track-item {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  background: #1a1a1a; border-radius: 8px; border: 1px solid #1f1f1f;
}
.track-thumb { width: 40px; height: 40px; border-radius: 4px; object-fit: cover; }
.track-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.track-name { font-size: 0.85rem; font-weight: 600; color: #e5e5e5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.track-artist { font-size: 0.75rem; color: #888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.track-link {
  font-size: 0.75rem; font-weight: 700; color: #a78bfa; text-decoration: none;
  padding: 4px 10px; border: 1px solid #6b21a8; border-radius: 6px; white-space: nowrap;
}
.track-link:hover { background: #6b21a8; color: #fff; }

/* Fixed bottom player bar */
.player-bar {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
  background: #1a1a1a; border-top: 1px solid #333;
}
.pb-progress {
  position: absolute; top: 0; left: 0; height: 3px;
  background: #6b21a8; transition: width 0.3s ease;
}
.pb-inner {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px; gap: 12px;
}
.pb-info { flex: 1; min-width: 0; }
.pb-title {
  display: block; font-size: 0.7rem; color: #888;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.pb-line {
  display: block; font-size: 0.85rem; color: #e5e5e5;
  font-family: Georgia, serif; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
.pb-controls { display: flex; gap: 8px; flex-shrink: 0; }
.pb-btn {
  width: 40px; height: 40px; border-radius: 50%; border: 2px solid #333;
  background: #222; color: #ccc; font-size: 1rem; font-weight: 900;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.pb-btn:hover { background: #333; }
.pb-btn.accent { background: #6b21a8; border-color: #6b21a8; color: #fff; }
.pb-btn.accent:hover { background: #7c3aed; }
.pb-btn.danger { border-color: #dc2626; color: #ef4444; }
.pb-btn.danger:hover { background: #dc2626; color: #fff; }

/* Mobile */
@media (max-width: 700px) {
  .content { padding: 16px; padding-bottom: 80px; }
  .meta-row { gap: 6px; }
  .tab-bar { padding: 0 4px; }
  .tab-btn { padding: 10px 10px; font-size: 0.75rem; }
  .platform-section { padding: 14px; }
  .sync-card { padding: 20px; }
}
</style>
