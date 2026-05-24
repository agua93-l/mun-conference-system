<template>
  <div class="screen-container">
    <header class="screen-header">
      <h1>&#127963; TYMUN 2026 安全理事會會議畫面</h1>
      <div class="status-bar">
        <span class="phase">{{ store.meetingPhase }}</span>
        <span class="agenda-display">📌 {{ store.currentSection }}</span>
        <span class="time">{{ currentTime }}</span>
      </div>
    </header>

    <main class="screen-content">
      <!-- ✅ 1. 點名模式：恢復網格佈局 -->
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
        <div v-if="store.rollCallFinished" class="roll-call-summary">
          <div class="attendance-count">
            <strong>✅ 出席理事國：{{ store.rollCallThresholds.present }} 席</strong>
          </div>
          <div class="voting-thresholds">
            <div class="threshold-item"><span>✓ 簡單多數</span><strong>{{ store.rollCallThresholds.simple }}</strong></div>
            <div class="threshold-item"><span>✓✓ 絕對多數 (2/3)</span><strong>{{ store.rollCallThresholds.twoThirds }}</strong></div>
            <div class="threshold-item"><span>🔢 1/5 提議門檻</span><strong>{{ store.rollCallThresholds.oneFifth }}</strong></div>
          </div>
        </div>
      </section>

      <!-- 動議表決模式 -->
      <section v-else-if="store.screenMode === 'motion_voting' && store.currentVotingMotion" class="mode-panel motion-voting-panel">
        <h2 class="voting-title">🗳️ 動議表決</h2>
        <div class="motion-detail-large">
          <p class="motion-type">類型：{{ store.currentVotingMotion.type }}</p>
          <p class="motion-country">動議國：{{ store.currentVotingMotion.country }}</p>
          <p v-if="store.currentVotingMotion.details.topic" class="motion-topic">主題：{{ store.currentVotingMotion.details.topic }}</p>
          <p v-if="store.currentVotingMotion.details.totalTime" class="motion-duration">總時長：{{ store.currentVotingMotion.details.totalTime }} 分鐘</p>
        </div>
        <div v-if="store.motionQueue.length > 0" class="next-motions">
          <h3>📜 待決動議清單</h3>
          <div v-for="(m, i) in store.motionQueue" :key="m.id" class="queue-item">
            <span class="q-num">{{ i + 1 }}</span>
            <span class="q-text">{{ m.type }} - {{ m.country }}</span>
          </div>
        </div>
      </section>

      <!-- ✅ 2. 有主持核心磋商：只在該模式時顯示 -->
      <section v-else-if="store.screenMode === 'mod_caucus'" class="mode-panel">
        <h2>🎤 有主持核心磋商</h2>
        <div class="topic">主題：{{ store.modCaucusTopic || '未指定' }}</div>
        <div class="timers">
          <div class="timer-box"><span>總時長</span><div class="time">{{ formatTime(store.modCaucusTotalTimer) }}</div></div>
          <div class="timer-box"><span>當前發言人</span><div class="speaker">{{ store.currentModSpeaker || '無' }}</div><div class="time">{{ formatTime(store.modCaucusSpeakerTimer) }}</div></div>
        </div>
        <div class="mod-list-large">
          <h3>發言順序</h3>
          <div v-for="(spk, i) in store.modCaucusList" :key="i" class="mod-list-item-large">
            <span class="mod-number">{{ i + 1 }}</span><span class="mod-country">{{ spk.country }}</span>
          </div>
          <div v-if="store.modCaucusList.length === 0" class="empty-large">暫無順序</div>
        </div>
      </section>

      <!-- 其他模式 -->
      <section v-else-if="store.screenMode === 'caucus'" class="mode-panel"><h2>{{ store.meetingPhase }}</h2><div class="timer-large">{{ formatTime(store.caucusTotalTimer) }}</div></section>
      <section v-else-if="store.screenMode === 'p5_closed'" class="mode-panel"><h2>🔒 P5 閉門協商</h2><div class="timer-large">{{ formatTime(store.p5Timer) }}</div></section>
      <section v-else-if="store.screenMode === 'suspended'" class="mode-panel"><h2>⏸️ 會議暫停</h2></section>

      <!-- 預設模式 -->
      <section v-else class="default-panel">
        <div class="info-grid-split">
          <div class="card full-height">
            <h3 class="large-section-title">🎤 常設發言人名單</h3>
            <div class="current-speaker"><span>當前：{{ store.currentGeneralSpeaker || '無' }}</span><span class="timer">{{ formatTime(store.generalSpeakerTimer) }}</span></div>
            <div class="list">
              <div v-for="(spk, i) in store.generalList" :key="i" class="general-list-item">{{ spk.country }} ({{ spk.time }}秒)</div>
              <div v-if="store.generalList.length === 0" class="empty">無登記代表</div>
            </div>
          </div>
          <div class="right-split">
            <div class="card roll-call-card">
              <h3>📊 點名統計與投票門檻</h3>
              <div class="roll-call-brief">
                <div class="brief-item"><span class="brief-label">出席理事國</span><span class="brief-value present">{{ store.rollCallThresholds.present }}</span></div>
                <div class="brief-item"><span class="brief-label">遲到</span><span class="brief-value late">{{ Object.values(store.rollCallStatus).filter(s => s === 'late').length }}</span></div>
                <div class="brief-item"><span class="brief-label">缺席</span><span class="brief-value absent">{{ Object.values(store.rollCallStatus).filter(s => s === 'absent').length }}</span></div>
              </div>
              <div class="thresholds-brief">
                <div class="threshold-brief-item"><span>簡單多數</span><strong>{{ store.rollCallThresholds.simple }}</strong></div>
                <div class="threshold-brief-item"><span>絕對多數</span><strong>{{ store.rollCallThresholds.twoThirds }}</strong></div>
                <div class="threshold-brief-item"><span>1/5 門檻</span><strong>{{ store.rollCallThresholds.oneFifth }}</strong></div>
              </div>
            </div>
            <div class="card documents-card">
              <h3>📜 場上文件</h3>
              <div class="doc-list">
                <div v-for="doc in store.documents" :key="doc.number" class="doc-tag">[{{ doc.type }} {{ doc.number }}] {{ doc.title }}</div>
                <div v-if="store.documents.length === 0" class="empty">無公告文件</div>
              </div>
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
function formatTime(sec) { if (!sec && sec !== 0) return '00:00'; const m = Math.floor(sec / 60); const s = sec % 60; return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` }
onMounted(() => { const updateClock = () => { currentTime.value = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) }; updateClock(); clockInterval = setInterval(updateClock, 1000) })
onUnmounted(() => { if (clockInterval) clearInterval(clockInterval) })
</script>

<style scoped>
.screen-container { min-height: 100vh; background: #0f172a; color: #e2e8f0; font-family: system-ui, sans-serif; padding: 20px; }
.screen-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #334155; padding-bottom: 15px; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; }
h1 { margin: 0; font-size: 2.5rem; color: #f8fafc; text-align: center; flex: 1; }
.status-bar { display: flex; gap: 15px; align-items: center; }
.phase { background: #2563eb; padding: 8px 16px; border-radius: 8px; font-weight: 600; }
.agenda-display { background: #059669; padding: 8px 16px; border-radius: 8px; font-weight: 600; }
.time { font-family: monospace; color: #94a3b8; font-size: 1.1rem; }

.mode-panel { text-align: center; padding: 40px 0; }
.timer-large { font-size: 5rem; font-family: monospace; font-weight: bold; color: #38bdf8; margin: 20px 0; }

/* ✅ 1. 恢復點名網格佈局 */
.roll-call-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; max-width: 1000px; margin: 20px auto; }
.roll-call-item { background: #1e293b; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; font-size: 1.2rem; align-items: center; }
.status.present { color: #4ade80; font-weight: bold; }
.status.late { color: #fbbf24; font-weight: bold; }
.status.absent { color: #f87171; font-weight: bold; }

.roll-call-summary { margin-top: 30px; padding: 25px; background: #1e293b; border-radius: 12px; max-width: 900px; margin-left: auto; margin-right: auto; }
.attendance-count { font-size: 2rem; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #334155; color: #4ade80; }
.voting-thresholds { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; }
.threshold-item { background: #0f172a; padding: 18px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; }
.threshold-item span { font-size: 1.1rem; color: #94a3b8; margin-bottom: 8px; }
.threshold-item strong { font-size: 2.2rem; color: #fbbf24; }

/* 動議表決 */
.motion-voting-panel { padding: 60px 20px; }
.voting-title { font-size: 4rem; font-weight: 800; color: #fbbf24; margin-bottom: 30px; letter-spacing: 2px; }
.motion-detail-large { font-size: 2.2rem; line-height: 1.8; margin-bottom: 40px; }
.motion-type, .motion-country, .motion-topic, .motion-duration { margin: 10px 0; }
.next-motions { margin-top: 30px; padding: 20px; background: #1e293b; border-radius: 12px; max-width: 700px; margin-left: auto; margin-right: auto; }
.next-motions h3 { font-size: 1.5rem; color: #94a3b8; margin-bottom: 15px; }
.queue-item { display: flex; gap: 15px; padding: 12px; border-bottom: 1px solid #334155; font-size: 1.4rem; }
.q-num { color: #fbbf24; font-weight: bold; }

/* 有主持核心磋商 */
.mod-list-large { margin-top: 30px; padding: 30px; background: #1e293b; border-radius: 12px; max-width: 800px; margin-left: auto; margin-right: auto; }
.mod-list-item-large { display: flex; align-items: center; gap: 20px; padding: 20px; margin-bottom: 12px; background: #0f172a; border-radius: 8px; font-size: 2.5rem; font-weight: 700; }
.mod-number { color: #fbbf24; min-width: 50px; }
.empty-large { color: #64748b; font-size: 1.5rem; padding: 30px; text-align: center; }

/* 佈局 */
.info-grid-split { display: grid; grid-template-columns: 1fr 1.2fr; gap: 20px; max-width: 1400px; margin: 0 auto; height: calc(100vh - 200px); }
.right-split { display: flex; flex-direction: column; gap: 20px; }
.card { background: #1e293b; padding: 25px; border-radius: 12px; }
.full-height { height: 100%; overflow-y: auto; }
.roll-call-card { flex: 0 0 auto; }
.documents-card { flex: 1; overflow-y: auto; }
.large-section-title { margin-top: 0; border-bottom: 2px solid #334155; padding-bottom: 15px; color: #94a3b8; font-size: 2.2rem; font-weight: 700; }
h3 { margin-top: 0; border-bottom: 1px solid #334155; padding-bottom: 10px; color: #94a3b8; font-size: 1.5rem; }
.current-speaker { font-size: 1.8rem; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; padding: 20px; background: #0f172a; border-radius: 8px; }
.timer { font-family: monospace; color: #fbbf24; font-weight: bold; font-size: 2.2rem; }
.list .general-list-item { padding: 22px 25px; border-bottom: 2px solid #334155; font-size: 2rem; font-weight: 600; min-height: 70px; display: flex; align-items: center; }
.roll-call-brief { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
.brief-item { display: flex; flex-direction: column; align-items: center; padding: 15px; background: #0f172a; border-radius: 8px; }
.brief-label { font-size: 1rem; color: #94a3b8; margin-bottom: 8px; }
.brief-value { font-size: 2.5rem; font-weight: bold; }
.brief-value.present { color: #4ade80; } .brief-value.late { color: #fbbf24; } .brief-value.absent { color: #f87171; }
.thresholds-brief { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.threshold-brief-item { background: #0f172a; padding: 15px; border-radius: 8px; text-align: center; }
.threshold-brief-item span { display: block; font-size: 0.95rem; color: #94a3b8; margin-bottom: 5px; }
.threshold-brief-item strong { font-size: 1.8rem; color: #fbbf24; }
.doc-list { display: flex; flex-wrap: wrap; gap: 12px; }
.doc-tag { background: #334155; padding: 12px 20px; border-radius: 8px; font-size: 1.1rem; font-weight: 500; }
.empty { color: #64748b; padding: 20px; text-align: center; font-size: 1.2rem; }
</style>