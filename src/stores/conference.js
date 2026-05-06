// src/stores/conference.js (開頭部分)
import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { db, auth } from '../firebase' 
import { ref as dbRef, set, onValue } from 'firebase/database'

export const useConferenceStore = defineStore('conference', () => {
  // === State ===
  const meetingPhase = ref('正式辯論')
  const screenMode = ref('default')
  const currentSection = ref('議程 1')
  const rollCallStatus = reactive({})
  const isRollCallActive = ref(false)
  const rollCallFinished = ref(false)
  const rollCallThresholds = reactive({ total: 0, simple: 0, absolute: 0, oneFifth: 0 })
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

  // === Firebase Sync ===
  function sync() {
    if (!auth.currentUser) return
    set(stateRef, {
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
    }).catch(err => console.error('Sync failed:', err))
  }

  onValue(stateRef, (snapshot) => {
    if (snapshot.exists()) {
      const d = snapshot.val()
      meetingPhase.value = d.meetingPhase; screenMode.value = d.screenMode; currentSection.value = d.currentSection
      Object.assign(rollCallStatus, d.rollCallStatus || {})
      isRollCallActive.value = d.isRollCallActive; rollCallFinished.value = d.rollCallFinished
      Object.assign(rollCallThresholds, d.rollCallThresholds || {})
      generalTimeLimit.value = d.generalTimeLimit; generalList.value = d.generalList || []
      currentGeneralSpeaker.value = d.currentGeneralSpeaker; generalSpeakerTimer.value = d.generalSpeakerTimer
      isGeneralTimerRunning.value = d.isGeneralTimerRunning
      motionQueue.value = d.motionQueue || []; currentVotingMotion.value = d.currentVotingMotion
      Object.assign(stats, d.stats || {}); documents.value = d.documents || []
      p5Timer.value = d.p5Timer; caucusTotalTimer.value = d.caucusTotalTimer
      modCaucusTopic.value = d.modCaucusTopic; modCaucusTotalTimer.value = d.modCaucusTotalTimer
      modCaucusSpeakerTimer.value = d.modCaucusSpeakerTimer; modCaucusDefaultSpeakTime.value = d.modCaucusDefaultSpeakTime
      modCaucusList.value = d.modCaucusList || []; currentModSpeaker.value = d.currentModSpeaker
      isModCaucusRunning.value = d.isModCaucusRunning
    }
  })

  // === Actions ===
  function clearAllTimers() {
    [generalInterval, caucusInterval, modCaucusInterval, p5Interval].forEach(t => t && clearInterval(t))
    generalInterval = caucusInterval = modCaucusInterval = p5Interval = null
    isGeneralTimerRunning.value = false; isModCaucusRunning.value = false
  }

  function setSection(s) { currentSection.value = s; sync() }
  function startRollCall() {
    delegates.forEach(d => rollCallStatus[d.name] = '')
    isRollCallActive.value = true; rollCallFinished.value = false; screenMode.value = 'roll_call'; sync()
  }
  function markRollCall(country, status) {
    rollCallStatus[country] = status
    if (delegates.every(d => rollCallStatus[d.name]) && !rollCallFinished.value) {
      rollCallFinished.value = true
      const count = delegates.filter(d => d.type === 'member').length
      rollCallThresholds.total = count; rollCallThresholds.simple = Math.floor(count / 2) + 1
      rollCallThresholds.absolute = Math.ceil(count * 2 / 3); rollCallThresholds.oneFifth = Math.ceil(count / 5)
    }
    sync()
  }
  function endRollCall() { isRollCallActive.value = false; screenMode.value = 'default'; sync() }

  function toggleGeneralTimer() {
    if (isGeneralTimerRunning.value) {
      generalInterval && clearInterval(generalInterval); isGeneralTimerRunning.value = false; sync()
    } else {
      if (generalSpeakerTimer.value <= 0) return
      isGeneralTimerRunning.value = true; sync()
      generalInterval = setInterval(() => {
        if (generalSpeakerTimer.value > 0) { generalSpeakerTimer.value--; sync() } else toggleGeneralTimer()
      }, 1000)
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
      generalInterval = setInterval(() => {
        if (generalSpeakerTimer.value > 0) { generalSpeakerTimer.value--; sync() }
        else { generalInterval && clearInterval(generalInterval); isGeneralTimerRunning.value = false; sync() }
      }, 1000)
    }
    sync()
  }
  function addToGeneralList(c) {
    if (!c || generalList.value.find(s => s.country === c)) return
    generalList.value.push({ country: c, time: generalTimeLimit.value })
    if (!stats[c]) stats[c] = { speeches: 0, motions: {} }
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
    const map = { '終止會議':1, '暫停會議':2, '自由磋商':3, '有主持核心磋商':4, '介紹決議草案':5, '介紹修正案':6, '結束辯論':7, 'P5閉門協商':4 }
    motionQueue.value.push({ id: Date.now(), type, country, details: details||{}, priority: map[type]||99 })
    if (!stats[country]) stats[country] = { speeches:0, motions:{} }
    if (!stats[country].motions[type]) stats[country].motions[type] = 0
    stats[country].motions[type]++; sync()
  }
  function approveMotion(i) {
    if (i<0||i>=motionQueue.value.length) return
    currentVotingMotion.value = motionQueue.value[i]; motionQueue.value = []; screenMode.value = 'motion_voting'; sync()
  }
  function rejectMotion(i) {
    if (i<0||i>=motionQueue.value.length) return
    motionQueue.value.splice(i,1); sync()
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
    if (isModCaucusRunning.value) {
      modCaucusInterval && clearInterval(modCaucusInterval); isModCaucusRunning.value=false; sync()
    } else {
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

  return {
    meetingPhase, screenMode, currentSection, rollCallStatus, isRollCallActive, rollCallFinished, rollCallThresholds,
    generalTimeLimit, generalList, currentGeneralSpeaker, generalSpeakerTimer, isGeneralTimerRunning,
    motionQueue, currentVotingMotion, stats, documents, delegates,
    p5Timer, caucusTotalTimer, modCaucusTopic, modCaucusTotalTimer, modCaucusSpeakerTimer, modCaucusDefaultSpeakTime, modCaucusList, currentModSpeaker, isModCaucusRunning,
    clearAllTimers, toggleGeneralTimer, nextGeneralSpeaker, yieldToDelegate, addToGeneralList,
    submitMotion, approveMotion, rejectMotion, executeMotion, toggleModCaucusTimer, nextModSpeaker, addToModCaucus,
    addDocument, suspendMeeting, resumeMeeting, setSection, startRollCall, markRollCall, endRollCall, sync
  }
})