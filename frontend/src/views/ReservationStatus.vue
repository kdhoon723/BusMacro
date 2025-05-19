<!-- 예약 현황 페이지 -->
<template>
  <div class="status-container container">
    <h1 class="status-title">예약 현황</h1>
    
    <!-- 알림 메시지 -->
    <div v-if="message.text" :class="['alert', `alert-${message.type}`]">
      {{ message.text }}
    </div>
    
    <!-- 필터 섹션 -->
    <div class="filter-section">
      <div class="filter-card">
        <h2>로그 필터</h2>
        <div class="filter-form">
          <div class="form-group">
            <label for="date-range">기간</label>
            <select id="date-range" v-model="filter.dateRange">
              <option value="7">최근 7일</option>
              <option value="14">최근 14일</option>
              <option value="30">최근 30일</option>
              <option value="all">전체 기간</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="status-filter">상태</label>
            <select id="status-filter" v-model="filter.status">
              <option value="all">모든 상태</option>
              <option value="success">성공</option>
              <option value="error">실패</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="day-filter">요일</label>
            <select id="day-filter" v-model="filter.dayOfWeek">
              <option value="all">모든 요일</option>
              <option value="sunday">일요일</option>
              <option value="monday">월요일</option>
              <option value="tuesday">화요일</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="type-filter">유형</label>
            <select id="type-filter" v-model="filter.type">
              <option value="all">모든 유형</option>
              <option value="toSchool">등교</option>
              <option value="fromSchool">하교</option>
            </select>
          </div>
          
          <button @click="applyFilter" class="btn-apply">필터 적용</button>
        </div>
      </div>
    </div>
    
    <!-- 로그 테이블 -->
    <div class="log-section">
      <div class="log-card">
        <h2>예약 로그</h2>
        
        <div v-if="loading" class="loading-indicator">
          <div class="spinner"></div>
          <p>로딩 중...</p>
        </div>
        
        <div v-else-if="filteredLogs.length === 0" class="empty-logs">
          <p>예약 로그가 없습니다.</p>
        </div>
        
        <div v-else class="log-table-wrapper">
          <table class="log-table">
            <thead>
              <tr>
                <th>날짜</th>
                <th>요일</th>
                <th>유형</th>
                <th>상태</th>
                <th>노선</th>
                <th>시간</th>
                <th>정류장</th>
                <th>좌석</th>
                <th>메시지</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(log, index) in filteredLogs" :key="index" :class="{ 'error-row': log.status === 'error' }">
                <td>{{ formatDate(log.timestamp) }}</td>
                <td>{{ getDayLabel(log.dayOfWeek) }}</td>
                <td>{{ getTypeLabel(log.type) }}</td>
                <td>
                  <span class="status-badge" :class="log.status">
                    {{ log.status === 'success' ? '성공' : '실패' }}
                  </span>
                </td>
                <td>{{ log.details?.route || '-' }}</td>
                <td>{{ log.details?.time || '-' }}</td>
                <td>{{ log.details?.station || '-' }}</td>
                <td>{{ log.details?.seatNumber || '-' }}</td>
                <td class="log-message">{{ log.message }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- 페이지네이션 -->
        <div v-if="totalPages > 1" class="pagination">
          <button 
            @click="currentPage = 1" 
            class="page-btn first" 
            :disabled="currentPage === 1"
          >
            &laquo;
          </button>
          
          <button 
            @click="currentPage--" 
            class="page-btn prev" 
            :disabled="currentPage === 1"
          >
            &lt;
          </button>
          
          <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
          
          <button 
            @click="currentPage++" 
            class="page-btn next" 
            :disabled="currentPage === totalPages"
          >
            &gt;
          </button>
          
          <button 
            @click="currentPage = totalPages" 
            class="page-btn last" 
            :disabled="currentPage === totalPages"
          >
            &raquo;
          </button>
        </div>
      </div>
    </div>
    
    <!-- 예약 통계 섹션 -->
    <div class="statistics-section">
      <div class="stat-card-group">
        <div class="stat-card">
          <h3>성공률</h3>
          <div class="stat-value">{{ successRate }}%</div>
          <div class="stat-progress">
            <div class="progress-bar" :style="{ width: `${successRate}%` }"></div>
          </div>
        </div>
        
        <div class="stat-card">
          <h3>총 예약 횟수</h3>
          <div class="stat-value">{{ totalLogs }}</div>
          <div class="stat-detail">
            <div class="detail-item">
              <span class="label">성공:</span>
              <span class="value success">{{ successCount }}</span>
            </div>
            <div class="detail-item">
              <span class="label">실패:</span>
              <span class="value error">{{ errorCount }}</span>
            </div>
          </div>
        </div>
        
        <div class="stat-card">
          <h3>요일별 예약</h3>
          <div class="day-stats">
            <div v-for="day in dayStats" :key="day.dayOfWeek" class="day-stat-item">
              <span class="day">{{ getDayLabel(day.dayOfWeek) }}</span>
              <span class="count">{{ day.count }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useReservationStore } from '../store/reservations';

// 스토어 설정
const reservationStore = useReservationStore();

// 상태 관리
const loading = computed(() => reservationStore.loading);
const logs = ref([]);
const currentPage = ref(1);
const itemsPerPage = 10;

// 필터 상태
const filter = reactive({
  dateRange: '7',
  status: 'all',
  dayOfWeek: 'all',
  type: 'all'
});

// 메시지 상태
const message = reactive({
  text: '',
  type: 'info'
});

// 날짜 포맷팅 함수
const formatDate = (dateString) => {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

// 요일 레이블 변환
const getDayLabel = (dayOfWeek) => {
  const dayMap = {
    'sunday': '일',
    'monday': '월',
    'tuesday': '화'
  };
  
  return dayMap[dayOfWeek] || '-';
};

// 유형 레이블 변환
const getTypeLabel = (type) => {
  const typeMap = {
    'toSchool': '등교',
    'fromSchool': '하교',
    'error': '오류'
  };
  
  return typeMap[type] || '-';
};

// 필터링된 로그
const filteredLogs = computed(() => {
  let result = [...logs.value];
  
  // 상태 필터
  if (filter.status !== 'all') {
    result = result.filter(log => log.status === filter.status);
  }
  
  // 요일 필터
  if (filter.dayOfWeek !== 'all') {
    result = result.filter(log => log.dayOfWeek === filter.dayOfWeek);
  }
  
  // 유형 필터
  if (filter.type !== 'all') {
    result = result.filter(log => log.type === filter.type);
  }
  
  // 페이지네이션
  const startIndex = (currentPage.value - 1) * itemsPerPage;
  return result.slice(startIndex, startIndex + itemsPerPage);
});

// 총 페이지 수
const totalPages = computed(() => {
  const filteredLogsCount = logs.value.filter(log => {
    if (filter.status !== 'all' && log.status !== filter.status) return false;
    if (filter.dayOfWeek !== 'all' && log.dayOfWeek !== filter.dayOfWeek) return false;
    if (filter.type !== 'all' && log.type !== filter.type) return false;
    return true;
  }).length;
  
  return Math.ceil(filteredLogsCount / itemsPerPage) || 1;
});

// 성공 및 실패 개수
const successCount = computed(() => {
  return logs.value.filter(log => log.status === 'success').length;
});

const errorCount = computed(() => {
  return logs.value.filter(log => log.status === 'error').length;
});

// 총 로그 개수
const totalLogs = computed(() => {
  return logs.value.length;
});

// 성공률
const successRate = computed(() => {
  if (totalLogs.value === 0) return 0;
  return Math.round((successCount.value / totalLogs.value) * 100);
});

// 요일별 통계
const dayStats = computed(() => {
  const stats = [
    { dayOfWeek: 'sunday', count: 0 },
    { dayOfWeek: 'monday', count: 0 },
    { dayOfWeek: 'tuesday', count: 0 }
  ];
  
  logs.value.forEach(log => {
    const dayStat = stats.find(s => s.dayOfWeek === log.dayOfWeek);
    if (dayStat) {
      dayStat.count++;
    }
  });
  
  return stats;
});

// 필터 적용
const applyFilter = async () => {
  // 로딩 상태 설정
  message.text = '로그를 불러오는 중입니다...';
  message.type = 'info';
  
  try {
    // 기간 필터 적용
    const daysToFilter = filter.dateRange === 'all' ? 365 : parseInt(filter.dateRange);
    
    // 로그 데이터 다시 로드
    await loadLogs(daysToFilter);
    
    // 필터 적용 후 첫 페이지로 이동
    currentPage.value = 1;
    
    message.text = '';
  } catch (error) {
    message.text = '로그 데이터를 불러오는 데 실패했습니다.';
    message.type = 'error';
  }
};

// 로그 데이터 로드
const loadLogs = async (days = 7) => {
  try {
    // 기본적으로 모든 로그 데이터를 로드
    await reservationStore.loadLogs();
    
    // 스토어에서 로그 데이터를 가져와 날짜 필터링
    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(now.getDate() - days);
    
    logs.value = reservationStore.logs
      .filter(log => new Date(log.timestamp) >= cutoffDate)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return logs.value;
  } catch (error) {
    console.error('로그 로드 오류:', error);
    throw error;
  }
};

// 컴포넌트 마운트 시 데이터 로드
onMounted(async () => {
  try {
    // 기본값으로 최근 7일 로그 로드
    await loadLogs(7);
  } catch (error) {
    message.text = '로그 데이터를 불러오는 데 실패했습니다.';
    message.type = 'error';
  }
});
</script>

<style scoped>
.status-container {
  padding: 20px;
}

.status-title {
  color: var(--dark-color);
  margin-bottom: 30px;
  font-size: 2rem;
}

/* 카드 스타일 */
.filter-card, .log-card, .stat-card {
  background-color: white;
  border-radius: 8px;
  box-shadow: var(--shadow);
  padding: 20px;
  margin-bottom: 30px;
}

.filter-card h2, .log-card h2, .stat-card h3 {
  color: var(--dark-color);
  margin-top: 0;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

/* 필터 섹션 */
.filter-form {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
  align-items: end;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: var(--dark-color);
}

.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background-color: white;
}

.form-group select:focus {
  border-color: var(--primary-color);
  outline: none;
}

.btn-apply {
  padding: 10px 15px;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.3s;
}

.btn-apply:hover {
  background-color: #2980b9;
}

/* 로그 테이블 */
.log-table-wrapper {
  overflow-x: auto;
}

.log-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.log-table th,
.log-table td {
  padding: 12px 15px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.log-table th {
  background-color: #f9f9f9;
  font-weight: bold;
  position: sticky;
  top: 0;
}

.log-table tbody tr:hover {
  background-color: #f5f5f5;
}

.error-row {
  background-color: rgba(231, 76, 60, 0.05);
}

.status-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.status-badge.success {
  background-color: var(--secondary-color);
  color: white;
}

.status-badge.error {
  background-color: var(--danger-color);
  color: white;
}

.log-message {
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 페이지네이션 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 20px;
}

.page-btn {
  background-color: #f1f1f1;
  border: none;
  padding: 8px 12px;
  margin: 0 5px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.page-btn:hover:not(:disabled) {
  background-color: #e0e0e0;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  margin: 0 10px;
  font-size: 14px;
}

/* 통계 섹션 */
.stat-card-group {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.stat-card {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: bold;
  color: var(--primary-color);
  margin-bottom: 10px;
}

.stat-progress {
  height: 8px;
  background-color: #f1f1f1;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 10px;
}

.progress-bar {
  height: 100%;
  background-color: var(--secondary-color);
  border-radius: 4px;
}

.stat-detail {
  margin-top: 15px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.detail-item .label {
  font-weight: bold;
}

.detail-item .value.success {
  color: var(--secondary-color);
}

.detail-item .value.error {
  color: var(--danger-color);
}

.day-stats {
  display: flex;
  flex-direction: column;
}

.day-stat-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.day-stat-item:last-child {
  border-bottom: none;
}

.day-stat-item .day {
  font-weight: bold;
}

.day-stat-item .count {
  background-color: var(--primary-color);
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

/* 로딩 표시자 */
.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-left-color: var(--primary-color);
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-logs {
  text-align: center;
  padding: 40px 0;
  color: #666;
}

/* 알림 메시지 */
.alert {
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.alert-success {
  background-color: rgba(46, 204, 113, 0.1);
  color: var(--secondary-color);
  border: 1px solid var(--secondary-color);
}

.alert-error {
  background-color: rgba(231, 76, 60, 0.1);
  color: var(--danger-color);
  border: 1px solid var(--danger-color);
}

.alert-info {
  background-color: rgba(52, 152, 219, 0.1);
  color: var(--primary-color);
  border: 1px solid var(--primary-color);
}

/* 반응형 설정 */
@media (max-width: 768px) {
  .filter-form {
    grid-template-columns: 1fr;
  }
  
  .stat-card-group {
    grid-template-columns: 1fr;
  }
  
  .log-table {
    font-size: 12px;
  }
  
  .log-table th,
  .log-table td {
    padding: 8px;
  }
}
</style> 