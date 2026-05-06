import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue' 
import router from './router'
import { auth } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'

let initialAuthLoaded = false
onAuthStateChanged(auth, () => {
  if (!initialAuthLoaded) {
    initialAuthLoaded = true
    const pinia = createPinia()
    const vueApp = createApp(App)
    vueApp.use(pinia)
    vueApp.use(router)
    vueApp.mount('#app')
  }
})