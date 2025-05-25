<template>
  <div class="weekly-schedule">
    <!-- 헤더 섹션 -->
    <div class="header-section">
      <h1 class="page-title">📅 주간 버스 예약 관리</h1>
      <p class="page-description">
        월~금 버스를 요일별로 개별 설정할 수 있습니다. 
        <span class="highlight">전날 자동 예약</span>이 실행됩니다.
      </p>
    </div>

    <!-- 상태 카드 -->
    <div class="status-cards">
      <div class="status-card active">
        <div class="card-icon">🚌</div>
        <div class="card-content">
          <h3>활성 스케줄</h3>
          <p class="count">{{ weeklyStore.enabledDaysCount }}개</p>
        </div>
      </div>
      
      <div class="status-card next" v-if="weeklyStore.nextScheduledReservation">
        <div class="card-icon">⏰</div>
        <div class="card-content">
          <h3>다음 실행</h3>
          <p class="next-schedule">
            {{ weeklyStore.nextScheduledReservation.dayKorean }} 
            {{ weeklyStore.nextScheduledReservation.executionTime }}
          </p>
          <p class="remaining-time">
            {{ weeklyStore.nextScheduledReservation.remaining }}시간 후
          </p>
        </div>
      </div>

      <div class="status-card summary">
        <div class="card-icon">📊</div>
        <div class="card-content">
          <h3>실행 현황</h3>
          <div class="schedule-summary">
            <span class="time-group">21시: {{ weeklyStore.scheduleByTime['21:00'].length }}개</span>
            <span class="time-group">22시: {{ weeklyStore.scheduleByTime['22:00'].length }}개</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 에러 메시지 -->
    <div v-if="weeklyStore.error" class="error-message">
      <span class="error-icon">⚠️</span>
      {{ weeklyStore.error }}
      <button @click="weeklyStore.clearError()" class="error-close">×</button>
    </div>

    <!-- 주간 스케줄 설정 -->
    <div class="schedule-container">
      <div class="container-header">
        <h2>📋 요일별 예약 설정</h2>
        <div class="header-actions">
          <button 
            @click="loadData" 
            :disabled="weeklyStore.loading"
            class="btn btn-secondary"
          >
            🔄 새로고침
          </button>
          <button 
            @click="saveSchedule" 
            :disabled="weeklyStore.loading || !hasChanges"
            class="btn btn-primary"
          >
            💾 저장하기
          </button>
        </div>
      </div>

      <!-- 요일별 카드 그리드 -->
      <div class="days-grid">
        <DayScheduleCard
          v-for="(day, index) in dayList"
          :key="day.key"
          :day="day.key"
          :dayKorean="day.korean"
          :dayConfig="weeklyStore.weeklySchedule[day.key]"
          :routeOptions="routeOptions"
          :loading="weeklyStore.loading"
          @update="updateDayConfig"
          @toggle="toggleDay"
          @preview="showPreview"
        />
      </div>
    </div>

    <!-- 스케줄 요약 -->
    <div class="schedule-summary-section">
      <h3>📈 스케줄 요약</h3>
      
      <!-- 시간별 요약 -->
      <div class="summary-grid">
        <div class="summary-card time-21">
          <h4>🌆 21시 정각 실행 (일반 노선)</h4>
          <div v-if="weeklyStore.scheduleByTime['21:00'].length > 0" class="schedule-list">
            <div 
              v-for="schedule in weeklyStore.scheduleByTime['21:00']" 
              :key="`${schedule.day}_${schedule.direction}`"
              class="schedule-item"
            >
              <div class="schedule-basic">
                <span class="day">{{ schedule.dayKorean }}</span>
                <span class="route">{{ schedule.route }}</span>
                <span class="execution">{{ weeklyStore.getExecutionDayKorean(schedule.day) }} 저녁 실행</span>
              </div>
              <div class="schedule-details">
                <span class="detail-item direction">{{ schedule.direction === 'toSchool' ? '🏫' : '🏠' }} {{ schedule.directionKorean }}</span>
                <span v-if="schedule.busTime" class="detail-item">🕐 {{ schedule.busTime }}</span>
                <span v-if="schedule.stopName" class="detail-item">🚏 {{ schedule.stopName }}</span>
                <span v-if="schedule.seatNumbers?.length > 0" class="detail-item">💺 {{ schedule.seatNumbers.join(', ') }}번</span>
              </div>
            </div>
          </div>
          <p v-else class="no-schedule">설정된 일반 노선 스케줄이 없습니다</p>
        </div>

        <div class="summary-card time-22">
          <h4>🌆 22시 정각 실행 (노원 노선)</h4>
          <div v-if="weeklyStore.scheduleByTime['22:00'].length > 0" class="schedule-list">
            <div 
              v-for="schedule in weeklyStore.scheduleByTime['22:00']" 
              :key="`${schedule.day}_${schedule.direction}`"
              class="schedule-item"
            >
              <div class="schedule-basic">
                <span class="day">{{ schedule.dayKorean }}</span>
                <span class="route">{{ schedule.route }}</span>
                <span class="execution">{{ weeklyStore.getExecutionDayKorean(schedule.day) }} 저녁 실행</span>
              </div>
              <div class="schedule-details">
                <span class="detail-item direction">{{ schedule.direction === 'toSchool' ? '🏫' : '🏠' }} {{ schedule.directionKorean }}</span>
                <span v-if="schedule.busTime" class="detail-item">🕐 {{ schedule.busTime }}</span>
                <span v-if="schedule.stopName" class="detail-item">🚏 {{ schedule.stopName }}</span>
                <span v-if="schedule.seatNumbers?.length > 0" class="detail-item">💺 {{ schedule.seatNumbers.join(', ') }}번</span>
              </div>
            </div>
          </div>
          <p v-else class="no-schedule">설정된 노원 노선 스케줄이 없습니다</p>
        </div>
      </div>
    </div>

    <!-- 개발 모드 디버깅 정보 -->
    <div v-if="isDevelopment" class="debug-section">
      <h3>🔧 디버깅 정보</h3>
      <div class="debug-info">
        <div class="debug-item">
          <strong>인증 상태:</strong> 
          {{ authStore.isAuthenticated ? '로그인됨' : '로그인되지 않음' }}
        </div>
        <div class="debug-item">
          <strong>사용자 ID:</strong> 
          {{ authStore.userId || '없음' }}
        </div>
        <div class="debug-item">
          <strong>사용자 이메일:</strong> 
          {{ authStore.userEmail || '없음' }}
        </div>
        <div class="debug-item">
          <strong>Firestore 직접 연동:</strong> 
          {{ weeklyStore.useDirectFirestore ? '활성화' : '비활성화' }}
        </div>
        <div class="debug-item">
          <strong>마지막 업데이트:</strong> 
          {{ weeklyStore.lastUpdated ? new Date(weeklyStore.lastUpdated).toLocaleString() : '없음' }}
        </div>
        <div class="debug-item">
          <strong>노선 정보:</strong> 
          등교 {{ weeklyStore.routeScheduleInfo.up.length }}개, 
          하교 {{ weeklyStore.routeScheduleInfo.down.length }}개
        </div>
        <div class="debug-item">
          <strong>시간표 정보:</strong>
          등교 {{ Object.keys(weeklyStore.routeScheduleInfo.timetables.up).length }}개 노선,
          하교 {{ Object.keys(weeklyStore.routeScheduleInfo.timetables.down).length }}개 노선
        </div>
      </div>
    </div>

    <!-- 미리보기 모달 -->
    <PreviewModal
      v-if="showPreviewModal"
      :previewData="previewData"
      :loading="previewLoading"
      @close="closePreview"
      @refresh="refreshPreview"
    />

    <!-- 로딩 오버레이 -->
    <div v-if="weeklyStore.loading" class="loading-overlay">
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>처리 중...</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useWeeklyScheduleStore } from '../store/weeklySchedule'
import { useAuthStore } from '../store/auth'
import DayScheduleCard from '../components/DayScheduleCard.vue'
import PreviewModal from '../components/PreviewModal.vue'

// Stores
const weeklyStore = useWeeklyScheduleStore()
const authStore = useAuthStore()

// Reactive data
const hasChanges = ref(false)
const showPreviewModal = ref(false)
const previewData = ref(null)
const previewLoading = ref(false)
const selectedPreviewDay = ref(null)

// 개발 모드 감지
const isDevelopment = computed(() => import.meta.env.DEV)

// 요일 목록
const dayList = [
  { key: 'monday', korean: '월요일' },
  { key: 'tuesday', korean: '화요일' },
  { key: 'wednesday', korean: '수요일' },
  { key: 'thursday', korean: '목요일' },
  { key: 'friday', korean: '금요일' }
]

// 노선 옵션 (computed)
const routeOptions = computed(() => {
  const routes = []
  
  // 등교 노선 추가
  if (weeklyStore.routeScheduleInfo.up && weeklyStore.routeScheduleInfo.up.length > 0) {
    weeklyStore.routeScheduleInfo.up.forEach(route => {
      routes.push({
        value: route.lineName,
        label: `[등교] ${route.lineName} (${route.description})`,
        isSpecial: route.isSpecialRoute,
        executionTime: route.executionTime,
        direction: 'up'
      })
    })
  }
  
  // 하교 노선 추가
  if (weeklyStore.routeScheduleInfo.down && weeklyStore.routeScheduleInfo.down.length > 0) {
    weeklyStore.routeScheduleInfo.down.forEach(route => {
      routes.push({
        value: route.lineName,
        label: `[하교] ${route.lineName} (${route.description})`,
        isSpecial: route.isSpecialRoute,
        executionTime: route.executionTime,
        direction: 'down'
      })
    })
  }

  return routes
})

// 변경사항 감지
watch(
  () => weeklyStore.weeklySchedule,
  () => {
    hasChanges.value = true
  },
  { deep: true }
)

// Methods
async function loadData() {
  if (!authStore.userId) {
    weeklyStore.error = '로그인이 필요합니다'
    return
  }

  await Promise.all([
    weeklyStore.loadWeeklySchedule(authStore.userId),
    weeklyStore.loadRouteScheduleInfo(authStore.userId)
  ])
  
  hasChanges.value = false
}

async function saveSchedule() {
  if (!authStore.userId) {
    weeklyStore.error = '로그인이 필요합니다'
    return
  }

  const success = await weeklyStore.saveWeeklySchedule(authStore.userId)
  if (success) {
    hasChanges.value = false
    // 성공 피드백
    showSuccessMessage('주간 스케줄이 저장되었습니다!')
  }
}

function updateDayConfig(dayOfWeek, direction, config) {
  weeklyStore.updateDayConfig(dayOfWeek, direction, config)
  hasChanges.value = true
}

function toggleDay(dayOfWeek, direction) {
  weeklyStore.toggleDayEnabled(dayOfWeek, direction)
  hasChanges.value = true
}

async function showPreview(dayOfWeek, direction) {
  if (!authStore.userId) {
    weeklyStore.error = '로그인이 필요합니다'
    return
  }

  selectedPreviewDay.value = `${dayOfWeek}_${direction}`
  showPreviewModal.value = true
  previewLoading.value = true
  
  try {
    previewData.value = await weeklyStore.previewReservation(
      authStore.userId, 
      dayOfWeek,
      direction
    )
  } finally {
    previewLoading.value = false
  }
}

function closePreview() {
  showPreviewModal.value = false
  previewData.value = null
  selectedPreviewDay.value = null
}

async function refreshPreview() {
  if (!selectedPreviewDay.value || !authStore.userId) return
  
  const [dayOfWeek, direction] = selectedPreviewDay.value.split('_')
  
  previewLoading.value = true
  try {
    previewData.value = await weeklyStore.previewReservation(
      authStore.userId,
      dayOfWeek,
      direction,
      true // force refresh
    )
  } finally {
    previewLoading.value = false
  }
}

function showSuccessMessage(message) {
  // Toast 메시지 또는 성공 알림 구현
  console.log('Success:', message)
}

// Lifecycle
onMounted(() => {
  // 인증 상태가 로딩 중이면 대기
  if (authStore.loading) {
    const unwatch = watch(
      () => authStore.loading,
      (newLoading) => {
        if (!newLoading) {
          unwatch()
          loadData()
        }
      }
    )
  } else {
    loadData()
  }
})
</script>

<style scoped>
.weekly-schedule {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
}

/* 헤더 섹션 */
.header-section {
  text-align: center;
  margin-bottom: 30px;
}

.page-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 10px;
}

.page-description {
  font-size: 1.1rem;
  color: #4a5568;
  line-height: 1.6;
}

.highlight {
  color: #3182ce;
  font-weight: 600;
}

/* 상태 카드 */
.status-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.status-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 15px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.status-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.status-card.active {
  border-left: 4px solid #38a169;
}

.status-card.next {
  border-left: 4px solid #3182ce;
}

.status-card.summary {
  border-left: 4px solid #805ad5;
}

.card-icon {
  font-size: 2rem;
}

.card-content h3 {
  font-size: 0.9rem;
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 5px;
}

.count {
  font-size: 1.8rem;
  font-weight: 700;
  color: #1a202c;
}

.next-schedule {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1a202c;
  margin-bottom: 2px;
}

.remaining-time {
  font-size: 0.85rem;
  color: #718096;
}

.schedule-summary {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.time-group {
  font-size: 0.9rem;
  color: #4a5568;
}

/* 에러 메시지 */
.error-message {
  background: #fed7d7;
  border: 1px solid #fc8181;
  color: #c53030;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.error-close {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  margin-left: auto;
  color: #c53030;
}

/* 스케줄 컨테이너 */
.schedule-container {
  background: white;
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 30px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
}

.container-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
  padding-bottom: 15px;
  border-bottom: 1px solid #e2e8f0;
}

.container-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a202c;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.btn {
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3182ce;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2c5aa0;
}

.btn-secondary {
  background: #e2e8f0;
  color: #4a5568;
}

.btn-secondary:hover:not(:disabled) {
  background: #cbd5e0;
}

/* 요일 그리드 */
.days-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
}

/* 스케줄 요약 섹션 */
.schedule-summary-section {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
}

.schedule-summary-section h3 {
  font-size: 1.3rem;
  font-weight: 600;
  color: #1a202c;
  margin-bottom: 20px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 25px;
}

.summary-card {
  border-radius: 10px;
  padding: 20px;
  border: 1px solid #e2e8f0;
}

.summary-card.time-21 {
  background: linear-gradient(135deg, #e6fffa 0%, #bee3f8 100%);
}

.summary-card.time-22 {
  background: linear-gradient(135deg, #e6fffa 0%, #bee3f8 100%);
}

.summary-card h4 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 15px;
  color: #2d3748;
}

.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.schedule-item {
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  border-left: 3px solid #3182ce;
}

.schedule-basic {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.schedule-basic .day {
  font-weight: 600;
  color: #3182ce;
  font-size: 0.9rem;
}

.schedule-basic .route {
  color: #2d3748;
  flex-grow: 1;
  text-align: center;
  font-weight: 500;
}

.schedule-basic .execution {
  font-size: 0.8rem;
  color: #718096;
}

.schedule-details {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.detail-item {
  background: #f7fafc;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #4a5568;
  border: 1px solid #e2e8f0;
}

.detail-item.direction {
  background: #e6fffa;
  color: #1a365d;
  border-color: #81e6d9;
  font-weight: 600;
}

.no-schedule {
  color: #a0aec0;
  font-style: italic;
  text-align: center;
  padding: 20px;
}

/* 로딩 오버레이 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-spinner {
  background: white;
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e2e8f0;
  border-top: 4px solid #3182ce;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .weekly-schedule {
    padding: 15px;
  }
  
  .page-title {
    font-size: 2rem;
  }
  
  .status-cards {
    grid-template-columns: 1fr;
  }
  
  .container-header {
    flex-direction: column;
    gap: 15px;
    align-items: stretch;
  }
  
  .header-actions {
    justify-content: stretch;
  }
  
  .btn {
    flex: 1;
    justify-content: center;
  }
  
  .days-grid {
    grid-template-columns: 1fr;
  }
  
  .summary-grid {
    grid-template-columns: 1fr;
  }
}

/* 개발 모드 디버깅 정보 */
.debug-section {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  margin-top: 30px;
}

.debug-section h3 {
  font-size: 1.3rem;
  font-weight: 600;
  color: #1a202c;
  margin-bottom: 20px;
}

.debug-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.debug-item {
  font-size: 0.9rem;
  color: #4a5568;
}

.debug-item strong {
  font-weight: 600;
}

/* 전역 색상 대비 개선 */
.weekly-schedule select,
.weekly-schedule input {
  background-color: white !important;
  color: #2d3748 !important;
  border: 1px solid #cbd5e0 !important;
}

.weekly-schedule select option {
  background-color: white !important;
  color: #2d3748 !important;
}

.weekly-schedule select option:checked,
.weekly-schedule select option:selected {
  background-color: #3182ce !important;
  color: white !important;
}

.weekly-schedule select option.special-route {
  background-color: #c6f6d5 !important;
  color: #22543d !important;
  font-weight: bold !important;
}
</style> 