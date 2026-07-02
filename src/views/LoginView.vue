<template>
  <div class="login-container">
    <div class="login-card">
      <h1>🏛️ 主席控制台{{ mode === 'login' ? '登入' : '註冊' }}</h1>
      <p>建立帳號即可管理你自己的會議</p>
      <form @submit.prevent="handleSubmit" class="login-form">
        <input v-model="email" type="email" placeholder="主席 Email" required />
        <input v-model="password" type="password" placeholder="密碼（至少 6 碼）" required minlength="6" />
        <button type="submit" :disabled="loading">{{ loading ? '處理中...' : (mode === 'login' ? '登入' : '註冊並登入') }}</button>
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
import { useRouter } from 'vue-router'

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
    router.push('/')
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
.login-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f4f6f9; }
.login-card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 100%; max-width: 400px; text-align: center; }
.login-card h1 { margin: 0 0 10px 0; font-size: 1.8rem; color: #333; }
.login-form { display: flex; flex-direction: column; gap: 15px; margin-top: 20px; }
input { padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; }
button { padding: 12px; background: #0055a5; color: white; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; font-weight: bold; }
button:disabled { opacity: 0.6; cursor: not-allowed; }
.error { color: #d32f2f; font-size: 0.9rem; margin: 0; }
.divider { margin: 15px 0; color: #aaa; }
.mode-toggle { background: none; border: none; color: #0055a5; font-weight: 500; cursor: pointer; padding: 0; font-size: 0.95rem; }
.guest-hint { color: #999; font-size: 0.85rem; margin: 20px 0 0 0; }
</style>