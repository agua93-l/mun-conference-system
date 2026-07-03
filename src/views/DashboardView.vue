<template>
  <div class="dashboard-container">
    <div class="dashboard-inner">
      <header class="dashboard-header">
        <h1>我的會議</h1>
        <button class="btn btn-ghost" @click="handleLogout">🚪 登出</button>
      </header>

      <div v-if="showLegacyBanner" class="legacy-banner">
        <span>偵測到舊版會議資料，是否要匯入為新會議？</span>
        <div class="legacy-actions">
          <button class="btn btn-success btn-sm" :disabled="legacyBusy" @click="importLegacy">{{ legacyBusy ? '匯入中...' : '✅ 匯入' }}</button>
          <button class="btn btn-secondary btn-sm" :disabled="legacyBusy" @click="dismissLegacy">✕ 略過</button>
        </div>
      </div>

      <div class="create-card">
        <input v-model="newTitle" placeholder="新會議標題（例如：OOMUN 2027 經社理事會）" @keyup.enter="handleCreate" />
        <button class="btn btn-primary" :disabled="!newTitle.trim() || creating" @click="handleCreate">{{ creating ? '建立中...' : '➕ 新增會議' }}</button>
      </div>

      <div class="conference-list">
        <div v-if="accountStore.loading" class="empty">載入中...</div>
        <div v-else-if="accountStore.conferences.length === 0" class="empty">尚未建立任何會議，於上方輸入標題開始第一場會議吧！</div>
        <div v-for="c in accountStore.conferences" :key="c.id" class="conference-card" @click="openConference(c.id)">
          <h3>{{ c.title }}</h3>
          <div class="card-meta">
            <span class="conference-date">{{ c.createdAt ? new Date(c.createdAt).toLocaleDateString('zh-TW') : '' }}</span>
            <span class="badge" :class="c.role === 'editor' ? 'badge-warning' : 'badge-accent'">{{ c.role === 'editor' ? '共同編輯' : '擁有者' }}</span>
          </div>
        </div>
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
.dashboard-container { min-height: 100vh; padding: 40px 24px; }
.dashboard-inner { max-width: 880px; margin: 0 auto; }
.dashboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
.dashboard-header h1 { font-size: 1.6rem; }

.legacy-banner { display: flex; justify-content: space-between; align-items: center; background: var(--color-warning-soft); border: 1px solid var(--color-warning-border); padding: 14px 18px; border-radius: var(--radius-lg); margin-bottom: 20px; color: var(--color-warning); }
.legacy-actions { display: flex; gap: 8px; }

.create-card { display: flex; gap: 10px; background: var(--color-surface); border: 1px solid var(--color-border); padding: 14px; border-radius: var(--radius-lg); margin-bottom: 28px; }
.create-card input { flex: 1; }

.conference-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
.conference-card { background: var(--color-surface); border: 1px solid var(--color-border); padding: 18px; border-radius: var(--radius-lg); cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; }
.conference-card:hover { border-color: var(--color-border-strong); box-shadow: var(--shadow-sm); }
.conference-card h3 { margin: 0 0 10px 0; color: var(--color-text); font-size: 1.05rem; }
.card-meta { display: flex; align-items: center; justify-content: space-between; }
.conference-date { color: var(--color-text-muted); font-size: 0.8rem; }
.empty { grid-column: 1 / -1; text-align: center; color: var(--color-text-muted); padding: 48px; }
</style>
