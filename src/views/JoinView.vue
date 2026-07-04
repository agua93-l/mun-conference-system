<template>
  <div class="join-container">
    <div class="join-card">
      <div v-if="loading" class="loading">載入中...</div>

      <div v-else-if="error" class="error-box">
        <h2>⚠️ 無法加入</h2>
        <p>{{ error }}</p>
        <router-link to="/" class="btn-back">回到我的會議</router-link>
      </div>

      <div v-else-if="alreadyMember" class="already-box">
        <h2>✅ 你已經是這場會議的成員</h2>
        <p class="conf-title">{{ conferenceTitle }}</p>
        <button class="btn btn-primary btn-block" @click="goToChair">前往主席控制台</button>
      </div>

      <div v-else class="confirm-box">
        <h1>🤝 加入共同編輯</h1>
        <p>你即將加入下面這場會議，成為共同編輯，可以跟其他主席一起操作、修改設定：</p>
        <div class="conf-title">{{ conferenceTitle }}</div>
        <button class="btn btn-primary btn-block" :disabled="joining" @click="handleJoin">{{ joining ? '加入中...' : '✅ 加入共同編輯' }}</button>
        <router-link to="/" class="btn-cancel">取消，回到我的會議</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConferenceStore } from '../stores/conference'

const route = useRoute()
const router = useRouter()
const store = useConferenceStore()
const confId = route.params.id

const loading = ref(true)
const error = ref('')
const conferenceTitle = ref('')
const alreadyMember = ref(false)
const joining = ref(false)

function goToChair() { router.push('/chair/' + confId) }

async function handleJoin() {
  joining.value = true
  try {
    await store.joinAsEditor(confId)
    router.push('/chair/' + confId)
  } catch (e) {
    error.value = '加入失敗，請重試'
  } finally {
    joining.value = false
  }
}

onMounted(async () => {
  try {
    const title = await store.fetchConferenceTitle(confId)
    if (!title) { error.value = '這個連結可能已失效，或會議不存在。'; loading.value = false; return }
    conferenceTitle.value = title
    const fb = window.firebase
    const uid = fb.auth.currentUser.uid
    const snap = await fb.dbMethods.get(fb.dbMethods.ref(fb.db, 'users/' + uid + '/conferences/' + confId))
    if (snap.exists()) alreadyMember.value = true
    loading.value = false
  } catch (e) {
    error.value = '載入失敗，請重試'
    loading.value = false
  }
})
</script>

<style scoped>
.join-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
.join-card { background: var(--color-surface); border: 1px solid var(--color-border); padding: 40px; border-radius: var(--radius-lg); width: 100%; max-width: 440px; text-align: center; }
.join-card h1 { font-size: 1.5rem; margin-bottom: 14px; }
.join-card h2 { font-size: 1.2rem; margin-bottom: 10px; }
.join-card p { color: var(--color-text-secondary); line-height: 1.6; }
.conf-title { background: var(--color-accent-soft); border: 1px solid var(--color-accent-border); border-radius: var(--radius-md); padding: 12px 16px; margin: 14px 0 20px 0; font-weight: 600; font-size: 1.05rem; color: var(--color-accent-hover); }
.loading { color: var(--color-text-muted); padding: 20px 0; }
.btn-cancel, .btn-back { display: inline-block; margin-top: 14px; color: var(--color-text-muted); text-decoration: none; font-size: 0.85rem; }
.error-box h2 { color: var(--color-danger); }
</style>
