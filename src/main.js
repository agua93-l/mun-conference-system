// src/main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// ✅ 等待 Firebase CDN 完全載入
const initApp = () => {
  if (!window.firebase) {
    console.log('⏳ 等待 Firebase CDN...')
    setTimeout(initApp, 100)
    return
  }
  
  console.log('✅ Firebase 已載入，初始化 Vue...')
  
  const { auth, authMethods } = window.firebase
  
  let initialAuthLoaded = false
  authMethods.onAuthStateChanged(auth, (user) => {
    if (!initialAuthLoaded) {
      initialAuthLoaded = true
      console.log('✅ Auth 狀態已載入，用戶:', user?.email || '未登入')
      
      const pinia = createPinia()
      const vueApp = createApp(App)
      vueApp.use(pinia)
      vueApp.use(router)
      vueApp.mount('#app')
      
      console.log('✅ Vue 應用已掛載')
    }
  })
}

// 啟動應用
initApp()