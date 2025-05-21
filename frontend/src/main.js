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

// 인증 상태 초기화 및 앱 마운트
const authStore = useAuthStore()
authStore.initAuth().then(() => {
  // 인증 초기화 후 앱 마운트
  app.mount('#app')
  console.log('인증 상태:', authStore.isAuthenticated ? '로그인됨' : '로그인되지 않음')
}).catch(error => {
  console.error('인증 초기화 오류:', error)
  // 오류 발생해도 앱 마운트
  app.mount('#app')
})
