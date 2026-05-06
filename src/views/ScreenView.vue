<template>
  <div class="screen-container">
    <!-- 點名系統專屬頁面 -->
    <div v-if="store.screenMode === 'roll_call'" class="overlay roll-call-screen">
      <h1>📋 點名進行中</h1>
      <p class="subtitle">Roll Call in Progress</p>
      
      <div v-if="!store.rollCallFinished" class="rc-progress">
        <div class="rc-big-text">正在點名：{{ currentCallingCountry }}</div>
        <div class="rc-counter">{{ markedCount }} / {{ totalCount }} 席已完成</div>
        <div class="rc-bar-bg"><div class="rc-bar-fill" :style="{ width: progressPercent + '%' }"></div></div>
      </div>

      <div v-else class="rc-results">
        <h2>✅ 點名完畢 - 表決門檻計算</h2>
        <p class="subtitle">理事國席次總數：{{ store.rollCallThresholds.total }} 席（已排除觀察員）</p>
        <div class="threshold-grid">
          <div class="th-card simple">
            <span class="th-label">簡單多數決 (1/2+1)</span>
            <span class="th-num">{{ store.rollCallThresholds.simple }}</span>
            <span class="th-desc">需 ≥ {{ store.rollCallThresholds.simple }} 票通過</span>
          </div>
          <div class="th-card absolute">
            <span class="th-label">絕對多數決 (2/3)</span>
            <span class="th-num">{{ store.rollCallThresholds.absolute }}</span>
            <span class="th-desc">需 ≥ {{ store.rollCallThresholds.absolute }} 票通過</span>
          </div>
          <div class="th-card fifth">
            <span class="th-label">五分之一門檻 (1/5)</span>
            <span class="th-num">{{ store.rollCallThresholds.oneFifth }}</span>
            <span class="th-desc">附署/動議最低門檻</span>
          </div>
        </div>
        <p class="hint">等待主席團結束點名並恢復會議...</p>
      </div>
    </div>

    <div v-else-if="store.screenMode === 'suspended'" class="overlay suspended">
      <h1>⏸️ 會議暫停</h1>
      <p>Meeting Suspended - Awaiting Chair</p>
    </div>

    <div v-else-if="store.screenMode === 'motion_voting' && store.currentVotingMotion" class="overlay motion">
      <h2>📜 當前表決動議</h2>
      <div class="motion-card">
        <div class="badge">P{{ store.currentVotingMotion.priority }}</div>
        <h3>{{ store.currentVotingMotion.type }}</h3>
        <p class="country">By: {{ store.currentVotingMotion.country }}</p>
        <div class="details">
          <p v-if="store.currentVotingMotion.details?.topic">📌 主題: {{ store.currentVotingMotion.details.topic }}</p>
          <p v-if="store.currentVotingMotion.details?.duration">⏱️ 時長: {{ store.currentVotingMotion.details.duration }} 分鐘</p>
          <p v-if="store.currentVotingMotion.details?.docNum">📄 文件: {{ store.currentVotingMotion.details.docNum }}</p>
        </div>
        <p class="hint">主席團執行表決程序中...</p>
      </div>
    </div>

    <div v-else-if="store.screenMode === 'caucus'" class="overlay caucus">
      <h2>{{ store.meetingPhase }}</h2>
      <div class="timer-huge">{{ formatTime(store.caucusTotalTimer) }}</div>
      <p>Free Discussion / Consultation in Progress</p>
    </div>

    <div v-else-if="store.screenMode === 'p5_closed'" class="overlay p5-closed">
      <h1>🔒 P5閉門協商</h1>
      <p class="subtitle">常任理事國協調程序進行中</p>
      <div class="timer-huge p5-timer">{{ formatTime(store.p5Timer) }}</div>
      <p class="warning">非P5代表請於指定區域等候</p>
    </div>

    <div v-else-if="store.screenMode === 'mod_caucus'" class="overlay mod">
      <h2>🎤 有主持核心磋商</h2>
      <p class="topic">主題: {{ store.modCaucusTopic || '未指定' }}</p>
      <div class="dual-timer-display">
        <div class="timer-box total">
          <span class="label">總時長</span>
          <span class="time">{{ formatTime(store.modCaucusTotalTimer) }}</span>
        </div>
        <div class="timer-box speaker">
          <span class="label">當前發言</span>
          <span class="time">{{ formatTime(store.modCaucusSpeakerTimer) }}</span>
        </div>
      </div>
      <div class="mod-list">
        <div class="current-mod-speaker">
           👤 當前發言人: <strong>{{ store.currentModSpeaker || '等待主席點人' }}</strong>
        </div>
        <div v-if="store.modCaucusList.length > 1" class="upcoming-section">
          <h4>📋 接續發言人名單</h4>
          <div class="upcoming-list">
            <div v-for="(spk, i) in store.modCaucusList.slice(1)" :key="i" class="mod-row upcoming">
              <span class="num">{{ i + 2 }}</span>
              <span class="name">{{ spk.country }}</span>
              <span class="time">{{ spk.time }}s</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="default-view">
      <header>
        <!-- ✅ 需求3：標題改為 TYMUN 2026 -->
        <h1>TYMUN 2026 🇺 聯合國安全理事會</h1>
        <!-- ✅ 需求2：增加議程與辯論狀態的間距 -->
        <div class="section-badge">{{ store.currentSection }}</div>
        <div class="phase-spacer"></div>
        <div class="phase">{{ store.meetingPhase }}</div>
      </header>

      <div class="main-grid">
        <div class="panel">
          <h3>🎤 常設發言人名單</h3>
          <div class="timer-display-panel">
            <span class="label">當前發言人: {{ store.currentGeneralSpeaker || '無' }}</span>
            <span class="time">{{ formatTime(store.generalSpeakerTimer) }}</span>
            <span class="status">{{ store.isGeneralTimerRunning ? '⏳ 進行中' : '⏸️ 暫停' }}</span>
          </div>
          <div class="speaker-list">
            <div v-for="(spk, i) in (store.generalList || [])" :key="i" class="row">
              <span class="num">{{ i + 1 }}</span>
              <span class="name">{{ spk.country }}</span>
            </div>
            <div v-if="!store.generalList || store.generalList.length === 0" class="empty">無登記代表</div>
          </div>
        </div>

        <div class="panel">
          <h3>📜 動議佇列</h3>
          <div class="motion-queue-list">
            <div v-for="m in (store.motionQueue || [])" :key="m.id" class="motion-item">
              <span class="badge">P{{ m.priority }}</span>
              <div class="motion-info">
                <strong>{{ m.type }}</strong> <span class="country">by {{ m.country }}</span>
                <div class="details">
                  <span v-if="m.details?.topic">📌 {{ m.details.topic }}</span>
                  <span v-if="m.details?.duration">⏱️ {{ m.details.duration }}m</span>
                  <span v-if="m.details?.totalTime">🕒 總{{ m.details.totalTime }}m</span>
                  <span v-if="m.details?.speakTime">⏱️ 每人{{ m.details.speakTime }}s</span>
                </div>
              </div>
            </div>
            <div v-if="!store.motionQueue || store.motionQueue.length === 0" class="empty">暫無動議</div>
          </div>
          <h3 style="margin-top:20px;">📄 場上文件</h3>
          <div class="doc-list">
            <div v-for="doc in (store.documents || [])" :key="doc.number">[{{ doc.type }} {{ doc.number }}] {{ doc.title }}</div>
            <div v-if="!store.documents || store.documents.length === 0" class="empty">暫無文件</div>
          </div>
        </div>
      </div>
    </div>

    <div class="live-clock">🕒 台北時間: {{ currentTime }}</div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useConferenceStore } from '../stores/conference'

const store = useConferenceStore()
const currentTime = ref('')
let clockInterval = null

// ✅ 需求1：點名頁面顯示邏輯包含觀察員
const totalCount = computed(() => store.delegates.length) // 包含所有代表（理事國+觀察員）
const markedCount = computed(() => Object.values(store.rollCallStatus).filter(s => s).length)
const progressPercent = computed(() => totalCount.value > 0 ? Math.round((markedCount.value / totalCount.value) * 100) : 0)
const currentCallingCountry = computed(() => {
  // 依序找出第一個還沒點名的代表（包含觀察員）
  const next = store.delegates.find(d => !store.rollCallStatus[d.name])
  return next ? next.name : '全部完畢'
})

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
  
  // Firebase 同步已經在 store 中處理，不需要手動監聽
})

onUnmounted(() => { if (clockInterval) clearInterval(clockInterval) })
</script>

<style scoped>
/* ✅ 需求2：增加議程與辯論狀態的間距 */
.phase-spacer { height: 15px; }

.roll-call-screen { background: #0d1b2a; color: white; }
.rc-progress { text-align: center; margin-top: 20px; }
.rc-big-text { font-size: 3.5rem; font-weight: bold; color: #ffcc00; margin-bottom: 10px; }
.rc-counter { font-size: 1.5rem; color: #aaa; margin-bottom: 20px; }
.rc-bar-bg { width: 80%; height: 20px; background: rgba(255,255,255,0.1); border-radius: 10px; margin: 0 auto; overflow: hidden; }
.rc-bar-fill { height: 100%; background: #4caf50; transition: width 0.3s ease; }
.rc-results { text-align: center; }
.threshold-grid { display: flex; justify-content: center; gap: 30px; margin: 30px 0; flex-wrap: wrap; }
.th-card { background: rgba(255,255,255,0.1); padding: 20px 30px; border-radius: 12px; min-width: 200px; border: 1px solid rgba(255,255,255,0.2); }
.th-card.simple { border-color: #4caf50; }
.th-card.absolute { border-color: #2196f3; }
.th-card.fifth { border-color: #ff9800; }
.th-label { display: block; font-size: 1.1rem; margin-bottom: 10px; color: #ccc; }
.th-num { display: block; font-size: 3rem; font-weight: bold; color: white; margin-bottom: 5px; }
.th-desc { font-size: 0.9rem; color: #aaa; }
.hint { color: #666; margin-top: 20px; font-style: italic; }
.live-clock { position: fixed; bottom: 15px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.85); color: #00ff88; padding: 8px 20px; border-radius: 8px; font-family: monospace; font-size: 14px; z-index: 1000; border: 1px solid #333; }
.section-badge { font-size: 1.2rem; background: rgba(255,204,0,0.15); color: #ffcc00; padding: 6px 16px; border-radius: 20px; display: inline-block; margin-top: 8px; border: 1px solid rgba(255,204,0,0.3); }
.current-mod-speaker { font-size: 1.5rem; margin-bottom: 20px; color: #ffcc00; text-align: center; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px; }
.current-mod-speaker strong { color: #fff; font-size: 1.8rem; display: block; margin-top: 5px; }
.upcoming-section { margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 15px; }
.upcoming-section h4 { text-align: center; margin: 0 0 10px 0; font-size: 1rem; color: #aaa; text-transform: uppercase; letter-spacing: 1px; }
.upcoming-list { max-height: 30vh; overflow-y: auto; }
.mod-row.upcoming { background: rgba(255,255,255,0.03); }
.timer-display-panel { background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px; text-align: center; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.2); }
.timer-display-panel .label { font-size: 0.9rem; opacity: 0.8; display: block; }
.timer-display-panel .time { font-size: 2.5rem; font-family: monospace; font-weight: bold; display: block; margin: 5px 0; color: #ffcc00; }
.timer-display-panel .status { font-size: 0.9rem; color: #aaa; }
.motion-queue-list { max-height: 25vh; overflow-y: auto; background: rgba(255,255,255,0.05); border-radius: 8px; padding: 10px; }
.motion-item { display: flex; align-items: flex-start; gap: 10px; padding: 10px; margin-bottom: 8px; background: rgba(255,255,255,0.08); border-radius: 6px; font-size: 1.1rem; }
.motion-info { flex: 1; } .motion-info .country { color: #aaa; font-size: 0.9rem; }
.motion-info .details { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 5px; font-size: 0.85rem; color: #ccc; }
.badge { background: #ffcc00; color: #000; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 0.8rem; white-space: nowrap; }
.mod-list { width: 80%; max-width: 600px; background: rgba(255,255,255,0.05); padding: 20px; border-radius: 10px; margin-top: 20px; }
.mod-row { display: flex; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 1.3rem; }
.num { width: 40px; color: #aaa; } .name { flex: 1; } .time { color: #aaa; font-family: monospace; }
.dual-timer-display { display: flex; gap: 30px; margin-bottom: 30px; }
.timer-box { background: rgba(255,255,255,0.1); padding: 20px 40px; border-radius: 10px; text-align: center; }
.timer-box.total { border: 2px solid #4caf50; } .timer-box.speaker { border: 2px solid #2196f3; }
.label { display: block; font-size: 1rem; opacity: 0.8; margin-bottom: 5px; }
.time { font-size: 3.5rem; font-family: monospace; font-weight: bold; }
.timer-huge { font-size: 8rem; font-family: monospace; color: #ffcc00; margin: 20px 0; }
.screen-container { background: #001a33; color: white; min-height: 100vh; font-family: sans-serif; overflow: hidden; position: relative; padding-bottom: 50px; }
.overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10; padding: 20px; box-sizing: border-box; }
.suspended { background: #111; } .suspended h1 { font-size: 5rem; color: #ff9800; }
.motion { background: rgba(0, 26, 51, 0.98); } .motion-card { background: #fff; color: #333; padding: 40px; border-radius: 15px; text-align: center; width: 70%; max-width: 700px; }
.country { color: #666; font-size: 1.2rem; margin: 5px 0; } .details { text-align: left; margin: 20px 0; font-size: 1.3rem; line-height: 1.6; background: #f8f9fa; padding: 15px; border-radius: 8px; }
.hint { color: #888; font-style: italic; margin-top: 15px; }
.p5-closed { background: #1a0000; }
.p5-closed h1 { font-size: 4rem; color: #ff4444; }
.p5-timer { font-size: 8rem; color: #ff8800; }
.subtitle { font-size: 1.5rem; color: #aaa; margin-bottom: 20px; }
.warning { font-size: 1.2rem; color: #ffcc00; margin-top: 20px; border: 1px solid #ffcc00; padding: 10px 20px; border-radius: 8px; }
.mod { background: #1a237e; } .topic { font-size: 1.5rem; margin-bottom: 20px; color: #ffcc00; }
.caucus { background: #003366; }
.default-view { padding: 40px; }
header { text-align: center; margin-bottom: 40px; }
h1 { font-size: 4rem; margin: 0; }
.phase { font-size: 2rem; background: rgba(255,255,255,0.1); padding: 10px 30px; border-radius: 50px; display: inline-block; margin-top: 10px; border: 2px solid #ffcc00; color: #ffcc00; }
.main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
.panel { background: rgba(255,255,255,0.05); padding: 30px; border-radius: 15px; }
h3 { border-bottom: 2px solid rgba(255,255,255,0.2); padding-bottom: 10px; margin-top: 0; }
.speaker-list { max-height: 60vh; overflow-y: auto; }
.row { display: flex; align-items: center; padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 1.5rem; }
.num { width: 40px; font-weight: bold; color: #ffcc00; } .name { flex: 1; }
.empty { text-align: center; opacity: 0.5; padding: 20px; }
</style>