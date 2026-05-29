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

// 🔒 路由守衛
router.beforeEach(async (to, from) => {
  const waitForAuth = () => {
    return new Promise((resolve) => {
      if (window.auth && window.auth.currentUser) {
        resolve()
      } else if (window.auth) {
        window.auth.onAuthStateChanged(() => {
          resolve()
        })
      } else {
        setTimeout(waitForAuth, 100)
      }
    })
  }
  
  if (to.meta.requiresAuth) {
    await waitForAuth()
    if (!window.auth?.currentUser) return '/login'
  }
  if (to.path === '/login' && window.auth?.currentUser) return '/'
})

export default router