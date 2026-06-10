<template>
  <div class="app">
    <!-- Auth bar -->
    <header class="top-bar">
      <h1 class="logo">Lyrics Player</h1>
      <div v-if="user" class="user-info">
        <span class="username">{{ user.name }}</span>
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
          <input v-if="showAuth === 'signup'" v-model="authForm.name" placeholder="Display name" required class="input" />
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

    <!-- Upload zone -->
    <div v-if="!playlist.length" class="upload-zone" @dragover.prevent="dragOver = true" @dragleave="dragOver = false" @drop.prevent="handleDrop" :class="{ hover: dragOver }">
      <div class="upload-inner">
        <div class="upload-icon">+</div>
        <p class="upload-title">Import Lyrics / Poetry</p>
        <p class="upload-sub">Load .json files exported from AI Studio</p>
        <label class="import-btn">
          Browse Files
          <input type="file" accept=".json,application/json" multiple @change="handleFileInput" hidden />
        </label>
        <input type="file" accept=".json,application/json" multiple @change="handleFileInput" class="file-input" />
      </div>
    </div>

    <!-- Main player -->
    <div v-else class="player-layout">
      <!-- Sidebar playlist -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <h3>Playlist</h3>
          <label class="add-more-btn">
            +
            <input type="file" accept=".json,application/json" multiple @change="handleFileInput" hidden />
          </label>
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

          <!-- Volume -->
          <div class="volume-row">
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
              :class="{ singing: isSinging && currentLineIdx === idx, past: isSinging && idx < currentLineIdx }"
              @click="handleLineClick(idx)">
              <div class="lyric-line">
                <span class="line-num">{{ idx + 1 }}</span>
                <span class="line-text">{{ line.text }}</span>
                <span v-if="line.note" class="line-note">{{ tpNote(line.note) }}</span>
                <span v-if="line.chord" class="line-chord">{{ tpChord(line.chord) }}</span>
                <span v-if="line.direction" class="line-dir">{{ line.direction }}</span>
              </div>
              <!-- Hold bar -->
              <div v-if="isSinging && currentLineIdx === idx" class="hold-bar"
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

        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from "vue";
import { useNoteTone } from "./composables/useNoteTone.js";

const {
  singAllLines, pauseSinging, resumeSinging, stopSinging, jumpToLine,
  transposeNote, transposeChord, transposeKey, getLineDuration,
  isSinging, isPaused, currentLineIdx, volume, setVolume
} = useNoteTone();

// ── Auth ──
const API_URL = "https://bradford-uniprotkb-cross-june.trycloudflare.com";
const user = ref(null);
const token = ref(localStorage.getItem("lp_token") || "");
const showAuth = ref(null);
const authForm = ref({ name: "", email: "", password: "" });
const authError = ref("");
const authLoading = ref(false);

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
      localStorage.removeItem("lp_token");
    }
  } catch { /* offline */ }
};
checkAuth();

const handleAuth = async () => {
  authError.value = "";
  authLoading.value = true;
  const endpoint = showAuth.value === "login" ? "/login" : "/signup";
  const body = showAuth.value === "login"
    ? { email: authForm.value.email, password: authForm.value.password }
    : { name: authForm.value.name, email: authForm.value.email, password: authForm.value.password };
  try {
    const res = await fetch(API_URL + "/api/users" + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Auth failed");
    token.value = data.token;
    localStorage.setItem("lp_token", data.token);
    user.value = data;
    showAuth.value = null;
    authForm.value = { name: "", email: "", password: "" };
  } catch (e) {
    authError.value = e.message;
  } finally {
    authLoading.value = false;
  }
};

const logout = () => {
  user.value = null;
  token.value = "";
  localStorage.removeItem("lp_token");
};

// ── Playlist ──
const playlist = ref([]);
const activeIdx = ref(0);
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

// ── Lyrics parsing ──
const parsedLines = computed(() => {
  if (!active.value || active.value.type === "poetry") return [];
  const annotations = active.value.lineAnnotations || [];
  const lyricsText = active.value.lyrics || active.value.poem || "";
  const rawLines = lyricsText.split("\n");
  return rawLines.map((text, i) => ({
    text,
    note: annotations[i]?.note || "",
    chord: annotations[i]?.chord || "",
    direction: annotations[i]?.direction || ""
  }));
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
const startSinging = () => {
  if (!parsedLines.value.length) return;
  singAllLines(parsedLines.value, active.value.key || "C4");
};

const handleLineClick = (idx) => {
  if (isSinging.value) jumpToLine(idx);
};

// Auto-scroll during singing
watch(currentLineIdx, async (idx) => {
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
.import-btn {
  display: inline-block; margin-top: 16px; padding: 12px 32px;
  background: #6b21a8; color: #fff; border-radius: 10px;
  font-weight: 700; font-size: 1rem; cursor: pointer;
  position: relative; z-index: 2; transition: background 0.15s;
}
.import-btn:hover { background: #7c3aed; }
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

/* Mobile */
@media (max-width: 700px) {
  .player-layout { flex-direction: column; }
  .sidebar { width: 100%; min-width: unset; max-height: 180px; border-right: none; border-bottom: 1px solid #222; }
  .content { padding: 16px; }
  .meta-row { gap: 6px; }
}
</style>
