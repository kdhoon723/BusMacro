<script setup>
import { computed, watch, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from './store/auth';
import { useReservationStore } from './store/reservations';

const router = useRouter();
const authStore = useAuthStore();

// 인증 상태 확인
const isAuthenticated = computed(() => authStore.isAuthenticated);
const isLoading = ref(false);

// 로그아웃 처리
const handleLogout = async () => {
  isLoading.value = true;
  try {
    await authStore.logout();
    router.push('/login');
  } catch (error) {
    console.error('로그아웃 실패:', error);
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="app-container">
    <!-- 로딩 오버레이 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
      <p>로딩 중...</p>
    </div>
    
    <!-- 네비게이션 바 (로그인 상태일 때만 표시) -->
    <nav v-if="isAuthenticated" class="main-nav">
      <div class="container">
        <div class="nav-brand">
          <h1>대진대 버스 매크로</h1>
        </div>
        
        <div class="nav-links">
          <router-link to="/dashboard" class="nav-link">
            대시보드
          </router-link>
          <router-link to="/settings" class="nav-link">
            예약 설정
          </router-link>
          <router-link to="/status" class="nav-link">
            예약 현황
          </router-link>
          <router-link to="/logs" class="nav-link">
            로그 확인
          </router-link>
          <button @click="handleLogout" class="btn-logout">
            로그아웃
          </button>
        </div>
      </div>
    </nav>
    
    <!-- 메인 콘텐츠 영역 -->
    <main class="main-content">
      <router-view></router-view>
    </main>
    
    <!-- 푸터 -->
    <footer class="main-footer">
      <div class="container">
        <p>&copy; 2023 대진대 버스 매크로. All rights reserved.</p>
      </div>
    </footer>
  </div>
</template>

<style>
/* 전역 스타일 */
:root {
  --primary-color: #3498db;
  --secondary-color: #2ecc71;
  --danger-color: #e74c3c;
  --dark-color: #2c3e50;
  --light-color: #ecf0f1;
  --bg-color: #f9f9f9;
  --text-color: #333;
  --shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

body {
  margin: 0;
  padding: 0;
  font-family: 'Noto Sans KR', sans-serif;
  background-color: var(--bg-color);
  color: var(--text-color);
}

.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* 레이아웃 스타일 */
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  padding: 20px 0;
}

/* 내비게이션 바 */
.main-nav {
  background-color: var(--dark-color);
  color: white;
  box-shadow: var(--shadow);
}

.main-nav .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
}

.nav-brand h1 {
  margin: 0;
  font-size: 1.5rem;
}

.nav-links {
  display: flex;
  gap: 20px;
  align-items: center;
}

.nav-link {
  color: white;
  text-decoration: none;
  padding: 5px 10px;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.nav-link:hover,
.router-link-active {
  background-color: rgba(255, 255, 255, 0.2);
}

.btn-logout {
  background-color: var(--danger-color);
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.3s;
}

.btn-logout:hover {
  background-color: #c0392b;
}

/* 푸터 스타일 */
.main-footer {
  background-color: var(--dark-color);
  color: white;
  padding: 20px 0;
  text-align: center;
}

/* 로딩 오버레이 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  color: white;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 반응형 설정 */
@media (max-width: 768px) {
  .main-nav .container {
    flex-direction: column;
  }
  
  .nav-links {
    margin-top: 10px;
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
