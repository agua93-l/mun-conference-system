// src/stores/conference.js
import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'

let fbReady = false
let dbRefFn, setFn, onValueFn, stateRef

const ensureFB = () => {
  if (fbReady) return true
  const fb = window.firebase
  if (!fb || !fb.db || !fb.dbMethods) return false
  dbRefFn = fb.dbMethods.ref
  setFn = fb.dbMethods.set
  onValueFn = fb.dbMethods.onValue
  stateRef = dbRefFn(fb.db, 'mun_state')
  fbReady = true
  return true
}

const initRetry = setInterval(() => { if (ensureFB()) clearInterval(initRetry) }, 200)

export const useConferenceStore = defineStore('conference', () => {
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

  const delegates = [
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

  const ensureStatsCountry = (country) => {
    if (!stats[country]) {
      stats[country] = { speeches: 0, motions: { '自由磋商':0, '全體諮詢':0, '有主持核心磋商':0, '暫停會議':0, '恢復會議':0, '介紹決議草案':0, '介紹修正案':0, 'P5閉門協商':0, '唱名表決':0, '共識決':0 } }
    }
  }

  const recalcThresholds = () => {
    const memberDelegates = delegates.filter(d => d.type === 'member')
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
    const p5Veto = delegates.some(d => d.p5 && (rollCallVoteData[d.name] === 'no' || rollCallVoteData[d.name] === 'no_speak'))
    return !p5Veto && voteCounts.value.yes >= 9
  })

  const startListener = () => {
    if (!ensureFB()) { setTimeout(startListener, 300); return }
    onValueFn(stateRef, (snap) => {
      if (!snap.exists()) return
      const d = snap.val()
      if (d.meetingPhase !== meetingPhase.value) meetingPhase.value = d.meetingPhase ?? '正式辯論'
      if (d.screenMode !== screenMode.value) screenMode.value = d.screenMode ?? 'default'
      if (d.currentSection !== currentSection.value) currentSection.value = d.currentSection ?? '議程 1'
      if (d.rollCallStatus) Object.keys(d.rollCallStatus).forEach(key => { if (rollCallStatus[key] !== d.rollCallStatus[key]) rollCallStatus[key] = d.rollCallStatus[key] })
      if (d.isRollCallActive !== isRollCallActive.value) isRollCallActive.value = !!d.isRollCallActive
      if (d.rollCallFinished !== rollCallFinished.value) rollCallFinished.value = !!d.rollCallFinished
      recalcThresholds()
      if (d.generalTimeLimit !== generalTimeLimit.value) generalTimeLimit.value = d.generalTimeLimit ?? 60
      if (JSON.stringify(d.generalList) !== JSON.stringify(generalList.value)) generalList.value = d.generalList || []
      if (d.currentGeneralSpeaker !== currentGeneralSpeaker.value) currentGeneralSpeaker.value = d.currentGeneralSpeaker || ''
      if (d.generalSpeakerTimer !== generalSpeakerTimer.value) generalSpeakerTimer.value = d.generalSpeakerTimer ?? 0
      if (d.isGeneralTimerRunning !== isGeneralTimerRunning.value) isGeneralTimerRunning.value = !!d.isGeneralTimerRunning
      if (JSON.stringify(d.motionQueue) !== JSON.stringify(motionQueue.value)) motionQueue.value = (d.motionQueue || []).map(m => ({ ...m, details: m.details || {} }))
      const rawMotion = d.currentVotingMotion || null
      if (JSON.stringify(rawMotion) !== JSON.stringify(currentVotingMotion.value)) currentVotingMotion.value = rawMotion ? { ...rawMotion, details: rawMotion.details || {} } : null
      sortMotionQueue()
      if (d.rollCallVoteData) Object.keys(d.rollCallVoteData).forEach(k => { if (rollCallVoteData[k] !== d.rollCallVoteData[k]) rollCallVoteData[k] = d.rollCallVoteData[k] })
      if (d.rollCallVoteStatus !== rollCallVoteStatus.value) rollCallVoteStatus.value = d.rollCallVoteStatus || 'voting'
      if (d.votingRound2 !== votingRound2.value) votingRound2.value = !!d.votingRound2
      if (d.stats) Object.keys(d.stats).forEach(key => { ensureStatsCountry(key); Object.assign(stats[key], d.stats[key]) })
      if (JSON.stringify(d.documents) !== JSON.stringify(documents.value)) documents.value = d.documents || []
      if (d.p5Timer !== p5Timer.value) p5Timer.value = d.p5Timer ?? 0
      if (d.caucusTotalTimer !== caucusTotalTimer.value) caucusTotalTimer.value = d.caucusTotalTimer ?? 0
      if (d.modCaucusTopic !== modCaucusTopic.value) modCaucusTopic.value = d.modCaucusTopic || ''
      if (d.modCaucusTotalTimer !== modCaucusTotalTimer.value) modCaucusTotalTimer.value = d.modCaucusTotalTimer ?? 0
      if (d.modCaucusSpeakerTimer !== modCaucusSpeakerTimer.value) modCaucusSpeakerTimer.value = d.modCaucusSpeakerTimer ?? 0
      if (d.modCaucusDefaultSpeakTime !== modCaucusDefaultSpeakTime.value) modCaucusDefaultSpeakTime.value = d.modCaucusDefaultSpeakTime ?? 0
      if (d.modCaucusList && JSON.stringify(d.modCaucusList) !== JSON.stringify(modCaucusList.value)) modCaucusList.value = d.modCaucusList
      if (d.currentModSpeaker !== currentModSpeaker.value) currentModSpeaker.value = d.currentModSpeaker || ''
      if (d.isModCaucusRunning !== isModCaucusRunning.value) isModCaucusRunning.value = !!d.isModCaucusRunning
    })
  }
  startListener()

  function sync() {
    if (!ensureFB()) return
    recalcThresholds(); sortMotionQueue()
    setFn(stateRef, {
      meetingPhase: meetingPhase.value, screenMode: screenMode.value, currentSection: currentSection.value,
      rollCallStatus: JSON.parse(JSON.stringify(rollCallStatus)), isRollCallActive: isRollCallActive.value,
      rollCallFinished: rollCallFinished.value, rollCallThresholds: JSON.parse(JSON.stringify(rollCallThresholds)),
      generalTimeLimit: generalTimeLimit.value, generalList: JSON.parse(JSON.stringify(generalList.value)),
      currentGeneralSpeaker: currentGeneralSpeaker.value, generalSpeakerTimer: generalSpeakerTimer.value,
      isGeneralTimerRunning: isGeneralTimerRunning.value, motionQueue: JSON.parse(JSON.stringify(motionQueue.value)),
      currentVotingMotion: currentVotingMotion.value ? JSON.parse(JSON.stringify(currentVotingMotion.value)) : null,
      stats: JSON.parse(JSON.stringify(stats)), documents: JSON.parse(JSON.stringify(documents.value)),
      delegates: JSON.parse(JSON.stringify(delegates)), p5Timer: p5Timer.value, caucusTotalTimer: caucusTotalTimer.value,
      modCaucusTopic: modCaucusTopic.value, modCaucusTotalTimer: modCaucusTotalTimer.value,
      modCaucusSpeakerTimer: modCaucusSpeakerTimer.value, modCaucusDefaultSpeakTime: modCaucusDefaultSpeakTime.value,
      modCaucusList: JSON.parse(JSON.stringify(modCaucusList.value)), currentModSpeaker: currentModSpeaker.value,
      isModCaucusRunning: isModCaucusRunning.value,
      rollCallVoteData: JSON.parse(JSON.stringify(rollCallVoteData)),
      rollCallVoteStatus: rollCallVoteStatus.value, votingRound2: votingRound2.value
    }).catch(() => {})
  }

  function clearAllTimers() {
    [generalInterval, caucusInterval, modCaucusInterval, p5Interval].forEach(t => t && clearInterval(t))
    generalInterval = caucusInterval = modCaucusInterval = p5Interval = null
    isGeneralTimerRunning.value = false; isModCaucusRunning.value = false
  }

  function setSection(s) { currentSection.value = s; sync() }
  function startRollCall() {
    delegates.forEach(d => { if (d.type === 'member' && (!rollCallStatus[d.name] || rollCallFinished.value)) { rollCallStatus[d.name] = '' } })
    isRollCallActive.value = true; rollCallFinished.value = false; screenMode.value = 'roll_call'; sync()
  }
  function markRollCall(country, status) {
    rollCallStatus[country] = status
    const members = delegates.filter(d => d.type === 'member')
    if (members.every(d => rollCallStatus[d.name]) && !rollCallFinished.value) rollCallFinished.value = true
    sync()
  }
  function changeToLate(country) { if (rollCallStatus[country] === 'present') { rollCallStatus[country] = 'late'; sync() } }
  function endRollCall() { isRollCallActive.value = false; screenMode.value = 'default'; sync() }

  function startVotingRollCall() {
    rollCallVoteStatus.value = 'voting'
    votingRound2.value = false
    delegates.forEach(d => { delete rollCallVoteData[d.name] })
    screenMode.value = 'voting_roll_call'
    sync()
  }
  function recordRollCallVote(country, voteType) { rollCallVoteData[country] = voteType; sync() }
  function nextVotingRound() { votingRound2.value = true; sync() }
  function endVotingRollCall() { rollCallVoteStatus.value = 'finished'; sync() }
  function resetVoting() { delegates.forEach(d => { delete rollCallVoteData[d.name] }); rollCallVoteStatus.value = 'voting'; votingRound2.value = false; sync() }
  function finishConsensus() { screenMode.value = 'default'; meetingPhase.value = '正式辯論'; sync() }

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
    if (!delegates.some(d => d.name === country && d.type === 'member')) return alert('⚠️ 僅理事國可動議')
    if (type === 'P5閉門協商' && !delegates.find(d => d.name === country)?.p5) return alert('⚠️ 僅P5可提閉門')
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
    currentVotingMotion.value = motionQueue.value[i]; motionQueue.value.splice(i,1); screenMode.value = 'motion_voting'; sync()
  }
  function rejectMotion() {
    currentVotingMotion.value = null
    if (motionQueue.value.length > 0) { sortMotionQueue(); currentVotingMotion.value = motionQueue.value.shift(); screenMode.value = 'motion_voting' }
    else { screenMode.value = 'default'; meetingPhase.value = '正式辯論' }
    sync()
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
  function nextModSpeaker() {
    if (modCaucusList.value.length===0) return
    modCaucusList.value.shift()
    const n = modCaucusList.value[0]
    if (n) { currentModSpeaker.value=n.country; modCaucusSpeakerTimer.value=n.time }
    else { currentModSpeaker.value=''; modCaucusSpeakerTimer.value=0 }
    sync()
  }
  function toggleModCaucusTimer() {
    if (isModCaucusRunning.value) { modCaucusInterval && clearInterval(modCaucusInterval); isModCaucusRunning.value=false; sync() }
    else {
      if (modCaucusTotalTimer.value<=0) return
      isModCaucusRunning.value=true; sync()
      modCaucusInterval=setInterval(()=>{
        let end=false
        if (modCaucusTotalTimer.value>0) modCaucusTotalTimer.value--; else end=true
        if (modCaucusSpeakerTimer.value>0) modCaucusSpeakerTimer.value--
        else { modCaucusInterval&&clearInterval(modCaucusInterval); isModCaucusRunning.value=false; modCaucusSpeakerTimer.value=0 }
        sync()
        if (end) { clearInterval(modCaucusInterval); isModCaucusRunning.value=false; screenMode.value='default'; meetingPhase.value='正式辯論'; sync() }
      },1000)
    }
  }
  function addDocument(type, num, title) { if(!type||!num||!title) return; documents.value.push({type,number:num,title}); sync() }
  function suspendMeeting() { clearAllTimers(); screenMode.value='suspended'; meetingPhase.value='會議暫停'; sync() }
  function resumeMeeting() { screenMode.value='default'; meetingPhase.value='正式辯論'; sync() }
  function returnToDebate() { modCaucusList.value=[]; currentModSpeaker.value=''; modCaucusSpeakerTimer.value=0; modCaucusTotalTimer.value=0; isModCaucusRunning.value=false; screenMode.value='default'; meetingPhase.value='正式辯論'; sync() }
  function saveProgress() { sync() }
  function resetMeeting() {
    if (!confirm('⚠️ 確定要重置整個會議嗎？這將清除所有點名、投票、動議與統計紀錄，且無法復原！')) return
    meetingPhase.value = '正式辯論'; screenMode.value = 'default'
    isRollCallActive.value = false; rollCallFinished.value = false
    isGeneralTimerRunning.value = false; isModCaucusRunning.value = false
    generalList.value = []; motionQueue.value = []; documents.value = []; modCaucusList.value = []
    Object.keys(rollCallStatus).forEach(key => delete rollCallStatus[key])
    Object.keys(stats).forEach(key => delete stats[key])
    Object.keys(rollCallVoteData).forEach(key => delete rollCallVoteData[key])
    generalTimeLimit.value = 60; currentGeneralSpeaker.value = ''; generalSpeakerTimer.value = 0
    modCaucusSpeakerTimer.value = 0; modCaucusTotalTimer.value = 0; modCaucusTopic.value = ''
    modCaucusDefaultSpeakTime.value = 0; p5Timer.value = 0; caucusTotalTimer.value = 0
    rollCallVoteStatus.value = 'voting'; votingRound2.value = false; currentVotingMotion.value = null
    recalcThresholds(); sync()
    setTimeout(() => { window.location.reload() }, 500)
  }

  return {
    meetingPhase, screenMode, currentSection, rollCallStatus, isRollCallActive, rollCallFinished, rollCallThresholds,
    generalTimeLimit, generalList, currentGeneralSpeaker, generalSpeakerTimer, isGeneralTimerRunning,
    motionQueue, currentVotingMotion, votingRound2, voteCounts, passedVote, rollCallVoteData, rollCallVoteStatus,
    stats, documents, delegates,
    p5Timer, caucusTotalTimer, modCaucusTopic, modCaucusTotalTimer, modCaucusSpeakerTimer, modCaucusDefaultSpeakTime, modCaucusList, currentModSpeaker, isModCaucusRunning,
    clearAllTimers, toggleGeneralTimer, nextGeneralSpeaker, yieldToDelegate, addToGeneralList,
    submitMotion, approveMotion, rejectMotion, executeMotion, toggleModCaucusTimer, nextModSpeaker, addToModCaucus,
    addDocument, suspendMeeting, resumeMeeting, setSection, startRollCall, markRollCall, endRollCall, changeToLate, returnToDebate,
    startVotingRollCall, recordRollCallVote, nextVotingRound, endVotingRollCall, resetVoting, finishConsensus,
    saveProgress, resetMeeting, recalcThresholds, sync
  }
})