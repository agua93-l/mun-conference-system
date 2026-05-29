// src/main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// ✅ 等待 Firebase CDN 載入完成
const initApp = () => {
  if (!window.firebase) {
    setTimeout(initApp, 100)
    return
  }
  
  const { auth, authMethods } = window.firebase
  
  let initialAuthLoaded = false
  authMethods.onAuthStateChanged(auth, () => {
    if (!initialAuthLoaded) {
      initialAuthLoaded = true
      const pinia = createPinia()
      const vueApp = createApp(App)
      vueApp.use(pinia)
      vueApp.use(router)
      vueApp.mount('#app')
    }
  })
}

initApp()