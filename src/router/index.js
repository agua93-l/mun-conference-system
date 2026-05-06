import { createRouter, createWebHistory } from 'vue-router'
import ChairView from '../views/ChairView.vue'
import ScreenView from '../views/ScreenView.vue'
import LoginView from '../views/LoginView.vue'
import { auth } from '../main'

const routes = [
  { path: '/', name: 'Chair', component: ChairView, meta: { requiresAuth: true } },
  { path: '/login', name: 'Login', component: LoginView },
  { path: '/screen', name: 'Screen', component: ScreenView }
]

const router = createRouter({ history: createWebHistory(), routes })

// 🔒 路由守衛：未登入跳轉登入頁，已登入跳轉控制台
router.beforeEach(async (to, from) => {
  if (!auth.currentUser && !auth._currentUserInitialized) {
    await new Promise(resolve => auth.onAuthStateChanged(resolve))
  }
  if (to.meta.requiresAuth && !auth.currentUser) return '/login'
  if (to.path === '/login' && auth.currentUser) return '/'
})

export default router