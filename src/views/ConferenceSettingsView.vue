<template>
  <div class="settings-container">
    <header class="settings-header">
      <h1>⚙️ 會議設定</h1>
      <router-link :to="'/chair/' + confId" class="btn-back">🔙 返回主席控制台</router-link>
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
          <button @click="addDelegate">➕ 新增</button>
        </div>
        <div class="delegate-list">
          <div v-for="(d, i) in localDelegates" :key="i" class="delegate-row">
            <span class="d-name">{{ d.name }}</span>
            <span class="d-type">{{ d.type === 'member' ? '理事國' : '觀察員' }}</span>
            <span v-if="d.p5" class="d-p5">P5</span>
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
          <button @click="addAgendaItem">➕ 新增</button>
        </div>
        <div class="agenda-list">
          <div v-for="(a, i) in localAgenda" :key="a.id" class="agenda-row">
            <span>{{ a.label }}</span>
            <button class="btn-remove" @click="removeAgendaItem(i)">🗑️</button>
          </div>
          <div v-if="localAgenda.length === 0" class="empty">尚無議程項目，請於上方新增</div>
        </div>
      </section>

      <button class="btn-save" :disabled="saving" @click="handleSave">{{ saving ? '儲存中...' : '💾 儲存設定' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useConferenceStore } from '../stores/conference'

const route = useRoute()
const store = useConferenceStore()
const confId = route.params.id

const localTitle = ref('')
const localDelegates = ref([])
const localAgenda = ref([])
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
    await store.updateMeta({ title: localTitle.value, delegates: localDelegates.value, agenda: localAgenda.value })
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
.settings-container { padding: 20px; padding-bottom: 60px; min-height: 100vh; background: #f4f6f9; font-family: sans-serif; }
.settings-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.settings-header h1 { margin: 0; font-size: 1.8rem; color: #2c3e50; }
.btn-back { background: #607d8b; color: white; text-decoration: none; padding: 8px 16px; border-radius: 8px; }
.loading { text-align: center; padding: 60px; color: #888; }
.settings-body { max-width: 700px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
.card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
h3 { margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 10px; }
.title-input { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; box-sizing: border-box; }
.delegate-add-row, .agenda-add-row { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.delegate-add-row input, .agenda-add-row input { flex: 1; min-width: 160px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
select { padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
.p5-check { display: flex; align-items: center; gap: 4px; font-size: 0.9rem; }
.delegate-add-row button, .agenda-add-row button { padding: 8px 14px; background: #0055a5; color: white; border: none; border-radius: 4px; cursor: pointer; }
.delegate-list, .agenda-list { max-height: 320px; overflow-y: auto; }
.delegate-row, .agenda-row { display: flex; align-items: center; gap: 10px; padding: 8px; border-bottom: 1px solid #f0f0f0; }
.d-name { font-weight: 600; flex: 1; }
.d-type { font-size: 0.85rem; color: #666; }
.d-p5 { background: #ffd54f; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
.d-warning { font-size: 0.75rem; color: #e65100; }
.btn-remove { background: none; border: none; cursor: pointer; opacity: 0.6; }
.btn-remove:hover { opacity: 1; }
.empty { text-align: center; color: #888; padding: 16px; }
.btn-save { padding: 14px; background: #4caf50; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1rem; }
.btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
