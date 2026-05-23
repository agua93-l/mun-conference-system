// src/stores/conference.js
import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

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

  // ✅ 動態計算投票門檻（基於當前出席人數）
  const recalcThresholds = () => {
    const presentCount = Object.values(rollCallStatus).filter(s => s === 'present').length
    rollCallThresholds.present = presentCount
    rollCallThresholds.simple = Math.floor(presentCount / 2) + 1
    rollCallThresholds.twoThirds = Math.ceil(presentCount * 2 / 3)
    rollCallThresholds.oneFifth = Math.ceil(presentCount / 5)
  }

  // ✅ 動議排序邏輯
  const sortMotionQueue = () => {
    const priorityMap = {
      '終止會議': 1, '暫停會議': 2, '自由磋商': 3, '全體諮詢': 3,
      '有主持核心磋商': 4, '介紹決議草案': 5, '介紹修正案': 6, 'P5閉門協商': 7, '結束辯論': 8
    }
    motionQueue.value.sort((a, b) => {
      const pA = priorityMap[a.type] || 99
      const pB = priorityMap[b.type] || 99
      if (pA !== pB) return pA - pB // 1. 議事規則排序
      const durA = (a.details.totalTime || a.details.duration || 0) * 60
      const durB = (b.details.totalTime || b.details.duration || 0) * 60
      if (durA !== durB) return durB - durA // 2. 總時長長的在前
      if (a.type === '有主持核心磋商' && b.type === '有主持核心磋商') {
        const sA = durA / ((a.details.speakTime || 60))
        const sB = durB / ((b.details.speakTime || 60))
        if (sA !== sB) return sB - sA // 3. 代表數多的在前
      }
      return (a.id || 0) - (b.id || 0) // 4. 先後順序
    })
  }

  const startListener = () => {
    if (!ensureFB()) { setTimeout(startListener, 300); return }
    onValueFn(stateRef, (snap) => {
      if (!snap.exists()) return
      const d = snap.val()
      meetingPhase.value = d.meetingPhase ?? '正式辯論'
      screenMode.value = d.screenMode ?? 'default'
      currentSection.value = d.currentSection ?? '議程 1'
      if (d.rollCallStatus) Object.assign(rollCallStatus, d.rollCallStatus)
      isRollCallActive.value = !!d.isRollCallActive
      rollCallFinished.value = !!d.rollCallFinished
      recalcThresholds() // ✅ 同步後重新計算門檻
      generalTimeLimit.value = d.generalTimeLimit ?? 60
      generalList.value = d.generalList || []
      currentGeneralSpeaker.value = d.currentGeneralSpeaker || ''
      generalSpeakerTimer.value = d.generalSpeakerTimer ?? 0
      isGeneralTimerRunning.value = !!d.isGeneralTimerRunning
      
      motionQueue.value = (d.motionQueue || []).map(m => ({ ...m, details: m.details || {} }))
      currentVotingMotion.value = d.currentVotingMotion || null
      sortMotionQueue() // ✅ 確保佇列有序

      Object.keys(d.stats || {}).forEach(key => {
        if (!stats[key]) stats[key] = { speeches: 0, motions: {} }
        if (!stats[key].motions) stats[key].motions = {}
        Object.assign(stats[key], d.stats[key])
      })
      documents.value = d.documents || []
      p5Timer.value = d.p5Timer ?? 0
      caucusTotalTimer.value = d.caucusTotalTimer ?? 0
      modCaucusTopic.value = d.modCaucusTopic || ''
      modCaucusTotalTimer.value = d.modCaucusTotalTimer ?? 0
      modCaucusSpeakerTimer.value = d.modCaucusSpeakerTimer ?? 0
      modCaucusDefaultSpeakTime.value = d.modCaucusDefaultSpeakTime ?? 0
      if (d.modCaucusList) modCaucusList.value = d.modCaucusList
      currentModSpeaker.value = d.currentModSpeaker || ''
      isModCaucusRunning.value = !!d.isModCaucusRunning
    })
  }
  startListener()

  function sync() {
    if (!ensureFB()) return
    recalcThresholds()
    sortMotionQueue()
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
      isModCaucusRunning: isModCaucusRunning.value
    }).catch(() => {})
  }

  function clearAllTimers() {
    [generalInterval, caucusInterval, modCaucusInterval, p5Interval].forEach(t => t && clearInterval(t))
    generalInterval = caucusInterval = modCaucusInterval = p5Interval = null
    isGeneralTimerRunning.value = false; isModCaucusRunning.value = false
  }

  function setSection(s) { currentSection.value = s; sync() }
  function startRollCall() {
    delegates.forEach(d => { if (!rollCallStatus[d.name]) rollCallStatus[d.name] = '' })
    isRollCallActive.value = true; rollCallFinished.value = false; screenMode.value = 'roll_call'; sync()
  }
  function markRollCall(country, status) {
    rollCallStatus[country] = status
    if (delegates.every(d => rollCallStatus[d.name]) && !rollCallFinished.value) rollCallFinished.value = true
    sync()
  }
  function changeToLate(country) {
    if (rollCallStatus[country] === 'present') { rollCallStatus[country] = 'late'; sync() }
  }
  function endRollCall() { isRollCallActive.value = false; screenMode.value = 'default'; sync() }

  function toggleGeneralTimer() {
    if (isGeneralTimerRunning.value) { generalInterval && clearInterval(generalInterval); isGeneralTimerRunning.value = false; sync() }
    else {
      if (generalSpeakerTimer.value <= 0) return
      isGeneralTimerRunning.value = true; sync()
      generalInterval = setInterval(() => { if (generalSpeakerTimer.value > 0) { generalSpeakerTimer.value--; sync() } else toggleGeneralTimer() }, 1000)
    }
  }
  function nextGeneralSpeaker() {
    if (generalList.value.length === 0) return
    generalList.value.shift()
    currentGeneralSpeaker.value = generalList.value[0]?.country || ''
    generalSpeakerTimer.value = generalList.value[0]?.time || 0
    isGeneralTimerRunning.value = false; generalInterval && clearInterval(generalInterval); sync()
  }
  function yieldToDelegate(target) {
    if (!target || !currentGeneralSpeaker.value) return
    const rem = generalSpeakerTimer.value
    generalList.value = generalList.value.filter(s => s.country !== currentGeneralSpeaker.value)
    currentGeneralSpeaker.value = target; generalSpeakerTimer.value = rem
    generalInterval && clearInterval(generalInterval)
    if (rem > 0) {
      isGeneralTimerRunning.value = true
      generalInterval = setInterval(() => { if (generalSpeakerTimer.value > 0) { generalSpeakerTimer.value--; sync() } else { generalInterval && clearInterval(generalInterval); isGeneralTimerRunning.value = false; sync() } }, 1000)
    }
    sync()
  }
  function addToGeneralList(c) {
    if (!c || generalList.value.find(s => s.country === c)) return
    generalList.value.push({ country: c, time: generalTimeLimit.value })
    if (!stats[c]) stats[c] = { speeches: 0, motions: {} }
    if (!stats[c].motions) stats[c].motions = {}
    stats[c].speeches++; sync()
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
    if (!stats[country]) stats[country] = { speeches:0, motions:{} }
    if (!stats[country].motions) stats[country].motions = {}
    if (!stats[country].motions[type]) stats[country].motions[type] = 0
    stats[country].motions[type]++
    sync()
  }
  function approveMotion(i) {
    if (i<0||i>=motionQueue.value.length) return
    currentVotingMotion.value = motionQueue.value[i]; motionQueue.value.splice(i,1); screenMode.value = 'motion_voting'; sync()
  }
  function rejectMotion() {
    // ✅ 駁回後自動跳下一筆已排序的動議
    currentVotingMotion.value = null
    if (motionQueue.value.length > 0) {
      sortMotionQueue()
      currentVotingMotion.value = motionQueue.value.shift()
      screenMode.value = 'motion_voting'
    } else {
      screenMode.value = 'default'
      meetingPhase.value = '正式辯論'
    }
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
    }
    currentVotingMotion.value = null; sync()
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

  return {
    meetingPhase, screenMode, currentSection, rollCallStatus, isRollCallActive, rollCallFinished, rollCallThresholds,
    generalTimeLimit, generalList, currentGeneralSpeaker, generalSpeakerTimer, isGeneralTimerRunning,
    motionQueue, currentVotingMotion, stats, documents, delegates,
    p5Timer, caucusTotalTimer, modCaucusTopic, modCaucusTotalTimer, modCaucusSpeakerTimer, modCaucusDefaultSpeakTime, modCaucusList, currentModSpeaker, isModCaucusRunning,
    clearAllTimers, toggleGeneralTimer, nextGeneralSpeaker, yieldToDelegate, addToGeneralList,
    submitMotion, approveMotion, rejectMotion, executeMotion, toggleModCaucusTimer, nextModSpeaker, addToModCaucus,
    addDocument, suspendMeeting, resumeMeeting, setSection, startRollCall, markRollCall, endRollCall, changeToLate, returnToDebate, recalcThresholds, sync
  }
})