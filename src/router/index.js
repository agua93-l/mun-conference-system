// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import ChairView from '../views/ChairView.vue'
import ScreenView from '../views/ScreenView.vue'
import LoginView from '../views/LoginView.vue'
import StatsView from '../views/StatsView.vue'

const routes = [
  { path: '/', name: 'Chair', component: ChairView, meta: { requiresAuth: true } },
  { path: '/login', name: 'Login', component: LoginView },
  { path: '/screen', name: 'Screen', component: ScreenView },
  { path: '/stats', name: 'Stats', component: StatsView, meta: { requiresAuth: true } }
]

const router = createRouter({ history: createWebHistory(), routes })

// 🔒 路由守衛：使用 window.auth
router.beforeEach(async (to, from) => {
  const waitForAuth = () => {
    return new Promise((resolve) => {
      if (window.auth && window.auth.currentUser) {
        console.log('✅ 已登入用戶:', window.auth.currentUser.email)
        resolve()
      } else if (window.auth) {
        console.log('⏳ 等待 Auth 狀態...')
        window.auth.onAuthStateChanged(() => {
          resolve()
        })
      } else {
        console.log('⏳ 等待 window.auth...')
        setTimeout(waitForAuth, 100)
      }
    })
  }
  
  if (to.meta.requiresAuth) {
    await waitForAuth()
    if (!window.auth?.currentUser) {
      console.log('❌ 未登入，跳轉至登入頁')
      return '/login'
    }
  }
  if (to.path === '/login' && window.auth?.currentUser) {
    console.log('✅ 已登入，跳轉至首頁')
    return '/'
  }
})

export default router