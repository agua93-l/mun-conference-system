<template>
  <div class="chair-container">
    <header class="top-bar">
      <h1>🏛️ 安理會主席控制台</h1>
      <div class="status-pill">{{ store.meetingPhase }}</div>
      <div class="header-actions">
        <select class="section-select" v-model="selectedSection" @change="store.setSection(selectedSection)">
          <option value="議程 1">議程 1 (5/30 09:30~11:30)</option>
          <option value="議程 2">議程 2 (5/30 12:30~14:30)</option>
          <option value="議程 3">議程 3 (5/30 14:45~16:10)</option>
          <option value="議程 4">議程 4 (5/31 09:00~11:30)</option>
          <option value="議程 5">議程 5 (5/31 12:30~14:45)</option>
          <option value="議程 6">議程 6 (5/31 15:00~17:00)</option>
        </select>
        
        <button class="btn-open-screen" @click="openScreenView">📺 開啟代表端</button>
        <button class="btn-stats" @click="router.push('/stats')">📊 各國統計</button>
        <button class="btn-clear-stats" @click="clearStats">🗑️ 清除統計</button>
        <button class="btn-save" @click="handleSaveProgress">💾 儲存進度</button>
        <button class="btn-reset" @click="store.resetMeeting()">⚠️ 重置會議</button>
        
        <button class="btn-suspend" @click="store.suspendMeeting">⏸️ 暫停</button>
        <button class="btn-resume" @click="store.resumeMeeting">▶️ 恢復</button>
        <button class="btn-return-debate" @click="store.returnToDebate()">✅ 返回辯論</button>
        <button class="btn-logout" @click="handleLogout">🚪 登出</button>
      </div>
    </header>

    <div class="grid-layout">
      <div class="column left">
        <!-- 唱名表決控制區 -->
        <div class="card" v-if="store.screenMode === 'voting_roll_call'">
          <h3>🗳️ 唱名表決控制</h3>
          <div class="voting-controls-header">
            <span>輪次：{{ store.votingRound2 ? '第二輪 (僅贊成/反對)' : '第一輪 (完整)' }}</span>
            <button class="btn-next-round" v-if="!store.votingRound2" @click="store.nextVotingRound()">⏭️ 進入第二輪</button>
            <button class="btn-end-vote" @click="store.endVotingRollCall()">✅ 結束投票並顯示結果</button>
          </div>
          
          <div class="delegates-grid">
            <div v-for="d in store.delegates.filter(x => x.type === 'member')" :key="d.name" class="delegate-row" :class="{ voted: store.rollCallVoteData[d.name] }">
              <span class="d-name">{{ d.name }}</span>
              <div class="d-status">
                <span v-if="store.rollCallVoteData[d.name]" class="voted-tag">{{ getVoteLabel(store.rollCallVoteData[d.name]) }}</span>
                <span v-else class="pending-tag">待投票</span>
              </div>
              <div class="d-actions">
                <button class="btn-vote" @click="openVoteModal(d.name)">🗳️ 投票</button>
                <button class="btn-clear" v-if="store.rollCallVoteData[d.name]" @click="store.recordRollCallVote(d.name, null)">清除</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 共識決控制區 -->
        <div class="card" v-else-if="store.screenMode === 'voting_consensus'">
          <h3>🤝 共識決投票</h3>
          <div v-if="!store.consensusResult" class="consensus-controls">
            <button class="btn-consensus pass" @click="store.setConsensusResult('pass')">✅ 通過</button>
            <button class="btn-consensus fail" @click="store.setConsensusResult('fail')">❌ 不通過</button>
          </div>
          <div v-else class="consensus-result-box">
            <p>結果已同步至代表端：<strong>{{ store.consensusResult === 'pass' ? '✅ 通過' : '❌ 不通過' }}</strong></p>
            <button class="btn-return-debate" @click="store.finishConsensus()">✅ 返回辯論</button>
          </div>
        </div>

        <!-- 常設發言人名單 -->
        <div class="card" v-else>
          <h3>🎤 常設發言人名單</h3>
          <div class="current-speaker-box">
            <span>當前發言人：</span>
            <strong>{{ store.currentGeneralSpeaker || '無' }}</strong>
            <span class="timer-display">{{ formatTime(store.generalSpeakerTimer) }}</span>
          </div>
          <div class="input-row">
            <label>預設時長(秒):</label>
            <input v-model.number="timeLimitInput" @change="store.generalTimeLimit = Math.max(10, timeLimitInput)" type="number" min="10" />
          </div>
          <div class="input-row">
            <select v-model="selCountry">
              <option value="">選擇國家</option>
              <option v-for="d in store.delegates" :key="d.name" :value="d.name">{{ d.name }}</option>
            </select>
            <button @click="store.addToGeneralList(selCountry); selCountry=''">加入名單</button>
          </div>
          <div class="list-scroll">
            <div v-for="(spk, i) in store.generalList" :key="i" class="list-item"><span>{{ spk.country }}</span></div>
            <div v-if="store.generalList.length === 0" class="empty">無登記代表</div>
          </div>
          <div class="timer-control-row">
            <button class="btn-next" @click="store.nextGeneralSpeaker">➡️ 下一位</button>
            <select v-model="yieldTarget" class="yield-select" :disabled="!store.currentGeneralSpeaker || store.generalSpeakerTimer <= 0">
              <option value="">🔄 讓渡予...</option>
              <option v-for="d in store.delegates" :key="d.name" :value="d.name">{{ d.name }}</option>
            </select>
            <button class="btn-yield" :disabled="!yieldTarget" @click="store.yieldToDelegate(yieldTarget); yieldTarget=''">讓渡</button>
            <!-- ✅ 正確綁定：使用 store.toggleGeneralTimer -->
            <button :class="['btn-timer', store.isGeneralTimerRunning ? 'active' : '']" @click="store.toggleGeneralTimer">
              {{ store.isGeneralTimerRunning ? '⏸️ 暫停' : '▶️ 開始' }}
            </button>
          </div>
        </div>

        <!-- 點名系統 -->
        <div class="card roll-call-control" v-if="store.screenMode !== 'voting_roll_call' && store.screenMode !== 'voting_consensus'">
          <h3>📋 點名系統</h3>
          <div v-if="!store.isRollCallActive" class="rc-trigger">
            <button class="btn-start-rollcall" @click="store.startRollCall()">📢 開始點名 (同步至代表端)</button>
          </div>
          <div v-else class="rc-active-panel">
            <div class="rc-status">進行中... 已點 {{ Object.values(store.rollCallStatus).filter(s => s).length }} / {{ store.delegates.length }} 席</div>
            <div class="roll-call-grid">
              <div v-for="d in store.delegates" :key="d.name" class="roll-call-item">
                <span class="rc-name">{{ d.name }}</span>
                <div class="rc-buttons">
                  <button :class="['rc-btn', store.rollCallStatus[d.name] === 'present' ? 'active-present' : '']" @click="store.markRollCall(d.name, 'present')">出席</button>
                  <button :class="['rc-btn', store.rollCallStatus[d.name] === 'late' ? 'active-late' : '']" @click="store.markRollCall(d.name, 'late')">遲到</button>
                  <button :class="['rc-btn', store.rollCallStatus[d.name] === 'absent' ? 'active-absent' : '']" @click="store.markRollCall(d.name, 'absent')">缺席</button>
                  <button v-if="store.rollCallStatus[d.name] === 'present'" class="rc-btn-change-late" @click="store.changeToLate(d.name)">↪️ 改遲到</button>
                </div>
              </div>
            </div>
            <button class="btn-end-rollcall" @click="store.endRollCall()">✅ 點名完畢，返回會議</button>
          </div>
        </div>
      </div>

      <div class="column right">
        <div class="card">
          <h3>📜 動議佇列</h3>
          <div class="motion-form">
            <select v-model="mType" @change="mDetails={}">
              <option value="">選擇動議類型</option>
              <option v-for="t in ['自由磋商','全體諮詢','有主持核心磋商','暫停會議','恢復會議','介紹決議草案','介紹修正案','P5閉門協商','唱名表決','共識決']" :key="t" :value="t">{{ t }}</option>
            </select>
            <select v-model="mCountry">
              <option value="">動議國</option>
              <option v-for="d in store.delegates.filter(d=>d.type==='member')" :key="d.name" :value="d.name">{{ d.name }}</option>
            </select>
            <template v-if="mType === '自由磋商' || mType === '全體諮詢'">
              <input v-model.number="mDetails.duration" type="number" placeholder="時長(分)" />
            </template>
            <template v-if="mType === '有主持核心磋商'">
              <input v-model="mDetails.topic" placeholder="磋商主題" />
              <input v-model.number="mDetails.totalTime" type="number" placeholder="總時長(分)" />
              <input v-model.number="mDetails.speakTime" type="number" placeholder="每人發言(秒)" />
            </template>
            <button class="btn-submit" :disabled="!mType || !mCountry" @click="store.submitMotion(mType, mCountry, mDetails)">📥 提交動議</button>
          </div>
          
          <div class="queue-list">
            <div v-for="(m, i) in store.motionQueue" :key="m.id" class="queue-item">
              <span class="tag">P{{ m.priority }}</span>
              <span>{{ m.type }} - {{ m.country }}</span>
              <div class="btn-group">
                <button class="btn-pass" @click="store.approveMotion(i)">✓ 通過</button>
                <button class="btn-reject" @click="store.rejectMotion()">✗ 駁回</button>
              </div>
            </div>
            <div v-if="store.motionQueue.length === 0" class="empty">佇列為空</div>
          </div>
          <button class="btn-execute" :disabled="!store.currentVotingMotion" @click="store.executeMotion">📢 執行當前表決動議</button>
        </div>

        <div class="card">
          <h3>📄 場上文件公告</h3>
          <div class="input-row">
            <select v-model="docType"><option value="WD">工作文件 (WD)</option><option value="DR">決議草案 (DR)</option><option value="A">修正案 (A)</option></select>
            <input v-model="docNumber" placeholder="編號 (如 1.1)" /><input v-model="docTitle" placeholder="標題/議題" />
            <button @click="store.addDocument(docType, docNumber, docTitle); docNumber=''; docTitle=''">公告</button>
          </div>
          <div class="doc-preview"><div v-for="doc in store.documents" :key="doc.number" class="doc-tag">[{{ doc.type }} {{ doc.number }}] {{ doc.title }}</div></div>
        </div>

        <div class="card" v-if="store.screenMode === 'mod_caucus'">
          <h3>🎤 有主持核心磋商控制</h3>
          <div class="mod-info-badge">每位發言人時長：<strong>{{ store.modCaucusDefaultSpeakTime || 60 }}秒</strong></div>
          <div class="input-row">
            <select v-model="modSelCountry"><option value="">選擇國家</option><option v-for="d in store.delegates" :key="d.name" :value="d.name">{{ d.name }}</option></select>
            <button @click="store.addToModCaucus(modSelCountry); modSelCountry=''">加入特設名單</button>
          </div>
          <div class="list-scroll"><div v-for="(spk, i) in store.modCaucusList" :key="i" class="list-item mod-item"><span>{{ i + 1 }}. {{ spk.country }} ({{ spk.time }}s)</span></div><div v-if="store.modCaucusList.length === 0" class="empty">暫無特設代表</div></div>
          <div class="timer-control-row">
            <button class="btn-next" @click="store.nextModSpeaker">➡️ 下一位</button>
            <button :class="['btn-timer', store.isModCaucusRunning ? 'active' : '']" @click="store.toggleModCaucusTimer">{{ store.isModCaucusRunning ? '⏸️ 暫停' : '▶️ 開始' }}</button>
            <button class="btn-clear-mod" @click="store.modCaucusList = []; store.currentModSpeaker = ''; store.modCaucusSpeakerTimer = 0; store.sync()">🗑️ 清空名單</button>
            <div class="dual-timer"><span>總時長: {{ formatTime(store.modCaucusTotalTimer) }}</span><span>當前: {{ formatTime(store.modCaucusSpeakerTimer) }}</span></div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 投票彈窗 Modal -->
    <div class="vote-modal-overlay" v-if="showVoteModal" @click.self="showVoteModal = false">
      <div class="vote-modal">
        <h3>為 <strong>{{ votingTargetCountry }}</strong> 投票 ({{ store.votingRound2 ? '第二輪' : '第一輪' }})</h3>
        <div class="vote-options">
          <button class="vote-btn yes" @click="setVote('yes')">✅ 贊成</button>
          <button class="vote-btn yes-speak" @click="setVote('yes_speak')" v-if="!store.votingRound2">🗣️ 贊成並發言</button>
          <button class="vote-btn no" @click="setVote('no')">❌ 反對</button>
          <button class="vote-btn no-speak" @click="setVote('no_speak')" v-if="!store.votingRound2">🗣️ 反對並發言</button>
          <button class="vote-btn abstain" @click="setVote('abstain')" v-if="!store.votingRound2">⚪ 棄權</button>
          <button class="vote-btn pass" @click="setVote('pass')" v-if="!store.votingRound2">⏭️ 跳過</button>
        </div>
      </div>
    </div>
    
    <div class="live-clock">🕒 台北時間: {{ currentTime }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useConferenceStore } from '../stores/conference'

const router = useRouter()
const store = useConferenceStore()
const selCountry = ref(''); const yieldTarget = ref(''); const mType = ref(''); const mCountry = ref(''); const mDetails = ref({})
const modSelCountry = ref(''); const timeLimitInput = ref(60); const docType = ref('WD'); const docNumber = ref(''); const docTitle = ref('')
const currentTime = ref(''); const selectedSection = ref('議程 1')
const showVoteModal = ref(false); const votingTargetCountry = ref('')
let clockInterval = null

function formatTime(sec) { const m = Math.floor((sec || 0) / 60); const s = (sec || 0) % 60; return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` }
function handleLogout() { const { auth, authMethods } = window.firebase; authMethods.signOut(auth).then(() => { router.push('/login') }) }
function openScreenView() { const route = router.resolve('/screen'); window.open(route.href, '_blank') }
async function clearStats() { if (!confirm('⚠️ 確定要清除統計？')) return; try { const { db, dbMethods } = window.firebase; await dbMethods.set(dbMethods.ref(db, 'mun_state/stats'), null); alert('✅ 已清除'); window.location.reload() } catch(e) { alert('❌ 失敗') } }
function openVoteModal(country) { votingTargetCountry.value = country; showVoteModal.value = true }
function setVote(voteType) { store.recordRollCallVote(votingTargetCountry.value, voteType); showVoteModal.value = false }
function getVoteLabel(vote) { return { yes:'✅ 贊成', yes_speak:'🗣️ 贊成並發言', no:'❌ 反對', no_speak:'🗣️ 反對並發言', abstain:'⚪ 棄權', pass:'⏭️ 跳過' }[vote] || '' }
function handleSaveProgress() { store.saveProgress(); alert('✅ 會議進度已儲存 (已同步至雲端)') }

onMounted(() => { const updateClock = () => { currentTime.value = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) }; updateClock(); clockInterval = setInterval(updateClock, 1000) })
onUnmounted(() => { if (clockInterval) clearInterval(clockInterval) })
</script>

<style scoped>
.section-select { padding: 6px 10px; border-radius: 6px; border: 1px solid #ccc; background: #fff; font-size: 0.9rem; }
.roll-call-control { border: 2px solid #2196f3; }
.btn-start-rollcall { width: 100%; padding: 12px; background: #2196f3; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 1rem; }
.btn-end-rollcall { width: 100%; padding: 10px; background: #4caf50; color: white; border: none; border-radius: 6px; cursor: pointer; margin-top: 10px; }
.rc-status { text-align: center; margin-bottom: 10px; font-weight: bold; color: #333; }
.roll-call-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; max-height: 180px; overflow-y: auto; padding: 5px; }
.roll-call-item { background: #f9f9f9; padding: 6px; border-radius: 4px; display: flex; flex-direction: column; gap: 4px; }
.rc-name { font-size: 0.85rem; font-weight: bold; text-align: center; }
.rc-buttons { display: flex; gap: 4px; flex-wrap: wrap; }
.rc-btn { flex: 1; padding: 2px 0; font-size: 0.75rem; border: 1px solid #ccc; border-radius: 3px; background: #fff; cursor: pointer; min-width: 40px; }
.rc-btn.active-present { background: #4caf50; color: white; border-color: #4caf50; }
.rc-btn.active-late { background: #ff9800; color: white; border-color: #ff9800; }
.rc-btn.active-absent { background: #f44336; color: white; border-color: #f44336; }
.rc-btn-change-late { background: #ff9800; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 0.7rem; }
.mod-info-badge { background: #e3f2fd; padding: 8px; border-radius: 6px; margin-bottom: 10px; text-align: center; font-size: 0.95rem; }
.yield-select { flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; background: #fffbe6; }
.btn-yield { padding: 8px 12px; background: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer; }
.btn-yield:disabled { opacity: 0.5; cursor: not-allowed; }
.doc-preview { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; max-height: 100px; overflow-y: auto; }
.doc-tag { background: #e3f2fd; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem; }
.current-speaker-box { background: #e3f2fd; padding: 10px; border-radius: 6px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; font-size: 1.1rem; }
.timer-display { font-family: monospace; font-weight: bold; color: #d32f2f; font-size: 1.3rem; }
.queue-item { display: flex; align-items: center; gap: 10px; padding: 8px; margin-bottom: 6px; background: #fff3e0; border-radius: 4px; }
.btn-group { margin-left: auto; display: flex; gap: 5px; }
.btn-pass { background: #4caf50; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; }
.btn-reject { background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; }
.btn-execute { width: 100%; padding: 12px; background: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 10px; }
.btn-execute:disabled { opacity: 0.5; cursor: not-allowed; }
.dual-timer { display: flex; flex-direction: column; font-family: monospace; font-size: 0.9rem; background: #f5f5f5; padding: 5px 10px; border-radius: 4px; }
.list-item { padding: 8px; background: #f9f9f9; margin-bottom: 5px; border-radius: 4px; display: flex; justify-content: space-between; }
.mod-item { background: #e3f2fd; }
.empty { text-align: center; color: #888; padding: 10px; }
.timer-control-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
.btn-next, .btn-timer { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; background: #e0e0e0; }
.btn-timer.active { background: #4caf50; color: white; }
.btn-clear-mod { background: #ef5350; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
.card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 20px; }
h3 { margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 10px; }
.input-row { display: flex; gap: 10px; margin-bottom: 10px; align-items: center; }
select, input { padding: 8px; border: 1px solid #ccc; border-radius: 4px; flex: 1; }
.list-scroll { max-height: 150px; overflow-y: auto; margin-bottom: 10px; }
.motion-form { display: flex; flex-direction: column; gap: 8px; }
.btn-submit { width: 100%; padding: 12px; background: #673ab7; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
.queue-list { max-height: 120px; overflow-y: auto; margin: 10px 0; background: #fff3e0; padding: 10px; border-radius: 4px; }
.tag { background: #ffcc00; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 12px; }
.chair-container { padding: 20px; padding-bottom: 50px; background: #f4f6f9; min-height: 100vh; font-family: sans-serif; position: relative; }
.live-clock { position: fixed; bottom: 15px; right: 20px; background: rgba(0,0,0,0.85); color: #00ff88; padding: 8px 16px; border-radius: 8px; font-family: monospace; font-size: 14px; z-index: 1000; border: 1px solid #333; }
.top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; }
.status-pill { background: #0055a5; color: white; padding: 5px 15px; border-radius: 20px; }
.header-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.btn-suspend { background: #ff9800; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; }
.btn-resume { background: #4caf50; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; }
.btn-logout { background: #607d8b; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; }
.btn-logout:hover { background: #455a64; }
.btn-open-screen { background: #2196f3; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; }
.btn-stats { background: #9c27b0; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; }
.btn-clear-stats { background: #ef5350; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; }
.btn-return-debate { background: #00acc1; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; }
.btn-save { background: #4caf50; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; }
.btn-save:hover { background: #388e3c; }
.btn-reset { background: #ef5350; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; }
.btn-reset:hover { background: #d32f2f; }
.grid-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

.voting-controls-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
.btn-next-round { background: #2196f3; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; }
.btn-end-vote { background: #4caf50; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; }
.delegates-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; max-height: 300px; overflow-y: auto; }
.delegate-row { display: flex; flex-direction: column; background: #f9f9f9; padding: 8px; border-radius: 6px; border: 1px solid #eee; position: relative; }
.delegate-row.voted { background: #e8f5e9; border-color: #4caf50; }
.d-name { font-weight: bold; font-size: 0.9rem; margin-bottom: 4px; }
.d-status { font-size: 0.8rem; margin-bottom: 6px; min-height: 20px; }
.voted-tag { color: #2e7d32; font-weight: bold; }
.pending-tag { color: #999; font-style: italic; }
.d-actions { display: flex; gap: 4px; }
.btn-vote { flex: 1; padding: 4px; background: #673ab7; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.8rem; }
.btn-clear { padding: 4px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.8rem; }

.consensus-controls { display: flex; gap: 10px; margin-top: 10px; }
.consensus-result-box { text-align: center; padding: 10px 0; }
.consensus-result-box p { font-size: 1.1rem; margin-bottom: 15px; }
.btn-consensus { flex: 1; padding: 15px; border: none; border-radius: 8px; font-size: 1.1rem; cursor: pointer; font-weight: bold; }
.btn-consensus.pass { background: #4caf50; color: white; }
.btn-consensus.fail { background: #f44336; color: white; }

.vote-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 2000; }
.vote-modal { background: white; padding: 20px; border-radius: 12px; width: 300px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
.vote-modal h3 { margin-top: 0; text-align: center; }
.vote-options { display: flex; flex-direction: column; gap: 8px; margin-top: 15px; }
.vote-btn { padding: 12px; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; font-weight: bold; }
.vote-btn.yes { background: #4caf50; color: white; }
.vote-btn.yes-speak { background: #81c784; color: white; }
.vote-btn.no { background: #f44336; color: white; }
.vote-btn.no-speak { background: #e57373; color: white; }
.vote-btn.abstain { background: #bdbdbd; color: white; }
.vote-btn.pass { background: #ff9800; color: white; }
</style>