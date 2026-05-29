<template>
  <div class="login-container">
    <div class="login-card">
      <h1>🏛️ 安理會主席登入</h1>
      <p>TYMUN 2026 Security Council</p>
      <form @submit.prevent="handleLogin" class="login-form">
        <input v-model="email" type="email" placeholder="主席 Email" required />
        <input v-model="password" type="password" placeholder="密碼" required />
        <button type="submit" :disabled="loading">{{ loading ? '登入中...' : '登入控制台' }}</button>
        <p v-if="error" class="error">{{ error }}</p>
      </form>
      <div class="divider">或</div>
      <router-link to="/screen" class="guest-link">以代表身份觀看投影畫面 →</router-link>
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

async function handleLogin() {
  loading.value = true
  error.value = ''
  try {
    // ✅ 使用 CDN 提供的 auth
    const { auth, authMethods } = window.firebase
    await authMethods.signInWithEmailAndPassword(auth, email.value, password.value)
    router.push('/')
  } catch (err) {
    error.value = err.code === 'auth/invalid-credential' ? '帳號或密碼錯誤' : '登入失敗，請重試'
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
.divider { margin: 20px 0; color: #aaa; }
.guest-link { color: #0055a5; text-decoration: none; font-weight: 500; }
</style>