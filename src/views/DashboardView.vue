<template>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <h1>🏛️ 我的會議</h1>
      <button class="btn-logout" @click="handleLogout">🚪 登出</button>
    </header>

    <div v-if="showLegacyBanner" class="legacy-banner">
      <span>偵測到舊版會議資料，是否要匯入為新會議？</span>
      <div class="legacy-actions">
        <button :disabled="legacyBusy" class="btn-import" @click="importLegacy">{{ legacyBusy ? '匯入中...' : '✅ 匯入' }}</button>
        <button :disabled="legacyBusy" class="btn-dismiss" @click="dismissLegacy">✕ 略過</button>
      </div>
    </div>

    <div class="create-card">
      <input v-model="newTitle" placeholder="新會議標題（例如：OOMUN 2027 經社理事會）" @keyup.enter="handleCreate" />
      <button :disabled="!newTitle.trim() || creating" @click="handleCreate">{{ creating ? '建立中...' : '➕ 新增會議' }}</button>
    </div>

    <div class="conference-list">
      <div v-if="accountStore.loading" class="empty">載入中...</div>
      <div v-else-if="accountStore.conferences.length === 0" class="empty">尚未建立任何會議，於上方輸入標題開始第一場會議吧！</div>
      <div v-for="c in accountStore.conferences" :key="c.id" class="conference-card" @click="openConference(c.id)">
        <h3>{{ c.title }}</h3>
        <span class="conference-date">{{ c.createdAt ? new Date(c.createdAt).toLocaleDateString('zh-TW') : '' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAccountStore } from '../stores/account'
import { useConferenceStore } from '../stores/conference'

const LEGACY_OWNER_EMAIL = 'saimadeline77@gmail.com'

const router = useRouter()
const accountStore = useAccountStore()
const conferenceStore = useConferenceStore()

const newTitle = ref('')
const creating = ref(false)
const showLegacyBanner = ref(false)
const legacyBusy = ref(false)

function handleLogout() {
  const { auth, authMethods } = window.firebase
  authMethods.signOut(auth).then(() => { router.push('/login') })
}

async function handleCreate() {
  if (!newTitle.value.trim()) return
  creating.value = true
  try {
    const id = await conferenceStore.createConference(newTitle.value.trim())
    router.push('/chair/' + id)
  } catch (e) {
    alert('❌ 建立會議失敗，請重試')
  } finally {
    creating.value = false
  }
}

function openConference(id) { router.push('/chair/' + id) }

function checkLegacyImport() {
  const user = window.firebase?.auth?.currentUser
  if (!user || user.email !== LEGACY_OWNER_EMAIL) return
  const fb = window.firebase
  if (!fb?.db || !fb?.dbMethods?.get) { setTimeout(checkLegacyImport, 300); return }
  Promise.all([
    fb.dbMethods.get(fb.dbMethods.ref(fb.db, 'mun_state')),
    fb.dbMethods.get(fb.dbMethods.ref(fb.db, 'migrations/mun_state_imported_by/' + user.uid))
  ]).then(([legacySnap, flagSnap]) => {
    if (legacySnap.exists() && !flagSnap.exists()) showLegacyBanner.value = true
  }).catch(() => {})
}

async function importLegacy() {
  const user = window.firebase?.auth?.currentUser
  if (!user) return
  legacyBusy.value = true
  try {
    const fb = window.firebase
    const snap = await fb.dbMethods.get(fb.dbMethods.ref(fb.db, 'mun_state'))
    if (!snap.exists()) { showLegacyBanner.value = false; return }
    const old = snap.val()
    const newRef = fb.dbMethods.push(fb.dbMethods.ref(fb.db, 'conferences'))
    const id = newRef.key
    const now = Date.now()
    const meta = {
      title: 'TYMUN 2026 Security Council（舊資料）',
      ownerUid: user.uid,
      createdAt: now,
      delegates: old.delegates || [],
      agenda: [
        { id: 1, label: '議程 1 (5/30 09:30~11:30)' },
        { id: 2, label: '議程 2 (5/30 12:30~14:30)' },
        { id: 3, label: '議程 3 (5/30 14:45~16:10)' },
        { id: 4, label: '議程 4 (5/31 09:00~11:30)' },
        { id: 5, label: '議程 5 (5/31 12:30~14:45)' },
        { id: 6, label: '議程 6 (5/31 15:00~17:00)' }
      ]
    }
    const state = { ...old }
    delete state.delegates
    const updates = {}
    updates['conferences/' + id + '/meta'] = meta
    updates['conferences/' + id + '/state'] = state
    updates['users/' + user.uid + '/conferences/' + id] = { title: meta.title, createdAt: now }
    updates['migrations/mun_state_imported_by/' + user.uid] = true
    await fb.dbMethods.update(fb.dbMethods.ref(fb.db, '/'), updates)
    showLegacyBanner.value = false
    accountStore.loadMyConferences()
    router.push('/chair/' + id)
  } catch (e) {
    alert('❌ 匯入失敗，請重試')
  } finally {
    legacyBusy.value = false
  }
}

async function dismissLegacy() {
  const user = window.firebase?.auth?.currentUser
  if (!user) return
  showLegacyBanner.value = false
  try {
    const fb = window.firebase
    await fb.dbMethods.update(fb.dbMethods.ref(fb.db, '/'), { ['migrations/mun_state_imported_by/' + user.uid]: true })
  } catch (e) {}
}

onMounted(() => {
  accountStore.loadMyConferences()
  checkLegacyImport()
})
</script>

<style scoped>
.dashboard-container { padding: 20px; min-height: 100vh; background: #f4f6f9; font-family: sans-serif; }
.dashboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.dashboard-header h1 { margin: 0; font-size: 1.8rem; color: #2c3e50; }
.btn-logout { background: #607d8b; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; }
.btn-logout:hover { background: #455a64; }

.legacy-banner { display: flex; justify-content: space-between; align-items: center; background: #fff3e0; border: 1px solid #ffb74d; padding: 14px 18px; border-radius: 8px; margin-bottom: 20px; }
.legacy-actions { display: flex; gap: 8px; }
.btn-import { background: #4caf50; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; }
.btn-import:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-dismiss { background: #fff; color: #666; border: 1px solid #ccc; padding: 8px 16px; border-radius: 6px; cursor: pointer; }

.create-card { display: flex; gap: 10px; background: white; padding: 16px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 24px; }
.create-card input { flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; }
.create-card button { padding: 10px 20px; background: #0055a5; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
.create-card button:disabled { opacity: 0.6; cursor: not-allowed; }

.conference-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.conference-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); cursor: pointer; transition: box-shadow 0.15s, transform 0.15s; }
.conference-card:hover { box-shadow: 0 4px 10px rgba(0,0,0,0.12); transform: translateY(-2px); }
.conference-card h3 { margin: 0 0 8px 0; color: #0055a5; font-size: 1.15rem; }
.conference-date { color: #888; font-size: 0.85rem; }
.empty { grid-column: 1 / -1; text-align: center; color: #888; padding: 40px; }
</style>
