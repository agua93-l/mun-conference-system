// src/stores/conference.js
import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'

let fbReady = false
let dbRefFn, setFn, getFn, updateFn, pushFn, childFn, onValueFn

const ensureFB = () => {
  if (fbReady) return true
  const fb = window.firebase
  if (!fb || !fb.db || !fb.dbMethods) return false
  dbRefFn = fb.dbMethods.ref
  setFn = fb.dbMethods.set
  getFn = fb.dbMethods.get
  updateFn = fb.dbMethods.update
  pushFn = fb.dbMethods.push
  childFn = fb.dbMethods.child
  onValueFn = fb.dbMethods.onValue
  fbReady = true
  return true
}

const ensureStorage = () => {
  const fb = window.firebase
  return fb && fb.storage && fb.storageMethods ? fb : null
}

const initRetry = setInterval(() => { if (ensureFB()) clearInterval(initRetry) }, 200)

const DEFAULT_DELEGATES = [
  { name: '中國', type: 'member', p5: true }, { name: '美國', type: 'member', p5: true },
  { name: '英國', type: 'member', p5: true }, { name: '俄羅斯', type: 'member', p5: true },
  { name: '法國', type: 'member', p5: true }, { name: '巴林', type: 'member', p5: false },
  { name: '哥倫比亞', type: 'member', p5: false }, { name: '剛果民主共和國', type: 'member', p5: false },
  { name: '丹麥', type: 'member', p5: false }, { name: '希臘', type: 'member', p5: false },
  { name: '拉脫維亞', type: 'member', p5: false }, { name: '利比里亞', type: 'member', p5: false },
  { name: '巴基斯坦', type: 'member', p5: false }, { name: '巴拿馬', type: 'member', p5: false },
  { name: '索馬里', type: 'member', p5: false },
  { name: 'ICoCA', type: 'observer', p5: false }, { name: '紅十字會', type: 'observer', p5: false },
  { name: '聯合國人權高专辦', type: 'observer', p5: false }, { name: '中非共和國', type: 'observer', p5: false }
]
const DEFAULT_AGENDA = () => [{ id: 1, label: '議程 1' }]

export const useConferenceStore = defineStore('conference', () => {
  const title = ref('')
  const delegates = ref([])
  const agenda = ref(DEFAULT_AGENDA())
  const ownerUid = ref('')
  const editors = ref({})
  const loaded = ref(false)

  const meetingPhase = ref('正式辯論')
  const screenMode = ref('default')
  const currentSection = ref('議程 1')
  const rollCallStatus = reactive({})
  const isRollCallActive = ref(false)
  const rollCallFinished = ref(false)
  const rollCallThresholds = reactive({ present: 0, simple: 0, twoThirds: 0, oneFifth: 0 })
  const generalTimeLimit = ref(60)
  const generalList = ref([])
  const currentGeneralSpeaker = ref('')
  const generalSpeakerTimer = ref(0)
  const isGeneralTimerRunning = ref(false)
  const motionQueue = ref([])
  const currentVotingMotion = ref(null)

  const rollCallVoteData = reactive({})
  const rollCallVoteStatus = ref('voting')
  const votingRound2 = ref(false)

  const consensusResult = ref(null)
  const speechNotes = ref([])

  const stats = reactive({})
  const documents = ref([])
  const p5Timer = ref(0)
  const caucusTotalTimer = ref(0)
  const modCaucusTopic = ref('')
  const modCaucusTotalTimer = ref(0)
  const modCaucusSpeakerTimer = ref(0)
  const modCaucusDefaultSpeakTime = ref(0)
  const modCaucusList = ref([])
  const currentModSpeaker = ref('')
  const isModCaucusRunning = ref(false)

  let generalInterval = null, caucusInterval = null, modCaucusInterval = null, p5Interval = null
  let stateRef = null
  let currentConferenceId = null
  let unsubscribe = null

  const ensureStatsCountry = (country) => {
    if (!stats[country]) {
      stats[country] = { speeches: 0, motionsPassed: 0, motions: { '自由磋商':0, '全體諮詢':0, '有主持核心磋商':0, '暫停會議':0, '恢復會議':0, '介紹決議草案':0, '介紹修正案':0, 'P5閉門協商':0, '唱名表決':0, '共識決':0 } }
    }
  }

  const recalcThresholds = () => {
    const memberDelegates = delegates.value.filter(d => d.type === 'member')
    const presentCount = memberDelegates.filter(d => rollCallStatus[d.name] === 'present').length
    rollCallThresholds.present = presentCount
    rollCallThresholds.simple = Math.floor(presentCount / 2) + 1
    rollCallThresholds.twoThirds = Math.ceil(presentCount * 2 / 3)
    rollCallThresholds.oneFifth = Math.ceil(presentCount / 5)
  }

  const sortMotionQueue = () => {
    const priorityMap = { '終止會議': 1, '暫停會議': 2, '自由磋商': 3, '全體諮詢': 3, '有主持核心磋商': 4, '介紹決議草案': 5, '介紹修正案': 6, 'P5閉門協商': 7, '結束辯論': 8, '唱名表決': 9, '共識決': 10 }
    motionQueue.value.sort((a, b) => {
      const pA = priorityMap[a.type] || 99; const pB = priorityMap[b.type] || 99
      if (pA !== pB) return pA - pB
      const durA = (a.details.totalTime || a.details.duration || 0) * 60
      const durB = (b.details.totalTime || b.details.duration || 0) * 60
      if (durA !== durB) return durB - durA
      if (a.type === '有主持核心磋商' && b.type === '有主持核心磋商') {
        const sA = durA / ((a.details.speakTime || 60)); const sB = durB / ((b.details.speakTime || 60))
        if (sA !== sB) return sB - sA
      }
      return (a.id || 0) - (b.id || 0)
    })
  }

  const voteCounts = computed(() => {
    let yes = 0, no = 0, abstain = 0
    Object.values(rollCallVoteData).forEach(v => {
      if (v === 'yes' || v === 'yes_speak') yes++
      else if (v === 'no' || v === 'no_speak') no++
      else if (v === 'abstain') abstain++
    })
    return { yes, no, abstain }
  })

  const passedVote = computed(() => {
    const p5Veto = delegates.value.some(d => d.p5 && (rollCallVoteData[d.name] === 'no' || rollCallVoteData[d.name] === 'no_speak'))
    return !p5Veto && voteCounts.value.yes >= 9
  })

  function clearAllTimers() {
    [generalInterval, caucusInterval, modCaucusInterval, p5Interval].forEach(t => t && clearInterval(t))
    generalInterval = caucusInterval = modCaucusInterval = p5Interval = null
    isGeneralTimerRunning.value = false; isModCaucusRunning.value = false
  }

  // 重置「會議進行狀態」，不動標題／代表清單／議程設定。resetMeeting() 與 loadConference() 共用。
  function resetRuntimeState() {
    clearAllTimers()
    meetingPhase.value = '正式辯論'; screenMode.value = 'default'
    isRollCallActive.value = false; rollCallFinished.value = false
    generalList.value = []; motionQueue.value = []; documents.value = []; modCaucusList.value = []; speechNotes.value = []
    Object.keys(rollCallStatus).forEach(key => delete rollCallStatus[key])
    Object.keys(stats).forEach(key => delete stats[key])
    Object.keys(rollCallVoteData).forEach(key => delete rollCallVoteData[key])
    generalTimeLimit.value = 60; currentGeneralSpeaker.value = ''; generalSpeakerTimer.value = 0
    modCaucusSpeakerTimer.value = 0; modCaucusTotalTimer.value = 0; modCaucusTopic.value = ''
    modCaucusDefaultSpeakTime.value = 0; p5Timer.value = 0; caucusTotalTimer.value = 0
    rollCallVoteStatus.value = 'voting'; votingRound2.value = false; currentVotingMotion.value = null
    consensusResult.value = null
    recalcThresholds()
  }

  function loadConference(conferenceId) {
    if (unsubscribe) { unsubscribe(); unsubscribe = null }
    resetRuntimeState()
    delegates.value = []
    agenda.value = DEFAULT_AGENDA()
    title.value = ''
    ownerUid.value = ''
    editors.value = {}
    loaded.value = false
    stateRef = null
    currentConferenceId = conferenceId

    const attach = () => {
      if (currentConferenceId !== conferenceId) return // 已被更新的 loadConference 呼叫取代
      if (!ensureFB()) { setTimeout(attach, 300); return }
      stateRef = dbRefFn(window.firebase.db, 'conferences/' + conferenceId)
      unsubscribe = onValueFn(stateRef, (snap) => {
        if (currentConferenceId !== conferenceId) return
        if (!snap.exists()) return
        const d = snap.val()
        const meta = d.meta || {}
        const s = d.state || {}

        if (meta.title !== title.value) title.value = meta.title || ''
        if (JSON.stringify(meta.delegates) !== JSON.stringify(delegates.value)) delegates.value = meta.delegates || []
        const nextAgenda = meta.agenda && meta.agenda.length ? meta.agenda : DEFAULT_AGENDA()
        if (JSON.stringify(nextAgenda) !== JSON.stringify(agenda.value)) agenda.value = nextAgenda
        if (meta.ownerUid !== ownerUid.value) ownerUid.value = meta.ownerUid || ''
        if (JSON.stringify(meta.editors) !== JSON.stringify(editors.value)) editors.value = meta.editors || {}

        if (s.meetingPhase !== meetingPhase.value) meetingPhase.value = s.meetingPhase ?? '正式辯論'
        if (s.screenMode !== screenMode.value) screenMode.value = s.screenMode ?? 'default'
        if (s.currentSection !== currentSection.value) currentSection.value = s.currentSection ?? '議程 1'
        if (s.rollCallStatus) Object.keys(s.rollCallStatus).forEach(key => { if (rollCallStatus[key] !== s.rollCallStatus[key]) rollCallStatus[key] = s.rollCallStatus[key] })
        if (s.isRollCallActive !== isRollCallActive.value) isRollCallActive.value = !!s.isRollCallActive
        if (s.rollCallFinished !== rollCallFinished.value) rollCallFinished.value = !!s.rollCallFinished
        recalcThresholds()
        if (s.generalTimeLimit !== generalTimeLimit.value) generalTimeLimit.value = s.generalTimeLimit ?? 60
        if (JSON.stringify(s.generalList) !== JSON.stringify(generalList.value)) generalList.value = s.generalList || []
        if (s.currentGeneralSpeaker !== currentGeneralSpeaker.value) currentGeneralSpeaker.value = s.currentGeneralSpeaker || ''
        if (s.generalSpeakerTimer !== generalSpeakerTimer.value) generalSpeakerTimer.value = s.generalSpeakerTimer ?? 0
        if (s.isGeneralTimerRunning !== isGeneralTimerRunning.value) isGeneralTimerRunning.value = !!s.isGeneralTimerRunning
        if (JSON.stringify(s.motionQueue) !== JSON.stringify(motionQueue.value)) motionQueue.value = (s.motionQueue || []).map(m => ({ ...m, details: m.details || {} }))
        const rawMotion = s.currentVotingMotion || null
        if (JSON.stringify(rawMotion) !== JSON.stringify(currentVotingMotion.value)) currentVotingMotion.value = rawMotion ? { ...rawMotion, details: rawMotion.details || {} } : null
        sortMotionQueue()
        if (s.rollCallVoteData) Object.keys(s.rollCallVoteData).forEach(k => { if (rollCallVoteData[k] !== s.rollCallVoteData[k]) rollCallVoteData[k] = s.rollCallVoteData[k] })
        if (s.rollCallVoteStatus !== rollCallVoteStatus.value) rollCallVoteStatus.value = s.rollCallVoteStatus || 'voting'
        if (s.votingRound2 !== votingRound2.value) votingRound2.value = !!s.votingRound2
        if (s.consensusResult !== consensusResult.value) consensusResult.value = s.consensusResult ?? null
        if (s.stats) Object.keys(s.stats).forEach(key => { ensureStatsCountry(key); Object.assign(stats[key], s.stats[key]) })
        if (JSON.stringify(s.documents) !== JSON.stringify(documents.value)) documents.value = (s.documents || []).map(doc => ({ status: doc.status || 'approved', ...doc }))
        if (JSON.stringify(s.speechNotes) !== JSON.stringify(speechNotes.value)) speechNotes.value = s.speechNotes || []
        if (s.p5Timer !== p5Timer.value) p5Timer.value = s.p5Timer ?? 0
        if (s.caucusTotalTimer !== caucusTotalTimer.value) caucusTotalTimer.value = s.caucusTotalTimer ?? 0
        if (s.modCaucusTopic !== modCaucusTopic.value) modCaucusTopic.value = s.modCaucusTopic || ''
        if (s.modCaucusTotalTimer !== modCaucusTotalTimer.value) modCaucusTotalTimer.value = s.modCaucusTotalTimer ?? 0
        if (s.modCaucusSpeakerTimer !== modCaucusSpeakerTimer.value) modCaucusSpeakerTimer.value = s.modCaucusSpeakerTimer ?? 0
        if (s.modCaucusDefaultSpeakTime !== modCaucusDefaultSpeakTime.value) modCaucusDefaultSpeakTime.value = s.modCaucusDefaultSpeakTime ?? 0
        if (s.modCaucusList && JSON.stringify(s.modCaucusList) !== JSON.stringify(modCaucusList.value)) modCaucusList.value = s.modCaucusList
        if (s.currentModSpeaker !== currentModSpeaker.value) currentModSpeaker.value = s.currentModSpeaker || ''
        if (s.isModCaucusRunning !== isModCaucusRunning.value) isModCaucusRunning.value = !!s.isModCaucusRunning
        loaded.value = true
      })
    }
    attach()
  }

  function sync() {
    if (!ensureFB() || !stateRef || !currentConferenceId) return
    recalcThresholds(); sortMotionQueue()
    setFn(childFn(stateRef, 'state'), {
      meetingPhase: meetingPhase.value, screenMode: screenMode.value, currentSection: currentSection.value,
      rollCallStatus: JSON.parse(JSON.stringify(rollCallStatus)), isRollCallActive: isRollCallActive.value,
      rollCallFinished: rollCallFinished.value, rollCallThresholds: JSON.parse(JSON.stringify(rollCallThresholds)),
      generalTimeLimit: generalTimeLimit.value, generalList: JSON.parse(JSON.stringify(generalList.value)),
      currentGeneralSpeaker: currentGeneralSpeaker.value, generalSpeakerTimer: generalSpeakerTimer.value,
      isGeneralTimerRunning: isGeneralTimerRunning.value, motionQueue: JSON.parse(JSON.stringify(motionQueue.value)),
      currentVotingMotion: currentVotingMotion.value ? JSON.parse(JSON.stringify(currentVotingMotion.value)) : null,
      stats: JSON.parse(JSON.stringify(stats)), documents: JSON.parse(JSON.stringify(documents.value)),
      p5Timer: p5Timer.value, caucusTotalTimer: caucusTotalTimer.value,
      modCaucusTopic: modCaucusTopic.value, modCaucusTotalTimer: modCaucusTotalTimer.value,
      modCaucusSpeakerTimer: modCaucusSpeakerTimer.value, modCaucusDefaultSpeakTime: modCaucusDefaultSpeakTime.value,
      modCaucusList: JSON.parse(JSON.stringify(modCaucusList.value)), currentModSpeaker: currentModSpeaker.value,
      isModCaucusRunning: isModCaucusRunning.value,
      rollCallVoteData: JSON.parse(JSON.stringify(rollCallVoteData)),
      rollCallVoteStatus: rollCallVoteStatus.value, votingRound2: votingRound2.value,
      consensusResult: consensusResult.value, speechNotes: JSON.parse(JSON.stringify(speechNotes.value))
    }).catch(() => {})
  }

  async function createConference(newTitle) {
    if (!ensureFB()) throw new Error('尚未連線至資料庫')
    const user = window.firebase.auth?.currentUser
    if (!user) throw new Error('尚未登入')
    const newRef = pushFn(dbRefFn(window.firebase.db, 'conferences'))
    const id = newRef.key
    const now = Date.now()
    const meta = {
      title: newTitle || '未命名會議',
      ownerUid: user.uid,
      createdAt: now,
      delegates: JSON.parse(JSON.stringify(DEFAULT_DELEGATES)),
      agenda: DEFAULT_AGENDA()
    }
    const updates = {}
    updates['conferences/' + id + '/meta'] = meta
    updates['users/' + user.uid + '/conferences/' + id] = { title: meta.title, createdAt: now, role: 'owner' }
    await updateFn(dbRefFn(window.firebase.db, '/'), updates)
    return id
  }

  async function updateMeta({ title: newTitle, delegates: newDelegates, agenda: newAgenda }) {
    if (!ensureFB() || !currentConferenceId) return
    title.value = newTitle; delegates.value = newDelegates; agenda.value = newAgenda
    const user = window.firebase.auth?.currentUser
    const updates = {}
    const base = 'conferences/' + currentConferenceId + '/meta/'
    updates[base + 'title'] = newTitle
    updates[base + 'delegates'] = JSON.parse(JSON.stringify(newDelegates))
    updates[base + 'agenda'] = JSON.parse(JSON.stringify(newAgenda))
    if (user) updates['users/' + user.uid + '/conferences/' + currentConferenceId + '/title'] = newTitle
    await updateFn(dbRefFn(window.firebase.db, '/'), updates)
  }

  async function fetchConferenceTitle(conferenceId) {
    if (!ensureFB()) return ''
    const snap = await getFn(dbRefFn(window.firebase.db, 'conferences/' + conferenceId + '/meta/title'))
    return snap.exists() ? snap.val() : ''
  }

  async function joinAsEditor(conferenceId) {
    if (!ensureFB()) throw new Error('尚未連線至資料庫')
    const user = window.firebase.auth?.currentUser
    if (!user) throw new Error('尚未登入')
    const now = Date.now()
    const conferenceTitle = await fetchConferenceTitle(conferenceId)
    const updates = {}
    updates['conferences/' + conferenceId + '/meta/editors/' + user.uid] = { email: user.email, joinedAt: now }
    updates['users/' + user.uid + '/conferences/' + conferenceId] = { title: conferenceTitle || '未命名會議', createdAt: now, role: 'editor' }
    await updateFn(dbRefFn(window.firebase.db, '/'), updates)
  }

  async function leaveConference(conferenceId) {
    if (!ensureFB()) return
    const user = window.firebase.auth?.currentUser
    if (!user) return
    const updates = {}
    updates['conferences/' + conferenceId + '/meta/editors/' + user.uid] = null
    updates['users/' + user.uid + '/conferences/' + conferenceId] = null
    await updateFn(dbRefFn(window.firebase.db, '/'), updates)
  }

  async function clearStats() {
    if (!ensureFB() || !stateRef) return
    await setFn(childFn(stateRef, 'state/stats'), null)
    Object.keys(stats).forEach(key => delete stats[key])
  }

  function setSection(s) { currentSection.value = s; sync() }
  function startRollCall() {
    delegates.value.forEach(d => { if (d.type === 'member' && (!rollCallStatus[d.name] || rollCallFinished.value)) { rollCallStatus[d.name] = '' } })
    isRollCallActive.value = true; rollCallFinished.value = false; screenMode.value = 'roll_call'; sync()
  }
  function markRollCall(country, status) {
    rollCallStatus[country] = status
    const members = delegates.value.filter(d => d.type === 'member')
    if (members.every(d => rollCallStatus[d.name]) && !rollCallFinished.value) rollCallFinished.value = true
    sync()
  }
  function changeToLate(country) { if (rollCallStatus[country] === 'present') { rollCallStatus[country] = 'late'; sync() } }
  function endRollCall() { isRollCallActive.value = false; screenMode.value = 'default'; sync() }

  function startVotingRollCall() {
    rollCallVoteStatus.value = 'voting'
    votingRound2.value = false
    delegates.value.forEach(d => { delete rollCallVoteData[d.name] })
    screenMode.value = 'voting_roll_call'
    sync()
  }
  function recordRollCallVote(country, voteType) { rollCallVoteData[country] = voteType; sync() }
  function nextVotingRound() { votingRound2.value = true; sync() }
  function endVotingRollCall() { rollCallVoteStatus.value = 'finished'; sync() }
  function resetVoting() { delegates.value.forEach(d => { delete rollCallVoteData[d.name] }); rollCallVoteStatus.value = 'voting'; votingRound2.value = false; sync() }
  function setConsensusResult(result) { consensusResult.value = result; sync() }
  function finishConsensus() { consensusResult.value = null; screenMode.value = 'default'; meetingPhase.value = '正式辯論'; sync() }

  // ✅ 修復：toggleGeneralTimer 競態條件
  function toggleGeneralTimer() {
    if (isGeneralTimerRunning.value) {
      if (generalInterval) { clearInterval(generalInterval); generalInterval = null }
      isGeneralTimerRunning.value = false
      sync()
    } else {
      if (generalSpeakerTimer.value <= 0) return
      isGeneralTimerRunning.value = true
      sync()
      generalInterval = setInterval(() => {
        if (generalSpeakerTimer.value > 0) { generalSpeakerTimer.value--; sync() }
        else { toggleGeneralTimer() }
      }, 1000)
    }
  }

  // ✅ 修正：nextGeneralSpeaker - 正確處理「無」的情況
  function nextGeneralSpeaker() {
    if (generalList.value.length === 0) {
      currentGeneralSpeaker.value = ''
      generalSpeakerTimer.value = 0
      isGeneralTimerRunning.value = false
      if (generalInterval) { clearInterval(generalInterval); generalInterval = null }
      sync()
      return
    }

    // ✅ 檢查當前是否為空（包括 '無', '', null, undefined）
    const isEmpty = !currentGeneralSpeaker.value ||
                    currentGeneralSpeaker.value === '' ||
                    currentGeneralSpeaker.value === '無' ||
                    currentGeneralSpeaker.value === null

    if (isEmpty) {
      // 第一次點擊：取第一個，不移除
      const first = generalList.value[0]
      currentGeneralSpeaker.value = first?.country || ''
      generalSpeakerTimer.value = first?.time || 0
    } else {
      // 已有當前發言人：移除第一個，取下一個
      const newList = [...generalList.value]
      newList.shift()
      const next = newList[0]
      generalList.value = newList
      currentGeneralSpeaker.value = next?.country || ''
      generalSpeakerTimer.value = next?.time || 0
    }

    isGeneralTimerRunning.value = false
    if (generalInterval) { clearInterval(generalInterval); generalInterval = null }
    sync()
  }

  function yieldToDelegate(target) {
    if (!target || !currentGeneralSpeaker.value) return
    const rem = generalSpeakerTimer.value
    const newList = generalList.value.filter(s => s.country !== currentGeneralSpeaker.value)
    generalList.value = newList
    currentGeneralSpeaker.value = target
    generalSpeakerTimer.value = rem
    if (generalInterval) clearInterval(generalInterval)
    if (rem > 0) {
      isGeneralTimerRunning.value = true
      generalInterval = setInterval(() => {
        if (generalSpeakerTimer.value > 0) { generalSpeakerTimer.value--; sync() }
        else { if (generalInterval) { clearInterval(generalInterval); generalInterval = null }; isGeneralTimerRunning.value = false; sync() }
      }, 1000)
    }
    sync()
  }

  function addToGeneralList(c) {
    if (!c || generalList.value.find(s => s.country === c)) return
    generalList.value.push({ country: c, time: generalTimeLimit.value })
    ensureStatsCountry(c); stats[c].speeches++; sync()
  }
  function addToModCaucus(c) {
    if (!c || modCaucusList.value.find(s => s.country === c)) return
    modCaucusList.value.push({ country: c, time: modCaucusDefaultSpeakTime.value || 60 }); sync()
  }
  function submitMotion(type, country, details) {
    if (!type || !country) return
    if (!delegates.value.some(d => d.name === country && d.type === 'member')) return alert('⚠️ 僅理事國可動議')
    if (type === 'P5閉門協商' && !delegates.value.find(d => d.name === country)?.p5) return alert('⚠️ 僅P5可提閉門')
    if (type === '有主持核心磋商') {
      const t = (details.totalTime || 10) * 60, s = details.speakTime || 60
      if (t % s !== 0) return alert('⚠️ 發言時長須整除總時長')
    }
    motionQueue.value.push({ id: Date.now(), type, country, details: details||{}, priority: 0 })
    ensureStatsCountry(country); if (!stats[country].motions[type]) stats[country].motions[type] = 0; stats[country].motions[type]++
    sync()
  }
  function approveMotion(i) {
    if (i<0||i>=motionQueue.value.length) return
    const m = motionQueue.value[i]
    ensureStatsCountry(m.country); stats[m.country].motionsPassed = (stats[m.country].motionsPassed || 0) + 1
    currentVotingMotion.value = m; motionQueue.value.splice(i,1); screenMode.value = 'motion_voting'; sync()
  }
  function executeMotion() {
    const m = currentVotingMotion.value; if (!m) return; clearAllTimers()
    if (m.type==='自由磋商'||m.type==='全體諮詢') {
      screenMode.value='caucus'; meetingPhase.value=m.type; caucusTotalTimer.value=(m.details.duration||10)*60; sync()
      caucusInterval=setInterval(()=>{ if(caucusInterval&&caucusTotalTimer.value>0){caucusTotalTimer.value--;sync()} else{clearInterval(caucusInterval);screenMode.value='default';meetingPhase.value='正式辯論';sync()} },1000)
    } else if (m.type==='有主持核心磋商') {
      modCaucusTopic.value=m.details.topic||'未指定'; modCaucusTotalTimer.value=(m.details.totalTime||10)*60
      modCaucusDefaultSpeakTime.value=m.details.speakTime||60; modCaucusSpeakerTimer.value=0; currentModSpeaker.value=''
      screenMode.value='mod_caucus'; meetingPhase.value='有主持核心磋商'; sync()
    } else if (m.type==='暫停會議') { screenMode.value='suspended'; meetingPhase.value='會議暫停'; sync() }
    else if (m.type==='恢復會議') { screenMode.value='default'; meetingPhase.value='正式辯論'; sync() }
    else if (m.type==='P5閉門協商') {
      screenMode.value='p5_closed'; meetingPhase.value='P5閉門協商'; p5Timer.value=600; sync()
      p5Interval=setInterval(()=>{ if(p5Interval&&p5Timer.value>0){p5Timer.value--;sync()} else{clearInterval(p5Interval);screenMode.value='default';meetingPhase.value='正式辯論';sync()} },1000)
    } else if (m.type==='唱名表決') { startVotingRollCall() }
    else if (m.type==='共識決') { screenMode.value = 'voting_consensus'; meetingPhase.value = '共識決'; sync() }
    currentVotingMotion.value = null; motionQueue.value = []; sync()
  }
  // ✅ 修正：nextModSpeaker 正確處理「無」的初始狀態
  function nextModSpeaker() {
    if (modCaucusList.value.length === 0) return

    // 檢查當前是否為空（包含 '無', '', null, undefined）
    const isEmpty = !currentModSpeaker.value ||
                    currentModSpeaker.value === '' ||
                    currentModSpeaker.value === '無' ||
                    currentModSpeaker.value === null

    if (isEmpty) {
      // 第一次點擊：直接設為第一位，不移除名單
      const first = modCaucusList.value[0]
      currentModSpeaker.value = first?.country || ''
      modCaucusSpeakerTimer.value = first?.time || 0
    } else {
      // 已有發言人：移除當前，切換到下一位
      modCaucusList.value.shift()
      const next = modCaucusList.value[0]
      currentModSpeaker.value = next?.country || ''
      modCaucusSpeakerTimer.value = next?.time || 0
    }

    // 切換發言人時暫停計時器
    if (modCaucusInterval) { clearInterval(modCaucusInterval); modCaucusInterval = null }
    sync()
  }

  function toggleModCaucusTimer() {
    if (isModCaucusRunning.value) {
      // 暫停：同時停止總時長和發言人計時器
      if (modCaucusInterval) { clearInterval(modCaucusInterval); modCaucusInterval = null }
      isModCaucusRunning.value = false
      sync()
    } else {
      // 開始：同時啟動總時長和發言人計時器
      if (modCaucusTotalTimer.value <= 0) return
      isModCaucusRunning.value = true
      sync()
      modCaucusInterval = setInterval(() => {
        let end = false
        // 總時長倒數
        if (modCaucusTotalTimer.value > 0) modCaucusTotalTimer.value--
        else end = true

        // 發言人時長倒數
        if (modCaucusSpeakerTimer.value > 0) modCaucusSpeakerTimer.value--
        else {
          // 發言人時間到，停止所有計時器
          if (modCaucusInterval) { clearInterval(modCaucusInterval); modCaucusInterval = null }
          isModCaucusRunning.value = false
          modCaucusSpeakerTimer.value = 0
        }

        sync()

        // 總時長結束
        if (end) {
          if (modCaucusInterval) { clearInterval(modCaucusInterval); modCaucusInterval = null }
          isModCaucusRunning.value = false
          screenMode.value = 'default'
          meetingPhase.value = '正式辯論'
          sync()
        }
      }, 1000)
    }
  }

  // ✅ 修正：rejectMotion - 直接刪除，不進入投票
  function rejectMotion() {
    currentVotingMotion.value = null
    // 直接從佇列移除，不進入投票流程
    if (motionQueue.value.length > 0) {
      sortMotionQueue()
      // 如果有下一個動議，繼續顯示
      currentVotingMotion.value = motionQueue.value.shift()
      screenMode.value = 'motion_voting'
    } else {
      // 如果佇列為空，返回正式辯論
      screenMode.value = 'default'
      meetingPhase.value = '正式辯論'
    }
    sync()
  }

  async function uploadDocument(type, num, title, file) {
    if (!type || !num || !title || !file) return
    const fb = ensureStorage()
    if (!fb || !currentConferenceId) { alert('⚠️ 檔案儲存服務尚未就緒，請稍後再試'); return }
    try {
      const path = `documents/${currentConferenceId}/${Date.now()}_${file.name}`
      const fileRef = fb.storageMethods.ref(fb.storage, path)
      await fb.storageMethods.uploadBytes(fileRef, file)
      const fileURL = await fb.storageMethods.getDownloadURL(fileRef)
      documents.value.push({ type, number: num, title, fileURL, path, status: 'pending', uploadedAt: Date.now() })
      sync()
    } catch (e) {
      alert('❌ 上傳失敗，請重試')
    }
  }
  function reviewDocument(i, status) {
    if (!documents.value[i]) return
    documents.value[i].status = status
    sync()
  }
  function addSpeechNote(country, phase, note) {
    if (!country || !note) return
    speechNotes.value.unshift({ id: Date.now(), country, phase: phase || meetingPhase.value, note, timestamp: Date.now() })
    sync()
  }
  function deleteSpeechNote(id) { speechNotes.value = speechNotes.value.filter(n => n.id !== id); sync() }
  function suspendMeeting() { clearAllTimers(); screenMode.value='suspended'; meetingPhase.value='會議暫停'; sync() }
  function resumeMeeting() { screenMode.value='default'; meetingPhase.value='正式辯論'; sync() }
  function returnToDebate() { modCaucusList.value=[]; currentModSpeaker.value=''; modCaucusSpeakerTimer.value=0; modCaucusTotalTimer.value=0; isModCaucusRunning.value=false; screenMode.value='default'; meetingPhase.value='正式辯論'; sync() }
  function saveProgress() { sync() }
  function resetMeeting() {
    if (!confirm('⚠️ 確定要重置整個會議嗎？這將清除所有點名、投票、動議與統計紀錄，且無法復原！')) return
    resetRuntimeState()
    sync()
    setTimeout(() => { window.location.reload() }, 500)
  }

  return {
    title, delegates, agenda, loaded, ownerUid, editors,
    meetingPhase, screenMode, currentSection, rollCallStatus, isRollCallActive, rollCallFinished, rollCallThresholds,
    generalTimeLimit, generalList, currentGeneralSpeaker, generalSpeakerTimer, isGeneralTimerRunning,
    motionQueue, currentVotingMotion, votingRound2, voteCounts, passedVote, rollCallVoteData, rollCallVoteStatus,
    stats, documents,
    p5Timer, caucusTotalTimer, modCaucusTopic, modCaucusTotalTimer, modCaucusSpeakerTimer, modCaucusDefaultSpeakTime, modCaucusList, currentModSpeaker, isModCaucusRunning,
    loadConference, createConference, updateMeta, clearStats, fetchConferenceTitle, joinAsEditor, leaveConference,
    clearAllTimers, toggleGeneralTimer, nextGeneralSpeaker, yieldToDelegate, addToGeneralList,
    submitMotion, approveMotion, rejectMotion, executeMotion, toggleModCaucusTimer, nextModSpeaker, addToModCaucus,
    uploadDocument, reviewDocument, suspendMeeting, resumeMeeting, setSection, startRollCall, markRollCall, endRollCall, changeToLate, returnToDebate,
    startVotingRollCall, recordRollCallVote, nextVotingRound, endVotingRollCall, resetVoting, finishConsensus,
    consensusResult, setConsensusResult, speechNotes, addSpeechNote, deleteSpeechNote,
    saveProgress, resetMeeting, recalcThresholds, sync
  }
})
