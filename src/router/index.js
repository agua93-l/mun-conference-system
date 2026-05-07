import { createRouter, createWebHistory } from 'vue-router'
import ChairView from '../views/ChairView.vue'
import ScreenView from '../views/ScreenView.vue'
import LoginView from '../views/LoginView.vue'

const routes = [
  { path: '/', name: 'Chair', component: ChairView, meta: { requiresAuth: true } },
  { path: '/login', name: 'Login', component: LoginView },
  { path: '/screen', name: 'Screen', component: ScreenView }
]

const router = createRouter({ history: createWebHistory(), routes })

// 🔒 路由守衛
router.beforeEach(async (to, from) => {
  const { auth, authMethods } = window.firebase
  
  if (!auth.currentUser) {
    await new Promise(resolve => {
      const unsubscribe = authMethods.onAuthStateChanged(auth, () => {
        unsubscribe()
        resolve()
      })
    })
  }
  
  if (to.meta.requiresAuth && !auth.currentUser) return '/login'
  if (to.path === '/login' && auth.currentUser) return '/'
})

export default router