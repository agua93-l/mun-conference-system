// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import ChairView from '../views/ChairView.vue'
import ScreenView from '../views/ScreenView.vue'
import LoginView from '../views/LoginView.vue'
import StatsView from '../views/StatsView.vue'
import { auth } from '../firebase'

const routes = [
  { path: '/', name: 'Chair', component: ChairView, meta: { requiresAuth: true } },
  { path: '/login', name: 'Login', component: LoginView },
  { path: '/screen', name: 'Screen', component: ScreenView },
  { path: '/stats', name: 'Stats', component: StatsView, meta: { requiresAuth: true } }
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to, from) => {
  if (!auth.currentUser && !auth._currentUserInitialized) {
    await new Promise(resolve => auth.onAuthStateChanged(resolve))
  }
  if (to.meta.requiresAuth && !auth.currentUser) return '/login'
  if (to.path === '/login' && auth.currentUser) return '/'
})

export default router