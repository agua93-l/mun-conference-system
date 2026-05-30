<template>
  <div class="screen-container">
    <header class="screen-header">
      <h1>&#127963; TYMUN 2026 安全理事會會議畫面</h1>
      <div class="status-bar">
        <span class="phase">{{ store.meetingPhase }}</span>
        <span class="agenda-display"> {{ store.currentSection }}</span>
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

      <!-- 唱名表決模式 -->
      <section v-else-if="store.screenMode === 'voting_roll_call'" class="mode-panel voting-panel">
        <h2 class="voting-title">🗳️ 唱名表決</h2>
        <div class="voting-topic">議題：{{ store.currentVotingMotion?.details?.topic || '未指定' }}</div>
        
        <div v-if="store.rollCallVoteStatus === 'voting'" class="vote-in-progress">
          <div class="round-label">第 {{ store.votingRound2 ? '二' : '一' }} 輪投票</div>
          <div class="countries-grid">
            <div v-for="d in store.delegates.filter(x => x.type === 'member')" :key="d.name" class="country-card">
              <span class="country-name">{{ d.name }}</span>
              <span class="country-vote">{{ getVoteIcon(store.rollCallVoteData[d.name]) }}</span>
            </div>
          </div>
        </div>

        <div v-else-if="store.rollCallVoteStatus === 'finished'" class="vote-result">
          <div class="result-banner" :class="{ passed: store.passedVote }">
            <h3>{{ store.passedVote ? '✅ 動議通過' : '❌ 動議未通過' }}</h3>
            <p>贊成: {{ store.voteCounts.yes }} | 反對: {{ store.voteCounts.no }} | 棄權: {{ store.voteCounts.abstain }}</p>
            <p v-if="!store.passedVote" class="reason">{{ p5VetoReason || '贊成票未達 9 票門檻' }}</p>
          </div>
          <div class="countries-grid final">
            <div v-for="d in store.delegates.filter(x => x.type === 'member')" :key="d.name" class="country-card final">
              <span class="country-name">{{ d.name }}</span>
              <span class="country-vote">{{ getVoteIcon(store.rollCallVoteData[d.name]) }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 共識決投票 -->
      <section v-else-if="store.screenMode === 'voting_consensus'" class="mode-panel voting-panel">
        <h2 class="voting-title">🤝 共識決表決</h2>
        <div class="voting-topic">議題：{{ store.currentVotingMotion?.details?.topic || '未指定' }}</div>
        <div class="consensus-display">
          <div class="consensus-item">
            <span class="consensus-icon">✅</span>
            <span class="consensus-label">贊成</span>
            <span class="consensus-value">{{ store.votingYes }}</span>
          </div>
          <div class="consensus-item">
            <span class="consensus-icon">⚪</span>
            <span class="consensus-label">棄權</span>
            <span class="consensus-value">{{ store.votingAbstain }}</span>
          </div>
          <div class="consensus-item">
            <span class="consensus-icon">❌</span>
            <span class="consensus-label">反對</span>
            <span class="consensus-value">{{ store.votingNo }}</span>
          </div>
        </div>
      </section>

      <!-- 動議表決模式 -->
      <section v-else-if="store.screenMode === 'motion_voting' && store.currentVotingMotion" class="mode-panel motion-voting-panel">
        <h2 class="voting-title">🗳️ 動議表決</h2>
        <div class="motion-detail-large">
          <p class="motion-type">類型：{{ store.currentVotingMotion.type }}</p>
          <p class="motion-country">動議國：{{ store.currentVotingMotion.country }}</p>
          <p v-if="store.currentVotingMotion?.details?.topic" class="motion-topic">主題：{{ store.currentVotingMotion.details.topic }}</p>
          <p v-if="store.currentVotingMotion?.details?.totalTime" class="motion-duration">總時長：{{ store.currentVotingMotion.details.totalTime }} 分鐘</p>
        </div>
      </section>

      <!-- 有主持核心磋商 -->
      <section v-else-if="store.screenMode === 'mod_caucus'" class="mode-panel mod-panel-layout">
        <div class="mod-header-large">
          <h2 class="mod-main-title">🎤 有主持核心磋商</h2>
          <div class="mod-topic-large">主題：{{ store.modCaucusTopic || '未指定' }}</div>
          <div class="mod-total-time-label">總時長</div>
          <div class="mod-total-time-value">{{ formatTime(store.modCaucusTotalTimer) }}</div>
        </div>
        <div class="mod-content-split">
          <div class="mod-left-panel">
            <div class="mod-current-label-top">當前發言人</div>
            <div class="mod-current-name">{{ store.currentModSpeaker || '無' }}</div>
            <div class="mod-current-timer-small">{{ formatTime(store.modCaucusSpeakerTimer) }}</div>
          </div>
          <div class="mod-right-panel">
            <h3 class="mod-list-header">發言順序</h3>
            <div class="mod-list-container">
              <div v-for="(spk, i) in store.modCaucusList" :key="i" class="mod-list-item-xl">
                <span class="mod-num">{{ i + 1 }}</span>
                <span class="mod-name">{{ spk.country }}</span>
              </div>
              <div v-if="store.modCaucusList.length === 0" class="mod-empty">暫無順序</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ✅ 自由磋商/全體諮詢：加大字體 -->
      <section v-else-if="store.screenMode === 'caucus'" class="mode-panel caucus-panel-large">
        <h2 class="caucus-title-large">{{ store.meetingPhase }}</h2>
        <div class="timer-large caucus-timer-large">{{ formatTime(store.caucusTotalTimer) }}</div>
      </section>

      <!-- P5閉門 -->
      <section v-else-if="store.screenMode === 'p5_closed'" class="mode-panel"><h2>🔒 P5 閉門協商</h2><div class="timer-large">{{ formatTime(store.p5Timer) }}</div></section>

      <!-- 會議暫停 -->
      <section v-else-if="store.screenMode === 'suspended'" class="mode-panel suspended-panel">
        <div class="suspended-content">
          <h2 class="suspended-title">⏸️ 會議暫停</h2>
        </div>
      </section>

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
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useConferenceStore } from '../stores/conference'

const store = useConferenceStore()
const currentTime = ref('')
let clockInterval = null

function formatTime(sec) { if (!sec && sec !== 0) return '00:00'; const m = Math.floor(sec / 60); const s = sec % 60; return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` }

function getVoteIcon(vote) {
  const map = { yes: '✅', yes_speak: '🗣️✅', no: '❌', no_speak: '🗣️❌', abstain: '⚪', pass: '⏭️' }
  return map[vote] || ''
}

const p5VetoReason = computed(() => {
  const vetoers = store.delegates.filter(d => d.p5 && (store.rollCallVoteData[d.name] === 'no' || store.rollCallVoteData[d.name] === 'no_speak'))
  return vetoers.length > 0 ? `五常 (${vetoers.map(v => v.name).join(', ')}) 行使否決權` : ''
})

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

.roll-call-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; max-width: 1000px; margin: 20px auto; }
.roll-call-item { background: #1e293b; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; font-size: 1.2rem; align-items: center; }
.status.present { color: #4ade80; font-weight: bold; } .status.late { color: #fbbf24; font-weight: bold; } .status.absent { color: #f87171; font-weight: bold; }
.roll-call-summary { margin-top: 30px; padding: 25px; background: #1e293b; border-radius: 12px; max-width: 900px; margin-left: auto; margin-right: auto; }
.attendance-count { font-size: 2rem; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #334155; color: #4ade80; }
.voting-thresholds { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; }
.threshold-item { background: #0f172a; padding: 18px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; }
.threshold-item span { font-size: 1.1rem; color: #94a3b8; margin-bottom: 8px; } .threshold-item strong { font-size: 2.2rem; color: #fbbf24; }

.voting-panel { padding: 20px; }
.voting-title { font-size: 3.5rem; font-weight: 800; color: #fbbf24; margin-bottom: 10px; }
.voting-topic { font-size: 1.5rem; color: #94a3b8; margin-bottom: 20px; }
.round-label { font-size: 1.2rem; color: #38bdf8; margin-bottom: 20px; }

.countries-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px; max-width: 1200px; margin: 0 auto; }
.country-card { background: #1e293b; padding: 20px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 10px; border: 2px solid #334155; }
.country-name { font-size: 1.3rem; font-weight: bold; } .country-vote { font-size: 2.5rem; }

.vote-result { margin-top: 20px; }
.result-banner { background: #1e293b; padding: 30px; border-radius: 16px; margin-bottom: 30px; border: 4px solid #334155; }
.result-banner.passed { border-color: #4ade80; background: #052e16; }
.result-banner:not(.passed) { border-color: #f87171; background: #450a0a; }
.result-banner h3 { font-size: 2.5rem; margin: 0 0 10px 0; }
.result-banner p { font-size: 1.5rem; margin: 5px 0; }
.reason { color: #f87171; font-weight: bold; }

.consensus-display { display: flex; justify-content: center; gap: 40px; margin-top: 40px; }
.consensus-item { display: flex; flex-direction: column; align-items: center; gap: 10px; background: #1e293b; padding: 30px 40px; border-radius: 12px; min-width: 200px; }
.consensus-icon { font-size: 3rem; } .consensus-label { font-size: 1.5rem; color: #94a3b8; } .consensus-value { font-size: 4rem; font-weight: 800; color: #f8fafc; }

.mod-panel-layout { padding: 20px; display: flex; flex-direction: column; height: calc(100vh - 120px); }
.mod-header-large { margin-bottom: 30px; }
.mod-main-title { font-size: 3rem; font-weight: 800; color: #e2e8f0; margin-bottom: 10px; }
.mod-topic-large { font-size: 2rem; color: #94a3b8; margin-bottom: 15px; }
.mod-total-time-label { font-size: 1.2rem; color: #64748b; }
.mod-total-time-value { font-size: 3rem; font-family: monospace; color: #38bdf8; font-weight: bold; }

.mod-content-split { display: flex; gap: 30px; flex: 1; min-height: 0; }
.mod-left-panel { flex: 1; display: flex; flex-direction: column; align-items: center; background: #1e293b; border-radius: 16px; padding: 30px 40px; position: relative; }
.mod-current-label-top { font-size: 1.8rem; color: #94a3b8; margin-bottom: 10px; align-self: flex-start; }
.mod-current-name { font-size: 3rem; font-weight: 800; color: #fbbf24; margin-bottom: 20px; text-align: center; width: 100%; }
.mod-current-timer-small { font-size: 3.5rem; font-family: monospace; font-weight: bold; color: #38bdf8; }

.mod-right-panel { flex: 0.8; background: #1e293b; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; overflow: hidden; }
.mod-list-header { font-size: 1.5rem; color: #94a3b8; border-bottom: 1px solid #334155; padding-bottom: 10px; margin-bottom: 15px; }
.mod-list-container { overflow-y: auto; flex: 1; }
.mod-list-item-xl { display: flex; align-items: center; gap: 15px; padding: 20px; margin-bottom: 10px; background: #0f172a; border-radius: 8px; font-size: 2.5rem; }
.mod-num { color: #fbbf24; font-weight: bold; min-width: 50px; }
.mod-name { color: #e2e8f0; }
.mod-empty { color: #64748b; font-size: 1.2rem; padding: 20px; text-align: center; }

/* ✅ 自由磋商/全體諮詢：加大字體 */
.caucus-panel-large { display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 60vh; }
.caucus-title-large { font-size: 5rem; font-weight: 900; color: #e2e8f0; margin-bottom: 40px; letter-spacing: 3px; }
.caucus-timer-large { font-size: 10rem; font-family: monospace; font-weight: bold; color: #38bdf8; margin: 0; }

.info-grid-split { display: grid; grid-template-columns: 1fr 1.2fr; gap: 20px; max-width: 1400px; margin: 0 auto; height: calc(100vh - 200px); }
.right-split { display: flex; flex-direction: column; gap: 20px; }
.card { background: #1e293b; padding: 25px; border-radius: 12px; }
.full-height { height: 100%; overflow-y: auto; } .roll-call-card { flex: 0 0 auto; } .documents-card { flex: 1; overflow-y: auto; }
.large-section-title { margin-top: 0; border-bottom: 2px solid #334155; padding-bottom: 15px; color: #94a3b8; font-size: 2.2rem; font-weight: 700; }
h3 { margin-top: 0; border-bottom: 1px solid #334155; padding-bottom: 10px; color: #94a3b8; font-size: 1.5rem; }
.current-speaker { font-size: 1.8rem; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; padding: 20px; background: #0f172a; border-radius: 8px; }
.timer { font-family: monospace; color: #fbbf24; font-weight: bold; font-size: 2.2rem; }
.list .general-list-item { padding: 22px 25px; border-bottom: 2px solid #334155; font-size: 2rem; font-weight: 600; min-height: 70px; display: flex; align-items: center; }
.roll-call-brief { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
.brief-item { display: flex; flex-direction: column; align-items: center; padding: 15px; background: #0f172a; border-radius: 8px; }
.brief-label { font-size: 1rem; color: #94a3b8; margin-bottom: 8px; } .brief-value { font-size: 2.5rem; font-weight: bold; }
.brief-value.present { color: #4ade80; } .brief-value.late { color: #fbbf24; } .brief-value.absent { color: #f87171; }
.thresholds-brief { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.threshold-brief-item { background: #0f172a; padding: 15px; border-radius: 8px; text-align: center; }
.threshold-brief-item span { display: block; font-size: 0.95rem; color: #94a3b8; margin-bottom: 5px; } .threshold-brief-item strong { font-size: 1.8rem; color: #fbbf24; }
.doc-list { display: flex; flex-wrap: wrap; gap: 12px; }
.doc-tag { background: #334155; padding: 12px 20px; border-radius: 8px; font-size: 1.1rem; font-weight: 500; }
.empty { color: #64748b; padding: 20px; text-align: center; font-size: 1.2rem; }
</style>