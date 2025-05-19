<!-- 로그인 페이지 -->
<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="login-title">대진대학교 버스 예약 매크로</h1>
      <p class="login-subtitle">로그인하여 자동 예약 설정을 관리하세요</p>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <!-- 알림 메시지 -->
        <div v-if="error" class="alert alert-error">
          {{ error }}
        </div>
        
        <!-- 학번 입력 -->
        <div class="form-group">
          <label for="studentId">학번</label>
          <input 
            type="text" 
            id="studentId" 
            v-model="studentId" 
            placeholder="학번을 입력하세요"
            required
            class="form-input"
          />
        </div>
        
        <!-- 비밀번호 입력 -->
        <div class="form-group">
          <label for="password">비밀번호</label>
          <input 
            type="password" 
            id="password" 
            v-model="password" 
            placeholder="비밀번호를 입력하세요"
            required
            class="form-input"
          />
        </div>
        
        <!-- 로그인 버튼 -->
        <button 
          type="submit" 
          class="btn-login" 
          :disabled="loading"
        >
          {{ loading ? '로그인 중...' : '로그인' }}
        </button>
      </form>
      
      <div class="login-info">
        <p>🔔 알림: 일, 월, 화요일 21시에 자동으로 예약을 진행합니다.</p>
        <p>📱 카카오톡 알림으로 예약 결과를 알려드립니다.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../store/auth';

// 스토어와 라우터 설정
const authStore = useAuthStore();
const router = useRouter();

// 상태 관리
const studentId = ref('');
const password = ref('');
const loading = computed(() => authStore.loading);
const error = computed(() => authStore.error);

// 로그인 핸들러
const handleLogin = async () => {
  if (!studentId.value || !password.value) {
    return;
  }
  
  // 학번에 가상 도메인을 추가하여 이메일 형식으로 변환
  const emailFormat = `${studentId.value}@daejin.student.com`;
  
  // 비밀번호에 솔트 추가 (Firebase 요구사항: 최소 6자리)
  const passwordWithSalt = `dj${password.value}bus`;
  
  // 이메일 형식과 비밀번호로 로그인
  const success = await authStore.login(emailFormat, passwordWithSalt);
  
  if (success) {
    router.push('/dashboard');
  }
};
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
  background-color: var(--light-color);
  font-family: 'Noto Sans KR', sans-serif;
}

.login-card {
  background: white;
  border-radius: 8px;
  box-shadow: var(--shadow);
  padding: 30px;
  width: 100%;
  max-width: 450px;
}

.login-title {
  color: var(--primary-color);
  margin: 0 0 10px 0;
  font-size: 1.8rem;
  text-align: center;
  font-weight: 700;
}

.login-subtitle {
  color: var(--dark-color);
  margin: 0 0 30px 0;
  text-align: center;
  font-size: 1rem;
}

.login-form {
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: var(--dark-color);
}

.form-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  box-sizing: border-box;
  transition: border-color 0.3s, box-shadow 0.3s;
  font-family: 'Noto Sans KR', sans-serif;
}

.form-input:focus {
  border-color: var(--primary-color);
  outline: none;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.form-input::placeholder {
  color: #aaa;
  font-family: 'Noto Sans KR', sans-serif;
}

.btn-login {
  width: 100%;
  padding: 14px;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.3s;
  font-family: 'Noto Sans KR', sans-serif;
}

.btn-login:hover {
  background-color: #2980b9;
}

.btn-login:disabled {
  background-color: #95a5a6;
  cursor: not-allowed;
}

.alert {
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
  font-weight: 500;
}

.alert-error {
  background-color: rgba(231, 76, 60, 0.1);
  color: var(--danger-color);
  border: 1px solid var(--danger-color);
}

.login-info {
  background-color: rgba(52, 152, 219, 0.1);
  border-radius: 4px;
  padding: 15px;
  margin-top: 20px;
}

.login-info p {
  margin: 8px 0;
  font-size: 0.95rem;
  color: var(--dark-color);
}
</style> 