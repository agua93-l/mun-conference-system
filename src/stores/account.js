// src/stores/account.js
import { defineStore } from 'pinia'
import { ref } from 'vue'

let fbReady = false
let dbRefFn, onValueFn

const ensureFB = () => {
  if (fbReady) return true
  const fb = window.firebase
  if (!fb || !fb.db || !fb.dbMethods) return false
  dbRefFn = fb.dbMethods.ref
  onValueFn = fb.dbMethods.onValue
  fbReady = true
  return true
}

export const useAccountStore = defineStore('account', () => {
  const conferences = ref([])
  const loading = ref(true)
  let indexUnsubscribe = null
  let titleUnsubscribes = {} // conferenceId -> unsubscribe fn
  let membershipMap = {} // conferenceId -> { role, createdAt, title }
  let titleMap = {} // conferenceId -> live title
  let currentUid = null

  function rebuildList() {
    conferences.value = Object.entries(membershipMap)
      .map(([id, m]) => ({ id, role: m?.role || 'owner', createdAt: m?.createdAt || 0, title: titleMap[id] || m?.title || '未命名會議' }))
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  function loadMyConferences() {
    if (indexUnsubscribe) { indexUnsubscribe(); indexUnsubscribe = null }
    Object.values(titleUnsubscribes).forEach(fn => fn())
    titleUnsubscribes = {}
    membershipMap = {}
    titleMap = {}

    const user = window.firebase?.auth?.currentUser
    if (!user) { conferences.value = []; loading.value = false; return }
    currentUid = user.uid
    loading.value = true

    const attach = () => {
      if (currentUid !== user.uid) return
      if (!ensureFB()) { setTimeout(attach, 300); return }
      const idxRef = dbRefFn(window.firebase.db, 'users/' + user.uid + '/conferences')
      indexUnsubscribe = onValueFn(idxRef, (snap) => {
        if (currentUid !== user.uid) return
        const val = snap.exists() ? snap.val() : {}
        membershipMap = val
        const currentIds = Object.keys(val)

        // 會議標題不快取死在索引裡，改為對每一場會議即時訂閱 meta/title，
        // 避免其他共同編輯者改了標題後，自己的清單卻沒跟著更新。
        Object.keys(titleUnsubscribes).forEach(id => {
          if (!currentIds.includes(id)) { titleUnsubscribes[id](); delete titleUnsubscribes[id]; delete titleMap[id] }
        })
        currentIds.forEach(id => {
          if (!titleUnsubscribes[id]) {
            const titleRef = dbRefFn(window.firebase.db, 'conferences/' + id + '/meta/title')
            titleUnsubscribes[id] = onValueFn(titleRef, (tsnap) => {
              titleMap[id] = tsnap.exists() ? tsnap.val() : ''
              rebuildList()
            })
          }
        })

        rebuildList()
        loading.value = false
      })
    }
    attach()
  }

  function stopWatching() {
    if (indexUnsubscribe) { indexUnsubscribe(); indexUnsubscribe = null }
    Object.values(titleUnsubscribes).forEach(fn => fn())
    titleUnsubscribes = {}
    membershipMap = {}
    titleMap = {}
    currentUid = null
    conferences.value = []
    loading.value = true
  }

  return { conferences, loading, loadMyConferences, stopWatching }
})
