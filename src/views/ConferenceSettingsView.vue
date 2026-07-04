<template>
  <div class="settings-container">
    <div class="settings-inner">
      <header class="settings-header">
        <h1>會議設定</h1>
        <router-link :to="'/chair/' + confId" class="btn btn-secondary">🔙 返回主席控制台</router-link>
      </header>

      <div v-if="!ready" class="loading">載入中...</div>

      <div v-else class="settings-body">
        <section class="card">
          <h3>會議標題</h3>
          <input v-model="localTitle" placeholder="會議／委員會標題" class="title-input" />
        </section>

        <section class="card">
          <h3>代表／國家清單</h3>
          <div class="delegate-add-row">
            <input v-model="newDelegateName" placeholder="國家／代表名稱" @keyup.enter="addDelegate" />
            <select v-model="newDelegateType">
              <option value="member">理事國 (member)</option>
              <option value="observer">觀察員 (observer)</option>
            </select>
            <label class="p5-check"><input type="checkbox" v-model="newDelegateP5" :disabled="newDelegateType !== 'member'" /> P5</label>
            <button class="btn btn-secondary" @click="addDelegate">➕ 新增</button>
          </div>
          <div class="delegate-list">
            <div v-for="(d, i) in localDelegates" :key="i" class="delegate-row">
              <span class="d-name">{{ d.name }}</span>
              <span class="badge badge-neutral">{{ d.type === 'member' ? '理事國' : '觀察員' }}</span>
              <span v-if="d.p5" class="badge badge-warning">P5</span>
              <span v-if="store.stats[d.name]" class="d-warning">已有統計資料</span>
              <button class="btn-remove" @click="removeDelegate(i)">🗑️</button>
            </div>
            <div v-if="localDelegates.length === 0" class="empty">尚無代表，請於上方新增</div>
          </div>
        </section>

        <section class="card">
          <h3>議程時間表</h3>
          <div class="agenda-add-row">
            <input v-model="newAgendaLabel" placeholder="議程名稱（如：議程 1 (5/30 09:30~11:30)）" @keyup.enter="addAgendaItem" />
            <button class="btn btn-secondary" @click="addAgendaItem">➕ 新增</button>
          </div>
          <div class="agenda-list">
            <div v-for="(a, i) in localAgenda" :key="a.id" class="agenda-row">
              <span>{{ a.label }}</span>
              <button class="btn-remove" @click="removeAgendaItem(i)">🗑️</button>
            </div>
            <div v-if="localAgenda.length === 0" class="empty">尚無議程項目，請於上方新增</div>
          </div>
        </section>

        <section class="card">
          <h3>委員會規則</h3>
          <p class="hint">選擇這場會議套用的議事規則，會影響唱名表決的通過標準與可用的投票選項。</p>
          <select v-model="localRuleset" class="vote-rule-select">
            <option value="unsc">安全理事會：實質表決需贊成 ≥ 9 票且無 P5 否決</option>
            <option value="ecosoc">經濟及社會理事會：實質表決簡單多數（贊成 > 反對）、無否決權、唱名決可「棄權並發言」</option>
          </select>
          <p class="rule-note">
            {{ localRuleset === 'ecosoc'
              ? '經社理事會沒有常任理事國與否決權。決議草案／修正案以簡單多數通過（棄權不計入分母）。'
              : '安理會模式：五常（P5）投反對即行使否決權，決議需至少 9 個贊成票且無否決才通過。' }}
          </p>
        </section>

        <section class="card">
          <h3>共同編輯</h3>
          <p class="hint">分享下面的連結給其他主席帳號，對方登入後點「加入」即可跟你一起編輯這場會議（權限跟你完全一樣）。</p>
          <div class="invite-row">
            <input :value="inviteLink" readonly @click="$event.target.select()" />
            <button class="btn btn-secondary" @click="copyInviteLink">{{ copied ? '✅ 已複製' : '📋 複製連結' }}</button>
          </div>
          <div class="editor-list">
            <div v-for="(info, uid) in store.editors" :key="uid" class="editor-row">
              <span>{{ info.email || uid }}</span>
              <span class="editor-date">{{ info.joinedAt ? new Date(info.joinedAt).toLocaleDateString('zh-TW') : '' }}</span>
            </div>
            <div v-if="Object.keys(store.editors).length === 0" class="empty">目前沒有其他共同編輯者</div>
          </div>
          <button v-if="!isOwner" class="btn btn-danger btn-block leave-btn" @click="handleLeave">🚪 退出這場會議的共同編輯</button>
        </section>

        <button class="btn btn-primary btn-block save-btn" :disabled="saving" @click="handleSave">{{ saving ? '儲存中...' : '💾 儲存設定' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConferenceStore } from '../stores/conference'

const route = useRoute()
const router = useRouter()
const store = useConferenceStore()
const confId = route.params.id

const inviteLink = computed(() => window.location.origin + '/join/' + confId)
const copied = ref(false)
const isOwner = computed(() => store.ownerUid && window.firebase?.auth?.currentUser?.uid === store.ownerUid)

async function copyInviteLink() {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch (e) { /* 剪貼簿權限被拒絕時，使用者仍可手動選取上面的網址複製 */ }
}

async function handleLeave() {
  if (!confirm('確定要退出這場會議的共同編輯嗎？')) return
  await store.leaveConference(confId)
  router.push('/')
}

const localTitle = ref('')
const localDelegates = ref([])
const localAgenda = ref([])
const localRuleset = ref('unsc')
const ready = ref(false)
const saving = ref(false)

const newDelegateName = ref('')
const newDelegateType = ref('member')
const newDelegateP5 = ref(false)
const newAgendaLabel = ref('')

function syncFromStore() {
  localTitle.value = store.title
  localDelegates.value = JSON.parse(JSON.stringify(store.delegates))
  localAgenda.value = JSON.parse(JSON.stringify(store.agenda))
  localRuleset.value = store.ruleset || 'unsc'
  ready.value = true
}

function addDelegate() {
  const name = newDelegateName.value.trim()
  if (!name || localDelegates.value.some(d => d.name === name)) return
  localDelegates.value.push({ name, type: newDelegateType.value, p5: newDelegateType.value === 'member' && newDelegateP5.value })
  newDelegateName.value = ''; newDelegateP5.value = false
}
function removeDelegate(i) { localDelegates.value.splice(i, 1) }

function addAgendaItem() {
  const label = newAgendaLabel.value.trim()
  if (!label) return
  const nextId = (localAgenda.value.reduce((max, a) => Math.max(max, a.id || 0), 0)) + 1
  localAgenda.value.push({ id: nextId, label })
  newAgendaLabel.value = ''
}
function removeAgendaItem(i) { localAgenda.value.splice(i, 1) }

async function handleSave() {
  saving.value = true
  try {
    await store.updateMeta({ title: localTitle.value, delegates: localDelegates.value, agenda: localAgenda.value, ruleset: localRuleset.value })
    alert('✅ 設定已儲存')
  } catch (e) {
    alert('❌ 儲存失敗，請重試')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  store.loadConference(confId)
  const stop = watch(() => store.loaded, (v) => { if (v) { syncFromStore(); stop() } }, { immediate: true })
})
</script>

<style scoped>
.settings-container { min-height: 100vh; padding: 40px 24px 60px; }
.settings-inner { max-width: 700px; margin: 0 auto; }
.settings-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.settings-header h1 { font-size: 1.5rem; }
.loading { text-align: center; padding: 60px; color: var(--color-text-muted); }
.settings-body { display: flex; flex-direction: column; gap: 16px; }
h3 { font-size: 1rem; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--color-border); }
.title-input, .vote-rule-select { width: 100%; }
.rule-note { font-size: 0.82rem; color: var(--color-text-secondary); margin: 10px 0 0 0; line-height: 1.6; }
.delegate-add-row, .agenda-add-row { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.delegate-add-row input, .agenda-add-row input { flex: 1; min-width: 160px; }
.p5-check { display: flex; align-items: center; gap: 4px; font-size: 0.85rem; color: var(--color-text-secondary); }
.delegate-list, .agenda-list { max-height: 320px; overflow-y: auto; }
.delegate-row, .agenda-row { display: flex; align-items: center; gap: 10px; padding: 8px 2px; border-bottom: 1px solid var(--color-border); }
.d-name { font-weight: 600; flex: 1; }
.d-warning { font-size: 0.75rem; color: var(--color-warning); }
.btn-remove { background: none; border: none; cursor: pointer; opacity: 0.5; margin-left: auto; }
.btn-remove:hover { opacity: 1; }
.empty { text-align: center; color: var(--color-text-muted); padding: 16px; font-size: 0.9rem; }
.save-btn { padding: 13px; font-size: 1rem; }
.hint { color: var(--color-text-secondary); font-size: 0.88rem; margin-top: 0; }
.invite-row { display: flex; gap: 8px; margin-bottom: 14px; }
.invite-row input { flex: 1; background: var(--color-bg); color: var(--color-text-secondary); font-size: 0.85rem; }
.editor-list { max-height: 200px; overflow-y: auto; }
.editor-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 2px; border-bottom: 1px solid var(--color-border); }
.editor-date { font-size: 0.8rem; color: var(--color-text-muted); }
.leave-btn { margin-top: 14px; }
</style>
