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

    <!-- Admin gate -->
    <div v-if="user && !isAdmin" class="admin-gate">
      <div class="admin-gate-inner">
        <div class="admin-icon">&#128274;</div>
        <h2>Admin Access Only</h2>
        <p>This app is currently restricted to admin users.</p>
        <button class="btn-sm" @click="logout">Log out</button>
      </div>
    </div>

    <!-- Tab bar (visible when logged in as admin) -->
    <div v-else-if="user && isAdmin" class="tab-bar">
      <button :class="['tab-btn', { active: activeTab === 'ai' }]" @click="activeTab = 'ai'">AI</button>
      <button :class="['tab-btn', { active: activeTab === 'spotify' }]" @click="activeTab = 'spotify'; fetchSpotifyPlaylists()">Spotify</button>
      <button :class="['tab-btn', { active: activeTab === 'youtube' }]" @click="activeTab = 'youtube'; fetchYoutubePlaylists()">YouTube</button>
      <button :class="['tab-btn', { active: activeTab === 'inbox' }]" @click="activeTab = 'inbox'; fetchPhoneInbox()">Inbox</button>
    </div>

    <!-- Spotify playlists tab -->
    <div v-if="user && isAdmin && activeTab === 'spotify'" class="platform-section">
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

    <!-- YouTube playlists tab -->
    <div v-if="user && isAdmin && activeTab === 'youtube'" class="platform-section">
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

    <!-- Phone inbox tab -->
    <div v-if="user && isAdmin && activeTab === 'inbox'" class="platform-section">
      <div v-if="loadingInbox" class="loading-msg">Loading inbox...</div>
      <div v-else-if="!phoneInbox.length" class="empty-msg" style="padding:40px">No items in inbox</div>
      <div v-else class="inbox-list">
        <button v-if="phoneInbox.length > 1" class="btn accent import-all-btn" @click="importAllInbox">Import All ({{ phoneInbox.length }})</button>
        <div v-for="item in phoneInbox" :key="item._id" class="inbox-item">
          <span class="inbox-type" :class="'type-' + item.generation?.tool">{{ item.generation?.tool }}</span>
          <span class="inbox-prompt">{{ item.generation?.prompt?.slice(0, 60) || item.generation?.metadata?.title || 'Untitled' }}</span>
          <button class="btn-sm accent" @click="importInboxItem(item)">Import</button>
        </div>
      </div>
    </div>

    <!-- AI tab: Upload zone -->
    <template v-if="!user || (isAdmin && activeTab === 'ai')">
    <div v-if="!playlist.length" class="upload-zone" @dragover.prevent="dragOver = true" @dragleave="dragOver = false" @drop.prevent="handleDrop" :class="{ hover: dragOver }">
      <div class="upload-inner">
        <div class="upload-icon">+</div>
        <p class="upload-title">Import AI Content</p>
        <p class="upload-sub">Load .json files or import from your account</p>
        <div class="import-actions">
          <label class="import-btn">
            Browse Files
            <input type="file" accept=".json,application/json" multiple @change="handleFileInput" hidden />
          </label>
          <button v-if="user" class="import-btn account-btn" @click="importFromAccount" :disabled="importingAccount">
            {{ importingAccount ? 'Loading...' : 'Import from Account' }}
          </button>
        </div>
        <p v-if="!user" class="upload-hint">Log in to import your AI Studio history</p>
        <p v-if="importError" class="error" style="margin-top:8px">{{ importError }}</p>
        <input type="file" accept=".json,application/json" multiple @change="handleFileInput" class="file-input" />
      </div>
    </div>

    <!-- Main player -->
    <div v-else class="player-layout">
      <!-- Sidebar playlist -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <h3>Playlist</h3>
          <label class="add-more-btn" title="Browse files">
            +
            <input type="file" accept=".json,application/json" multiple @change="handleFileInput" hidden />
          </label>
          <button v-if="user" class="add-more-btn account-import" @click="importFromAccount" :disabled="importingAccount" title="Import from account">
            {{ importingAccount ? '...' : 'DL' }}
          </button>
        </div>
        <div v-for="(item, i) in playlist" :key="i" class="pl-item" :class="{ active: activeIdx === i }" @click="setActive(i)">
          <span class="pl-title">{{ item.title || 'Untitled' }}</span>
          <span class="pl-type">{{ item.type || 'lyrics' }}</span>
          <button class="pl-remove" @click.stop="removeItem(i)" title="Remove">&times;</button>
        </div>
      </aside>

      <!-- Main content -->
      <main class="content">
        <div v-if="active" class="now-playing">
          <h2 class="song-title">{{ active.title }}</h2>

          <!-- Meta pills -->
          <div class="meta-row" v-if="active.type === 'lyrics'">
            <span v-if="active.key" class="pill key-pill">Key: {{ displayKey }}</span>
            <span v-if="active.bpm" class="pill">{{ active.bpm }} BPM</span>
            <span v-if="active.genre" class="pill">{{ active.genre }}</span>
            <span v-if="active.mood" class="pill">{{ active.mood }}</span>

            <!-- Transpose controls -->
            <div class="transpose-controls" v-if="active.key">
              <button class="tp-btn" @click="transposeSemitones--">-</button>
              <span class="tp-val">{{ transposeSemitones >= 0 ? '+' : '' }}{{ transposeSemitones }}</span>
              <button class="tp-btn" @click="transposeSemitones++">+</button>
              <button v-if="transposeSemitones !== 0" class="tp-btn reset" @click="transposeSemitones = 0">Reset</button>
            </div>
          </div>

          <!-- Volume (lyrics only) -->
          <div v-if="active.type === 'lyrics'" class="volume-row">
            <button class="vol-mute" @click="toggleMute">{{ muted ? 'Unmute' : 'Mute' }}</button>
            <input type="range" min="0" max="1" step="0.01" v-model.number="vol" @input="setVolume(vol)" class="vol-slider" />
            <span class="vol-label">{{ Math.round(vol * 100) }}%</span>
          </div>

          <!-- Controls -->
          <div class="controls">
            <template v-if="active.type === 'lyrics'">
              <button v-if="!isSinging" class="btn accent" @click="startSinging">Sing All</button>
              <button v-if="isSinging && !isPaused" class="btn" @click="pauseSinging">Pause</button>
              <button v-if="isSinging && isPaused" class="btn accent" @click="resumeSinging">Resume</button>
              <button v-if="isSinging" class="btn danger" @click="stopSinging">Stop</button>
            </template>
          </div>

          <!-- Lyrics lines -->
          <div v-if="active.type === 'lyrics' && parsedLines.length" class="lines-container" ref="linesContainer">
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
              <!-- Hold bar -->
              <div v-if="isSinging && displayLineIdx === idx" class="hold-bar"
                :style="{ animationDuration: getLineDuration(line.text) + 's' }"></div>
            </div>
          </div>

          <!-- Chorus -->
          <div v-if="active.type === 'lyrics' && active.chorus" class="chorus-section">
            <h4 class="chorus-label">Chorus</h4>
            <div v-for="(ch, ci) in active.chorusAnnotations || []" :key="ci" class="lyric-line chorus-line">
              <span class="line-text">{{ ch.line }}</span>
              <span v-if="ch.chord" class="line-chord">{{ tpChord(ch.chord) }}</span>
            </div>
            <pre v-if="!active.chorusAnnotations?.length" class="chorus-text">{{ active.chorus }}</pre>
          </div>

          <!-- Poetry -->
          <div v-if="active.type === 'poetry'" class="poem-section">
            <div v-for="(line, idx) in poemLines" :key="idx" class="poem-line">{{ line }}</div>
            <div v-if="active.mood" class="mood-box"><strong>Reading guidance:</strong> {{ active.mood }}</div>
            <div v-if="active.devices?.length" class="devices-section">
              <h4>Literary Devices</h4>
              <div v-for="(d, di) in active.devices" :key="di" class="device-card">
                <span class="device-name">{{ d.device }}</span>
                <span class="device-example">"{{ d.example }}"</span>
                <span class="device-explain">{{ d.explanation }}</span>
              </div>
            </div>
          </div>

          <!-- Image -->
          <div v-if="active.type === 'image'" class="image-section">
            <div class="image-prompt">{{ active.prompt }}</div>
            <img :src="active.imageUrl" class="generated-image" alt="AI Generated" />
          </div>

          <!-- Rhyme -->
          <div v-if="active.type === 'rhyme'" class="rhyme-section">
            <div class="rhyme-prompt">Word: {{ active.prompt }}</div>
            <div v-if="active.rhymes?.length" class="rhyme-group">
              <h4 class="rhyme-group-label">Perfect Rhymes</h4>
              <div class="rhyme-chips">
                <span v-for="r in active.rhymes" :key="r" class="rhyme-chip">{{ r }}</span>
              </div>
            </div>
            <div v-if="active.multiSyllable?.length" class="rhyme-group">
              <h4 class="rhyme-group-label">Multi-Syllable</h4>
              <div class="rhyme-chips">
                <span v-for="r in active.multiSyllable" :key="r" class="rhyme-chip multi">{{ r }}</span>
              </div>
            </div>
            <div v-if="active.slantRhymes?.length" class="rhyme-group">
              <h4 class="rhyme-group-label">Slant Rhymes</h4>
              <div class="rhyme-chips">
                <span v-for="r in active.slantRhymes" :key="r" class="rhyme-chip slant">{{ r }}</span>
              </div>
            </div>
            <div v-if="active.phrases?.length" class="rhyme-group">
              <h4 class="rhyme-group-label">Example Phrases</h4>
              <div v-for="(p, pi) in active.phrases" :key="pi" class="phrase-line">{{ p }}</div>
            </div>
          </div>

        </div>
      </main>
    </div>
    </template>

    <!-- Fixed bottom player bar -->
    <div v-if="isSinging" class="player-bar">
      <div class="pb-progress" :style="{ width: singProgress + '%' }"></div>
      <div class="pb-inner">
        <div class="pb-info">
          <span class="pb-title">{{ active?.title || 'Untitled' }}</span>
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
import { ref, computed, watch, nextTick } from "vue";
import { Preferences } from "@capacitor/preferences";
import { useNoteTone } from "./composables/useNoteTone.js";

const {
  singAllLines, pauseSinging, resumeSinging, stopSinging, jumpToLine,
  transposeNote, transposeChord, transposeKey, getLineDuration,
  isSinging, isPaused, currentLineIdx, volume, setVolume
} = useNoteTone();

// ── Auth ──
// Native (Capacitor) builds always use the real backend.
// Only a desktop browser at localhost uses the dev server.
const isNative = !!(window.Capacitor?.isNativePlatform?.());
const isLocalDev = !isNative && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
const API_URL = isLocalDev ? "http://localhost:5000" : "https://lyrics-api.procreatorhub.com";
const user = ref(null);
const token = ref("");
const showAuth = ref(null);
const authForm = ref({ username: "", email: "", password: "" });
const authError = ref("");
const authLoading = ref(false);
const isAdmin = computed(() => !!user.value?.isAdmin);
const activeTab = ref('ai');

// Load saved token from native storage (survives app updates/reinstalls)
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
  } catch { /* offline — keep token, user stays logged in */ }
};
initAuth();

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
      throw new Error("Can't reach server — check your connection");
    }
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Server error (${res.status})`);
    }
    if (!res.ok) throw new Error(data.message || "Auth failed");
    token.value = data.token;
    await Preferences.set({ key: "lp_token", value: data.token });
    user.value = data;
    showAuth.value = null;
    authForm.value = { username: "", email: "", password: "" };
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

// ── Playlist (persisted to localStorage) ──
const loadSaved = () => {
  try { return JSON.parse(localStorage.getItem("lp_playlist")) || []; } catch { return []; }
};
const playlist = ref(loadSaved());
const activeIdx = ref(0);
watch(playlist, (val) => {
  try { localStorage.setItem("lp_playlist", JSON.stringify(val)); } catch { /* quota */ }
}, { deep: true });
const active = computed(() => playlist.value[activeIdx.value] || null);
const dragOver = ref(false);
const linesContainer = ref(null);

const transposeSemitones = ref(0);
const vol = ref(volume.value);
const muted = ref(false);
let premuteVol = 1;

const toggleMute = () => {
  if (muted.value) {
    vol.value = premuteVol;
    setVolume(premuteVol);
    muted.value = false;
  } else {
    premuteVol = vol.value;
    vol.value = 0;
    setVolume(0);
    muted.value = true;
  }
};

const setActive = (i) => {
  stopSinging();
  activeIdx.value = i;
  transposeSemitones.value = 0;
};

const removeItem = (i) => {
  stopSinging();
  playlist.value.splice(i, 1);
  if (activeIdx.value >= playlist.value.length) activeIdx.value = Math.max(0, playlist.value.length - 1);
};

// ── File handling ──
const loadFiles = async (files) => {
  for (const f of files) {
    if (!f.name.endsWith(".json")) continue;
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      playlist.value.push(data);
    } catch { /* skip invalid */ }
  }
  dragOver.value = false;
  if (playlist.value.length && activeIdx.value === 0) activeIdx.value = 0;
};

const handleDrop = (e) => { loadFiles(e.dataTransfer.files); };
const handleFileInput = (e) => { loadFiles(e.target.files); e.target.value = ""; };

// ── Generation → playlist item converter ──
const generationToPlaylistItem = (g) => {
  const m = g.metadata || {};
  const item = { type: g.tool, generationId: g._id };
  switch (g.tool) {
    case "lyrics":
      item.title = m.key ? `${m.key} | ${m.bpm || ""}bpm` : "Song";
      item.lyrics = g.result;
      item.lineAnnotations = m.lineAnnotations || [];
      item.key = m.key; item.bpm = m.bpm;
      item.chords = m.chords; item.chorusChords = m.chorusChords;
      item.vocalRange = m.vocalRange; item.rhythm = m.rhythm;
      break;
    case "poetry":
      item.title = m.title || "Poem";
      item.poem = g.result;
      item.style = m.style; item.theme = m.theme;
      item.mood = m.mood; item.devices = m.devices || [];
      break;
    case "image":
      item.title = g.prompt?.slice(0, 40) || "Image";
      item.imageUrl = API_URL + g.result;
      item.prompt = g.prompt;
      break;
    case "rhyme":
      item.title = g.prompt?.slice(0, 40) || "Rhyme";
      item.prompt = g.prompt;
      item.rhymes = m.rhymes || []; item.multiSyllable = m.multiSyllable || [];
      item.slantRhymes = m.slantRhymes || []; item.phrases = m.phrases || [];
      break;
  }
  return item;
};

// ── Import from account ──
const importingAccount = ref(false);
const importError = ref("");

const importFromAccount = async () => {
  if (!token.value) return;
  importingAccount.value = true;
  importError.value = "";
  try {
    let page = 1;
    let added = 0;
    let skipped = 0;
    const existingIds = new Set(playlist.value.map(p => p.generationId).filter(Boolean));
    while (true) {
      const res = await fetch(API_URL + "/api/ai/history?page=" + page, {
        headers: { Authorization: "Bearer " + token.value }
      });
      if (!res.ok) throw new Error("Failed to load history");
      const data = await res.json();
      for (const g of data.generations) {
        if (!["lyrics", "poetry", "image", "rhyme"].includes(g.tool)) continue;
        if (existingIds.has(g._id)) { skipped++; continue; }
        playlist.value.push(generationToPlaylistItem(g));
        existingIds.add(g._id);
        added++;
      }
      if (page >= data.pages) break;
      page++;
    }
    if (added === 0) {
      importError.value = skipped > 0 ? `All ${skipped} items already imported` : "No AI generations found in your history";
    }
  } catch (e) {
    importError.value = e.message;
  } finally {
    importingAccount.value = false;
  }
};

// ── Spotify playlists ──
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

// ── YouTube playlists ──
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

// ── Phone inbox ──
const phoneInbox = ref([]);
const loadingInbox = ref(false);

const fetchPhoneInbox = async () => {
  if (!token.value) return;
  loadingInbox.value = true;
  try {
    const res = await fetch(API_URL + "/api/phone-queue", {
      headers: { Authorization: "Bearer " + token.value }
    });
    if (res.ok) {
      const data = await res.json();
      phoneInbox.value = data.items || [];
    }
  } catch { /* offline */ }
  finally { loadingInbox.value = false; }
};

const importInboxItem = async (queueItem) => {
  const g = queueItem.generation;
  if (!g) return;
  playlist.value.push(generationToPlaylistItem(g));
  try {
    await fetch(API_URL + "/api/phone-queue/" + queueItem._id, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token.value }
    });
  } catch { /* imported even if delete fails */ }
  phoneInbox.value = phoneInbox.value.filter(i => i._id !== queueItem._id);
  activeTab.value = "ai";
};

const importAllInbox = async () => {
  for (const item of [...phoneInbox.value]) {
    await importInboxItem(item);
  }
};

// ── Lyrics parsing ──
const parsedLines = computed(() => {
  if (!active.value || active.value.type === "poetry") return [];
  const annotations = active.value.lineAnnotations || [];
  const map = new Map();
  for (const a of annotations) {
    if (a.line) map.set(a.line.trim().toLowerCase(), a);
  }
  const lyricsText = active.value.lyrics || active.value.poem || "";
  const rawLines = lyricsText.split("\n");
  return rawLines.map((raw) => {
    const text = raw.trim();
    const a = map.get(text.toLowerCase()) || null;
    return {
      text: raw,
      note: a?.note || "",
      chord: a?.chord || "",
      direction: a?.direction || ""
    };
  });
});

const poemLines = computed(() => {
  if (!active.value) return [];
  return (active.value.poem || "").split("\n");
});

const displayKey = computed(() => {
  if (!active.value?.key) return "";
  return transposeKey(active.value.key, transposeSemitones.value);
});

const tpNote = (n) => n ? transposeNote(n, transposeSemitones.value) : "";
const tpChord = (c) => c ? transposeChord(c, transposeSemitones.value) : "";

// ── Singing ──
// Build singable lines (lines with notes) and a map from sing index → display index
const singableLines = computed(() => {
  const lines = [];
  const indexMap = [];
  // Default note from the song's key (e.g. "A minor" → "A4"), fallback to C4
  const keyMatch = active.value?.key?.match(/^([A-Ga-g][#b]?)/);
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
  // Map display index to sing index
  const singIdx = singableLines.value.indexMap.indexOf(idx);
  if (singIdx >= 0) jumpToLine(singIdx);
};

// Player bar info
const singProgress = computed(() => {
  if (currentLineIdx.value < 0 || !singableLines.value.lines.length) return 0;
  return ((currentLineIdx.value + 1) / singableLines.value.lines.length) * 100;
});
const currentSingLine = computed(() => {
  if (currentLineIdx.value < 0) return "";
  return singableLines.value.lines[currentLineIdx.value]?.text || "";
});

// Map current sing index back to display index for highlighting + scrolling
const displayLineIdx = computed(() => {
  if (currentLineIdx.value < 0) return -1;
  return singableLines.value.indexMap[currentLineIdx.value] ?? -1;
});

// Auto-scroll during singing
watch(displayLineIdx, async (idx) => {
  if (idx < 0 || !linesContainer.value) return;
  await nextTick();
  const el = linesContainer.value.children[idx];
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
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

/* Upload zone */
.upload-zone {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 40px; position: relative;
}
.upload-inner {
  border: 2px dashed #333; border-radius: 16px; padding: 60px 40px;
  text-align: center; width: 100%; max-width: 500px; position: relative;
  transition: border-color 0.2s;
}
.upload-zone.hover .upload-inner { border-color: #6b21a8; }
.upload-icon { font-size: 3rem; color: #6b21a8; margin-bottom: 12px; }
.upload-title { font-size: 1.1rem; font-weight: 700; color: #e5e5e5; }
.upload-sub { font-size: 0.85rem; color: #666; margin-top: 4px; }
.import-actions { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; justify-content: center; position: relative; z-index: 2; }
.import-btn {
  display: inline-block; padding: 12px 28px;
  background: #6b21a8; color: #fff; border-radius: 10px;
  font-weight: 700; font-size: 0.95rem; cursor: pointer;
  border: none; transition: background 0.15s;
}
.import-btn:hover { background: #7c3aed; }
.import-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.account-btn { background: #1a1a1a; border: 2px solid #6b21a8; color: #c4b5fd; }
.account-btn:hover { background: #6b21a8; color: #fff; }
.upload-hint { font-size: 0.78rem; color: #555; margin-top: 10px; }
.account-import { font-size: 0.65rem; font-weight: 800; }
.file-input {
  position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%;
}

/* Player layout */
.player-layout { flex: 1; display: flex; overflow: hidden; }

/* Sidebar */
.sidebar {
  width: 260px; min-width: 260px; background: #141414;
  border-right: 1px solid #222; overflow-y: auto;
}
.sidebar-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid #222;
}
.sidebar-header h3 { font-size: 0.95rem; color: #c4b5fd; }
.add-more-btn {
  width: 28px; height: 28px; border-radius: 6px; background: #6b21a8;
  color: #fff; font-size: 1.2rem; display: flex; align-items: center;
  justify-content: center; cursor: pointer;
}
.pl-item {
  display: flex; align-items: center; gap: 8px; padding: 10px 16px;
  cursor: pointer; border-bottom: 1px solid #1a1a1a; transition: background 0.15s;
}
.pl-item:hover { background: #1a1a1a; }
.pl-item.active { background: #1f1535; border-left: 3px solid #6b21a8; }
.pl-title { flex: 1; font-size: 0.85rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pl-type { font-size: 0.7rem; color: #666; text-transform: uppercase; }
.pl-remove {
  background: none; border: none; color: #555; font-size: 1.1rem;
  cursor: pointer; padding: 0 4px;
}
.pl-remove:hover { color: #ef4444; }

/* Content */
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
.lines-container { display: flex; flex-direction: column; gap: 2px; }
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
.line-dir {
  font-size: 0.65rem; color: #888; font-style: italic;
}

/* Hold bar */
.hold-bar {
  height: 3px; background: #22c55e; border-radius: 0 0 6px 6px;
  margin: 0 10px; animation: hold-fill linear forwards;
  width: 0;
}
@keyframes hold-fill { from { width: 0; } to { width: 100%; } }

/* Chorus */
.chorus-section {
  margin-top: 20px; padding: 16px; background: #141414;
  border-radius: 8px; border-left: 4px solid #f59e0b;
}
.chorus-label { color: #f59e0b; font-size: 0.85rem; margin-bottom: 8px; }
.chorus-line { padding: 4px 0; }
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

/* Add bottom padding when bar is visible so content isn't hidden behind it */
.lines-container { padding-bottom: 70px; }

/* Admin gate */
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

/* Platform sections (Spotify, YouTube, Inbox) */
.platform-section { flex: 1; overflow-y: auto; padding: 20px; }
.loading-msg { color: #888; text-align: center; padding: 40px; }
.empty-msg { color: #666; text-align: center; font-size: 0.9rem; }

/* Playlist grid */
.playlist-grid { display: flex; flex-direction: column; gap: 8px; }
.playlist-card {
  display: flex; align-items: center; gap: 12px; padding: 12px;
  background: #1a1a1a; border-radius: 10px; cursor: pointer; border: 1px solid #222;
  transition: background 0.15s;
}
.playlist-card:hover { background: #222; }
.playlist-thumb { width: 56px; height: 56px; border-radius: 6px; object-fit: cover; }
.playlist-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.playlist-name { font-size: 0.9rem; font-weight: 700; color: #e5e5e5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.playlist-count { font-size: 0.75rem; color: #888; }

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

/* Inbox */
.inbox-list { display: flex; flex-direction: column; gap: 8px; }
.import-all-btn { align-self: flex-start; margin-bottom: 8px; font-size: 0.82rem; padding: 8px 16px; }
.inbox-item {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  background: #1a1a1a; border-radius: 8px; border: 1px solid #222;
}
.inbox-type {
  font-size: 0.7rem; font-weight: 800; text-transform: uppercase;
  padding: 3px 8px; border-radius: 10px; background: #6b21a8; color: #fff;
}
.inbox-type.type-image { background: #14532d; }
.inbox-type.type-rhyme { background: #78350f; }
.inbox-type.type-poetry { background: #1e3a5f; }
.inbox-prompt { flex: 1; font-size: 0.82rem; color: #ccc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

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

/* Sidebar type colors */
.pl-type {
  font-size: 0.7rem; color: #666; text-transform: uppercase;
}

/* Mobile */
@media (max-width: 700px) {
  .player-layout { flex-direction: column; }
  .sidebar { width: 100%; min-width: unset; max-height: 180px; border-right: none; border-bottom: 1px solid #222; }
  .content { padding: 16px; padding-bottom: 80px; }
  .meta-row { gap: 6px; }
  .tab-bar { padding: 0 8px; }
  .tab-btn { padding: 10px 12px; font-size: 0.8rem; }
  .platform-section { padding: 14px; }
}
</style>
