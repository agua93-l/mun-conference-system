// src/main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

// ✅ 等待 Firebase CDN 完全載入
const initApp = () => {
  if (!window.firebase || !window.auth) {
    console.log('⏳ 等待 Firebase CDN...')
    setTimeout(initApp, 100)
    return
  }
  
  console.log('✅ Firebase 已載入，初始化 Vue...')
  console.log('Auth 狀態:', window.auth)
  
  const { auth, authMethods } = window.firebase
  
  let initialAuthLoaded = false
  authMethods.onAuthStateChanged(auth, (user) => {
    console.log('🔔 Auth 狀態變更:', user?.email || '未登入')
    
    if (!initialAuthLoaded) {
      initialAuthLoaded = true
      console.log('✅ Auth 狀態已載入，掛載 Vue...')
      
      const pinia = createPinia()
      const vueApp = createApp(App)
      vueApp.use(pinia)
      vueApp.use(router)
      vueApp.mount('#app')
      
      console.log('✅ Vue 應用已掛載到 #app')
    }
  })
}

// 啟動應用
initApp()