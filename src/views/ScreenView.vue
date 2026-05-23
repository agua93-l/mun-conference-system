<template>
  <div class="screen-container">
    <header class="screen-header">
      <h1>&#127963; TYMUN 2026 安全理事會會議畫面</h1>
      <div class="status-bar">
        <span class="phase">{{ store.meetingPhase }}</span>
        <span class="time">{{ currentTime }}</span>
      </div>
    </header>

    <main class="screen-content">
      <!-- 點名模式 -->
      <section v-if="store.screenMode === 'roll_call'" class="mode-panel">
        <h2>📋 點名進行中</h2>
        <div class="roll-call-grid">
          <div v-for="d in store.delegates" :key="d.name" class="roll-call-item">
            <span class="name">{{ d.name }}</span>
            <span :class="['status', store.rollCallStatus[d.name]]">
              {{ store.rollCallStatus[d.name] === 'present' ? '出席' : store.rollCallStatus[d.name] === 'late' ? '遲到' : store.rollCallStatus[d.name] === 'absent' ? '缺席' : '待點' }}
            </span>
          </div>
        </div>
        <div v-if="store.rollCallFinished" class="thresholds">
          <p>總數: {{ store.rollCallThresholds.total }} | 簡單多數: {{ store.rollCallThresholds.simple }} | 絕對多數: {{ store.rollCallThresholds.absolute }} | 1/5: {{ store.rollCallThresholds.oneFifth }}</p>
        </div>
      </section>

      <!-- 自由磋商/全體諮詢 -->
      <section v-else-if="store.screenMode === 'caucus'" class="mode-panel">
        <h2>{{ store.meetingPhase }}</h2>
        <div class="timer-large">{{ formatTime(store.caucusTotalTimer) }}</div>
      </section>

      <!-- 有主持核心磋商 -->
      <section v-else-if="store.screenMode === 'mod_caucus'" class="mode-panel">
        <h2>🎤 有主持核心磋商</h2>
        <div class="topic">主題：{{ store.modCaucusTopic || '未指定' }}</div>
        <div class="timers">
          <div class="timer-box">
            <span>總時長</span>
            <div class="time">{{ formatTime(store.modCaucusTotalTimer) }}</div>
          </div>
          <div class="timer-box">
            <span>當前發言人</span>
            <div class="speaker">{{ store.currentModSpeaker || '無' }}</div>
            <div class="time">{{ formatTime(store.modCaucusSpeakerTimer) }}</div>
          </div>
        </div>
        <div class="mod-list">
          <h3>發言順序</h3>
          <div v-for="(spk, i) in store.modCaucusList" :key="i" class="list-row">
            <span>{{ i + 1 }}. {{ spk.country }}</span>
          </div>
          <div v-if="store.modCaucusList.length === 0" class="empty">暫無順序</div>
        </div>
      </section>

      <!-- P5閉門 -->
      <section v-else-if="store.screenMode === 'p5_closed'" class="mode-panel">
        <h2>🔒 P5 閉門協商</h2>
        <div class="timer-large">{{ formatTime(store.p5Timer) }}</div>
      </section>

      <!-- 暫停 -->
      <section v-else-if="store.screenMode === 'suspended'" class="mode-panel">
        <h2>⏸️ 會議暫停</h2>
      </section>

      <!-- 動議表決 -->
      <section v-else-if="store.screenMode === 'motion_voting' && store.currentVotingMotion" class="mode-panel">
        <h2>🗳️ 動議表決</h2>
        <div class="motion-detail">
          <p><strong>類型：</strong>{{ store.currentVotingMotion.type }}</p>
          <p><strong>動議國：</strong>{{ store.currentVotingMotion.country }}</p>
          <p v-if="store.currentVotingMotion.details.topic"><strong>主題：</strong>{{ store.currentVotingMotion.details.topic }}</p>
        </div>
      </section>

      <!-- 預設/正式辯論模式 -->
      <section v-else class="default-panel">
        <div class="info-grid">
          <div class="card">
            <h3>🎤 常設發言人名單</h3>
            <div class="current-speaker">
              當前：{{ store.currentGeneralSpeaker || '無' }}
              <span class="timer">{{ formatTime(store.generalSpeakerTimer) }}</span>
            </div>
            <!-- ✅ 加大字體：列表項目使用 .general-list-item 樣式 -->
            <div class="list">
              <div v-for="(spk, i) in store.generalList" :key="i" class="general-list-item">
                {{ spk.country }} ({{ spk.time }}秒)
              </div>
              <div v-if="store.generalList.length === 0" class="empty">無登記代表</div>
            </div>
          </div>

          <div class="card">
            <h3>📜 場上文件</h3>
            <div class="doc-list">
              <div v-for="doc in store.documents" :key="doc.number" class="doc-tag">
                [{{ doc.type }} {{ doc.number }}] {{ doc.title }}
              </div>
              <div v-if="store.documents.length === 0" class="empty">無公告文件</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useConferenceStore } from '../stores/conference'

const store = useConferenceStore()
const currentTime = ref('')
let clockInterval = null

function formatTime(sec) {
  if (!sec && sec !== 0) return '00:00'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

onMounted(() => {
  const updateClock = () => {
    currentTime.value = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })
  }
  updateClock()
  clockInterval = setInterval(updateClock, 1000)
})

onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval)
})
</script>

<style scoped>
.screen-container { min-height: 100vh; background: #0f172a; color: #e2e8f0; font-family: system-ui, sans-serif; padding: 20px; }
.screen-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #334155; padding-bottom: 15px; margin-bottom: 20px; }
h1 { margin: 0; font-size: 1.8rem; color: #f8fafc; text-align: center; width: 100%; }
.status-bar { display: flex; gap: 20px; font-size: 1.1rem; }
.phase { background: #2563eb; padding: 5px 12px; border-radius: 6px; }
.time { font-family: monospace; color: #94a3b8; }

.mode-panel { text-align: center; padding: 40px 0; }
.timer-large { font-size: 5rem; font-family: monospace; font-weight: bold; color: #38bdf8; margin: 20px 0; }
.topic { font-size: 1.5rem; margin: 15px 0; color: #cbd5e1; }
.timers { display: flex; justify-content: center; gap: 40px; margin: 20px 0; }
.timer-box { background: #1e293b; padding: 20px; border-radius: 10px; min-width: 200px; }
.timer-box .time { font-size: 2.5rem; font-family: monospace; color: #fbbf24; margin-top: 10px; }
.speaker { font-size: 1.2rem; color: #94a3b8; margin-top: 5px; }

.roll-call-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; max-width: 900px; margin: 20px auto; }
.roll-call-item { background: #1e293b; padding: 10px; border-radius: 8px; display: flex; justify-content: space-between; }
.status.present { color: #4ade80; }
.status.late { color: #fbbf24; }
.status.absent { color: #f87171; }
.thresholds { margin-top: 20px; font-size: 1.2rem; color: #cbd5e1; }

.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 1000px; margin: 0 auto; }
.card { background: #1e293b; padding: 20px; border-radius: 10px; }
h3 { margin-top: 0; border-bottom: 1px solid #334155; padding-bottom: 10px; color: #94a3b8; }
.current-speaker { font-size: 1.2rem; margin-bottom: 15px; display: flex; justify-content: space-between; }
.timer { font-family: monospace; color: #fbbf24; font-weight: bold; }

/* ✅ 加大常設發言人名單格子（投影專用） */
.list .general-list-item {
  padding: 18px 20px;          /* ✅ 增加上下內距 */
  border-bottom: 2px solid #334155;
  font-size: 1.8rem;           /* ✅ 字體加大（原 1.3rem → 1.8rem） */
  font-weight: 600;            /* ✅ 加粗 */
  line-height: 1.4;            /* ✅ 增加行高 */
  letter-spacing: 0.5px;       /* ✅ 微調字距 */
  min-height: 60px;            /* ✅ 確保格子高度 */
  display: flex;
  align-items: center;
}
.doc-list { display: flex; flex-wrap: wrap; gap: 10px; }
.doc-tag { background: #334155; padding: 6px 12px; border-radius: 6px; font-size: 0.9rem; }
.empty { color: #64748b; padding: 15px 0; }
</style>