import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

let _dbRef = null, _set = null, _onValue = null, _stateRef = null
let _isListening = false
let _syncTimer = null

// 安全获取 Firebase 对象
const ensureFB = () => {
  if (_dbRef) return true
  const fb = window.firebase
  if (!fb || !fb.db || !fb.dbMethods) return false
  _dbRef = fb.dbMethods.ref
  _set = fb.dbMethods.set
  _onValue = fb.dbMethods.onValue
  _stateRef = _dbRef(fb.db, 'mun_state')
  return true
}

// 启动监听
const startListen = () => {
  if (_isListening || !ensureFB()) return
  _isListening = true
  if (_syncTimer) clearInterval(_syncTimer)
  
  _onValue(_stateRef, (snap) => {
    if (!snap.exists()) return
    const d = snap.val()
    meetingPhase.value = d.meetingPhase ?? '正式辩论'
    screenMode.value = d.screenMode ?? 'default'
    currentSection.value = d.currentSection ?? '议程 1'
    Object.assign(rollCallStatus, d.rollCallStatus || {})
    isRollCallActive.value = !!d.isRollCallActive
    rollCallFinished.value = !!d.rollCallFinished
    Object.assign(rollCallThresholds, d.rollCallThresholds || {})
    generalTimeLimit.value = d.generalTimeLimit ?? 60
    generalList.value = d.generalList || []
    currentGeneralSpeaker.value = d.currentGeneralSpeaker || ''
    generalSpeakerTimer.value = d.generalSpeakerTimer ?? 0
    isGeneralTimerRunning.value = !!d.isGeneralTimerRunning
    motionQueue.value = d.motionQueue || []
    currentVotingMotion.value = d.currentVotingMotion || null
    Object.assign(stats, d.stats || {})
    documents.value = d.documents || []
    p5Timer.value = d.p5Timer ?? 0
    caucusTotalTimer.value = d.caucusTotalTimer ?? 0
    modCaucusTopic.value = d.modCaucusTopic || ''
    modCaucusTotalTimer.value = d.modCaucusTotalTimer ?? 0
    modCaucusSpeakerTimer.value = d.modCaucusSpeakerTimer ?? 0
    modCaucusDefaultSpeakTime.value = d.modCaucusDefaultSpeakTime ?? 0
    modCaucusList.value = d.modCaucusList || []
    currentModSpeaker.value = d.currentModSpeaker || ''
    isModCaucusRunning.value = !!d.isModCaucusRunning
  })
}

// 核心修复：每秒检查 CDN 是否加载完成，完成后立刻绑定监听
_syncTimer = setInterval(() => {
  if (ensureFB()) startListen()
}, 100)

export const useConferenceStore = defineStore('conference', () => {
  const meetingPhase = ref('正式辩论')
  const screenMode = ref('default')
  const currentSection = ref('议程 1')
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
    { name: '中国', type: 'member', p5: true }, { name: '美国', type: 'member', p5: true },
    { name: '英国', type: 'member', p5: true }, { name: '俄罗斯', type: 'member', p5: true },
    { name: '法国', type: 'member', p5: true }, { name: '巴林', type: 'member', p5: false },
    { name: '哥伦比亚', type: 'member', p5: false }, { name: '刚果民主共和国', type: 'member', p5: false },
    { name: '丹麦', type: 'member', p5: false }, { name: '希腊', type: 'member', p5: false },
    { name: '拉脱维亚', type: 'member', p5: false }, { name: '利比里亚', type: 'member', p5: false },
    { name: '巴基斯坦', type: 'member', p5: false }, { name: '巴拿马', type: 'member', p5: false },
    { name: '索马里', type: 'member', p5: false },
    { name: 'ICoCA', type: 'observer', p5: false }, { name: '红十字会', type: 'observer', p5: false },
    { name: '联合国人权高专办', type: 'observer', p5: false }, { name: '中非共和国', type: 'observer', p5: false }
  ]

  function sync() {
    if (!ensureFB() || !_set || !_stateRef) return
    _set(_stateRef, {
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
    if (!delegates.some(d => d.name === country && d.type === 'member')) return alert('⚠️ 仅理事国可动议')
    if (type === 'P5闭门协商' && !delegates.find(d => d.name === country)?.p5) return alert('⚠️ 仅P5可提闭门')
    if (type === '有主持核心磋商') {
      const t = (details.totalTime || 10) * 60, s = details.speakTime || 60
      if (t % s !== 0) return alert('⚠️ 发言时长须整除总时长')
    }
    const map = { '终止会议':1, '暂停会议':2, '自由磋商':3, '有主持核心磋商':4, '介绍决议草案':5, '介绍修正案':6, '结束辩论':7, 'P5闭门协商':4 }
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
    if (m.type==='自由磋商'||m.type==='全体咨询') {
      screenMode.value='caucus'; meetingPhase.value=m.type; caucusTotalTimer.value=(m.details.duration||10)*60; sync()
      caucusInterval=setInterval(()=>{ if(caucusInterval&&caucusTotalTimer.value>0){caucusTotalTimer.value--;sync()} else{clearInterval(caucusInterval);screenMode.value='default';meetingPhase.value='正式辩论';sync()} },1000)
    } else if (m.type==='有主持核心磋商') {
      modCaucusTopic.value=m.details.topic||'未指定'; modCaucusTotalTimer.value=(m.details.totalTime||10)*60
      modCaucusDefaultSpeakTime.value=m.details.speakTime||60; modCaucusSpeakerTimer.value=0; currentModSpeaker.value=''
      screenMode.value='mod_caucus'; meetingPhase.value='有主持核心磋商'; sync()
    } else if (m.type==='暂停会议') { screenMode.value='suspended'; meetingPhase.value='会议暂停'; sync() }
    else if (m.type==='恢复会议') { screenMode.value='default'; meetingPhase.value='正式辩论'; sync() }
    else if (m.type==='P5闭门协商') {
      screenMode.value='p5_closed'; meetingPhase.value='P5闭门协商'; p5Timer.value=600; sync()
      p5Interval=setInterval(()=>{ if(p5Interval&&p5Timer.value>0){p5Timer.value--;sync()} else{clearInterval(p5Interval);screenMode.value='default';meetingPhase.value='正式辩论';sync()} },1000)
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
        if (end) { clearInterval(modCaucusInterval); isModCaucusRunning.value=false; screenMode.value='default'; meetingPhase.value='正式辩论'; sync() }
      },1000)
    }
  }
  function addDocument(type, num, title) { if(!type||!num||!title) return; documents.value.push({type,number:num,title}); sync() }
  function suspendMeeting() { clearAllTimers(); screenMode.value='suspended'; meetingPhase.value='会议暂停'; sync() }
  function resumeMeeting() { screenMode.value='default'; meetingPhase.value='正式辩论'; sync() }

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