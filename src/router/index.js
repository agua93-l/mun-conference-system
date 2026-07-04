import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import ChairView from '../views/ChairView.vue'
import ConferenceSettingsView from '../views/ConferenceSettingsView.vue'
import ScreenView from '../views/ScreenView.vue'
import LoginView from '../views/LoginView.vue'
import StatsView from '../views/StatsView.vue'
import JoinView from '../views/JoinView.vue'
import DocsView from '../views/DocsView.vue'

const routes = [
  { path: '/', name: 'Dashboard', component: DashboardView, meta: { requiresAuth: true } },
  { path: '/login', name: 'Login', component: LoginView },
  { path: '/chair/:id', name: 'Chair', component: ChairView, meta: { requiresAuth: true } },
  { path: '/chair/:id/settings', name: 'ChairSettings', component: ConferenceSettingsView, meta: { requiresAuth: true } },
  { path: '/screen/:id', name: 'Screen', component: ScreenView },
  { path: '/docs/:id', name: 'Docs', component: DocsView },
  { path: '/stats/:id', name: 'Stats', component: StatsView, meta: { requiresAuth: true } },
  { path: '/join/:id', name: 'Join', component: JoinView, meta: { requiresAuth: true } }
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to, from) => {
  const waitForAuth = () => new Promise(resolve => {
    if (window.auth?.currentUser) resolve()
    else if (window.auth) window.auth.onAuthStateChanged(resolve)
    else setTimeout(waitForAuth, 100)
  })

  if (to.meta.requiresAuth) {
    await waitForAuth()
    if (!window.auth?.currentUser) return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (to.path === '/login' && window.auth?.currentUser) return '/'
})

export default router
