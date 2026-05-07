import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// 等待 Firebase 初始化完成
setTimeout(() => {
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
}, 100)