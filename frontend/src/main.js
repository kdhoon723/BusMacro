import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'
import './firebase'
import { useAuthStore } from './store/auth'

// 애플리케이션 생성
const app = createApp(App)

// Pinia 스토어 설정
const pinia = createPinia()
app.use(pinia)

// 라우터 설정
app.use(router)

// 앱 마운트
app.mount('#app')

// 인증 상태 초기화
const authStore = useAuthStore()
authStore.initAuth()
