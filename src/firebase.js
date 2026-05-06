import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: "AIzaSyBv7OleZaWKZTJS_TFW2E3u4ln5Rs7nkWo",
  authDomain: "tymun-security-council.firebaseapp.com",
  databaseURL: "https://tymun-security-council-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tymun-security-council",
  storageBucket: "tymun-security-council.firebasestorage.app",
  messagingSenderId: "16719353168",
  appId: "1:16719353168:web:1bb9f60a97641b3babc855"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getDatabase(app)
