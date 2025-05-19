<!-- 대시보드 페이지 -->
<template>
  <div class="dashboard-container container">
    <h1 class="dashboard-title">대시보드</h1>
    
    <!-- 다음 예약 카운트다운 -->
    <div class="card next-reservation">
      <h2>다음 예약</h2>
      <div class="reservation-time">
        <div class="icon">🕘</div>
        <div class="details">
          <p class="day">{{ nextReservation.day }}요일</p>
          <p class="time">21:00:00</p>
          <p class="date">{{ formatDate(nextReservation.date) }}</p>
        </div>
      </div>
      <div class="countdown">
        <div class="countdown-box">
          <span class="number">{{ countdown.days }}</span>
          <span class="label">일</span>
        </div>
        <div class="countdown-box">
          <span class="number">{{ countdown.hours }}</span>
          <span class="label">시간</span>
        </div>
        <div class="countdown-box">
          <span class="number">{{ countdown.minutes }}</span>
          <span class="label">분</span>
        </div>
        <div class="countdown-box">
          <span class="number">{{ countdown.seconds }}</span>
          <span class="label">초</span>
        </div>
      </div>
    </div>
    
    <!-- 예약 상태 요약 -->
    <div class="reservation-summary card-group">
      <div class="card">
        <h2>일요일 예약</h2>
        <div class="summary-content">
          <div class="reservation-row">
            <span class="label">등교</span>
            <span class="value" :class="{ 'enabled': sunday.toSchool.enabled, 'disabled': !sunday.toSchool.enabled }">
              {{ sunday.toSchool.enabled ? '활성화' : '비활성화' }}
            </span>
          </div>
          <div class="reservation-row">
            <span class="label">하교</span>
            <span class="value" :class="{ 'enabled': sunday.fromSchool.enabled, 'disabled': !sunday.fromSchool.enabled }">
              {{ sunday.fromSchool.enabled ? '활성화' : '비활성화' }}
            </span>
          </div>
          <router-link to="/settings?day=sunday" class="btn-link">설정 변경</router-link>
        </div>
      </div>
      
      <div class="card">
        <h2>월요일 예약</h2>
        <div class="summary-content">
          <div class="reservation-row">
            <span class="label">등교</span>
            <span class="value" :class="{ 'enabled': monday.toSchool.enabled, 'disabled': !monday.toSchool.enabled }">
              {{ monday.toSchool.enabled ? '활성화' : '비활성화' }}
            </span>
          </div>
          <div class="reservation-row">
            <span class="label">하교</span>
            <span class="value" :class="{ 'enabled': monday.fromSchool.enabled, 'disabled': !monday.fromSchool.enabled }">
              {{ monday.fromSchool.enabled ? '활성화' : '비활성화' }}
            </span>
          </div>
          <router-link to="/settings?day=monday" class="btn-link">설정 변경</router-link>
        </div>
      </div>
      
      <div class="card">
        <h2>화요일 예약</h2>
        <div class="summary-content">
          <div class="reservation-row">
            <span class="label">등교</span>
            <span class="value" :class="{ 'enabled': tuesday.toSchool.enabled, 'disabled': !tuesday.toSchool.enabled }">
              {{ tuesday.toSchool.enabled ? '활성화' : '비활성화' }}
            </span>
          </div>
          <div class="reservation-row">
            <span class="label">하교</span>
            <span class="value" :class="{ 'enabled': tuesday.fromSchool.enabled, 'disabled': !tuesday.fromSchool.enabled }">
              {{ tuesday.fromSchool.enabled ? '활성화' : '비활성화' }}
            </span>
          </div>
          <router-link to="/settings?day=tuesday" class="btn-link">설정 변경</router-link>
        </div>
      </div>
    </div>
    
    <!-- 최근 로그 -->
    <div class="card recent-logs">
      <h2>최근 예약 로그</h2>
      <div v-if="logs.length === 0" class="no-logs">
        아직 로그 데이터가 없습니다.
      </div>
      <div v-else class="log-list">
        <div v-for="(log, index) in logs" :key="index" class="log-item">
          <div class="log-date">{{ formatDate(log.timestamp) }}</div>
          <div class="log-content">
            <span class="log-status" :class="log.status">{{ log.status === 'success' ? '성공' : '실패' }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
      </div>
      <router-link to="/status" class="btn-link">전체 로그 보기</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useReservationStore } from '../store/reservations';

// 스토어 설정
const reservationStore = useReservationStore();

// 상태 관리
const countdownInterval = ref(null);
const countdown = ref({ days: 0, hours: 0, minutes: 0, seconds: 0 });

// 다음 예약 정보
const nextReservation = computed(() => {
  return reservationStore.getNextReservation;
});

// 요일별 예약 설정
const sunday = computed(() => reservationStore.getScheduleForDay('sunday'));
const monday = computed(() => reservationStore.getScheduleForDay('monday'));
const tuesday = computed(() => reservationStore.getScheduleForDay('tuesday'));

// 최근 로그
const logs = computed(() => reservationStore.getRecentLogs);

// 날짜 포맷팅 함수
const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

// 카운트다운 업데이트 함수
const updateCountdown = () => {
  if (!nextReservation.value || !nextReservation.value.timestamp) {
    return;
  }
  
  const now = new Date().getTime();
  const distance = nextReservation.value.timestamp - now;
  
  if (distance < 0) {
    // 이미 지났으면 다시 계산
    reservationStore.calculateNextReservation();
    return;
  }
  
  // 날짜 계산
  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);
  
  countdown.value = { days, hours, minutes, seconds };
};

// 컴포넌트 마운트 시 데이터 로드
onMounted(async () => {
  // 예약 설정 로드
  await reservationStore.loadSchedules();
  
  // 로그 데이터 로드
  await reservationStore.loadLogs();
  
  // 다음 예약 계산
  reservationStore.calculateNextReservation();
  
  // 카운트다운 시작
  updateCountdown();
  countdownInterval.value = setInterval(updateCountdown, 1000);
});

// 컴포넌트 언마운트 시 인터벌 정리
onMounted(() => {
  return () => {
    if (countdownInterval.value) {
      clearInterval(countdownInterval.value);
    }
  };
});
</script>

<style scoped>
.dashboard-container {
  padding: 20px;
}

.dashboard-title {
  color: var(--dark-color);
  margin-bottom: 30px;
  font-size: 2rem;
}

.card {
  background-color: white;
  border-radius: 8px;
  box-shadow: var(--shadow);
  padding: 20px;
  margin-bottom: 30px;
}

.card h2 {
  color: var(--dark-color);
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 1.5rem;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

/* 다음 예약 스타일 */
.next-reservation {
  background-color: var(--primary-color);
  color: white;
}

.next-reservation h2 {
  color: white;
  border-bottom-color: rgba(255, 255, 255, 0.2);
}

.reservation-time {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.reservation-time .icon {
  font-size: 3rem;
  margin-right: 20px;
}

.reservation-time .details {
  flex: 1;
}

.reservation-time .day {
  font-size: 1.8rem;
  font-weight: bold;
  margin: 0;
}

.reservation-time .time {
  font-size: 1.4rem;
  margin: 5px 0;
}

.reservation-time .date {
  font-size: 1rem;
  opacity: 0.8;
  margin: 0;
}

.countdown {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
}

.countdown-box {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 10px;
  width: 22%;
  text-align: center;
}

.countdown-box .number {
  display: block;
  font-size: 2rem;
  font-weight: bold;
}

.countdown-box .label {
  display: block;
  font-size: 0.8rem;
  opacity: 0.8;
}

/* 카드 그룹 */
.card-group {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

/* 예약 요약 */
.summary-content {
  margin-top: 15px;
}

.reservation-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.reservation-row .label {
  font-weight: bold;
}

.reservation-row .value {
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: bold;
}

.value.enabled {
  background-color: var(--secondary-color);
  color: white;
}

.value.disabled {
  background-color: #ddd;
  color: #666;
}

/* 로그 스타일 */
.log-list {
  max-height: 300px;
  overflow-y: auto;
}

.log-item {
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}

.log-date {
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 5px;
}

.log-content {
  display: flex;
  align-items: center;
}

.log-status {
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: bold;
  margin-right: 10px;
}

.log-status.success {
  background-color: var(--secondary-color);
  color: white;
}

.log-status.error {
  background-color: var(--danger-color);
  color: white;
}

.log-message {
  flex: 1;
}

.no-logs {
  padding: 20px;
  text-align: center;
  color: #666;
}

/* 버튼 링크 */
.btn-link {
  display: inline-block;
  margin-top: 20px;
  padding: 8px 16px;
  background-color: var(--primary-color);
  color: white;
  text-decoration: none;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.btn-link:hover {
  background-color: #2980b9;
}

/* 반응형 */
@media (max-width: 768px) {
  .card-group {
    grid-template-columns: 1fr;
  }
  
  .countdown-box .number {
    font-size: 1.5rem;
  }
}
</style> 