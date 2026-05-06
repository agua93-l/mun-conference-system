import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged } from 'firebase/auth'

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBv7OleZaWKZTJS_TFW2E3u4ln5Rs7nkWo",
  authDomain: "tymun-security-council.firebaseapp.com",
  databaseURL: "https://tymun-security-council-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tymun-security-council",
  storageBucket: "tymun-security-council.firebasestorage.app",
  messagingSenderId: "16719353168",
  appId: "1:16719353168:web:1bb9f60a97641b3babc855"
};

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// 等待 Firebase Auth 初始化完成後再掛載路由
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