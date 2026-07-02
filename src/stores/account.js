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
  let unsubscribe = null
  let currentUid = null

  function loadMyConferences() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null }
    const user = window.firebase?.auth?.currentUser
    if (!user) { conferences.value = []; loading.value = false; return }
    currentUid = user.uid
    loading.value = true

    const attach = () => {
      if (currentUid !== user.uid) return
      if (!ensureFB()) { setTimeout(attach, 300); return }
      const idxRef = dbRefFn(window.firebase.db, 'users/' + user.uid + '/conferences')
      unsubscribe = onValueFn(idxRef, (snap) => {
        if (currentUid !== user.uid) return
        const val = snap.exists() ? snap.val() : {}
        conferences.value = Object.entries(val)
          .map(([id, meta]) => ({ id, title: meta?.title || '未命名會議', createdAt: meta?.createdAt || 0 }))
          .sort((a, b) => b.createdAt - a.createdAt)
        loading.value = false
      })
    }
    attach()
  }

  function stopWatching() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null }
    currentUid = null
    conferences.value = []
    loading.value = true
  }

  return { conferences, loading, loadMyConferences, stopWatching }
})
