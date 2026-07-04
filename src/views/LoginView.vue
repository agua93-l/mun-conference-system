<template>
  <div class="login-container">
    <div class="login-card">
      <h1>🏛️ 主席控制台{{ mode === 'login' ? '登入' : '註冊' }}</h1>
      <p>建立帳號即可管理你自己的會議</p>
      <form @submit.prevent="handleSubmit" class="login-form">
        <input v-model="email" type="email" placeholder="主席 Email" required />
        <input v-model="password" type="password" placeholder="密碼（至少 6 碼）" required minlength="6" />
        <button class="btn btn-primary btn-block" type="submit" :disabled="loading">{{ loading ? '處理中...' : (mode === 'login' ? '登入' : '註冊並登入') }}</button>
        <p v-if="error" class="error">{{ error }}</p>
      </form>
      <div class="divider">
        <button class="mode-toggle" @click="toggleMode">{{ mode === 'login' ? '還沒有帳號？註冊一個' : '已經有帳號？登入' }}</button>
      </div>
      <p class="guest-hint">代表請直接向主席索取該場會議的投影畫面連結，不需要登入</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const mode = ref('login')

function toggleMode() { mode.value = mode.value === 'login' ? 'signup' : 'login'; error.value = '' }

async function handleSubmit() {
  loading.value = true
  error.value = ''
  try {
    const { auth, authMethods } = window.firebase
    if (mode.value === 'login') {
      await authMethods.signInWithEmailAndPassword(auth, email.value, password.value)
    } else {
      await authMethods.createUserWithEmailAndPassword(auth, email.value, password.value)
    }
    router.push(route.query.redirect || '/')
  } catch (err) {
    if (err.code === 'auth/invalid-credential') error.value = '帳號或密碼錯誤'
    else if (err.code === 'auth/email-already-in-use') error.value = '此 Email 已註冊過，請改用登入'
    else if (err.code === 'auth/weak-password') error.value = '密碼至少需要 6 碼'
    else error.value = mode.value === 'login' ? '登入失敗，請重試' : '註冊失敗，請重試'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
.login-card { background: var(--color-surface); border: 1px solid var(--color-border); padding: 40px; border-radius: var(--radius-lg); width: 100%; max-width: 400px; text-align: center; }
.login-card h1 { font-size: 1.5rem; margin-bottom: 8px; }
.login-card > p { color: var(--color-text-secondary); font-size: 0.9rem; }
.login-form { display: flex; flex-direction: column; gap: 12px; margin-top: 20px; }
.login-form input { padding: 11px 12px; }
.error { color: var(--color-danger); font-size: 0.85rem; margin: 0; }
.divider { margin: 16px 0; }
.mode-toggle { background: none; border: none; color: var(--color-accent); font-weight: 500; cursor: pointer; padding: 0; font-size: 0.9rem; }
.guest-hint { color: var(--color-text-muted); font-size: 0.8rem; margin: 20px 0 0 0; }
</style>