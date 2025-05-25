<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-container">
      <!-- 모달 헤더 -->
      <div class="modal-header">
        <h2 class="modal-title">🔍 예약 미리보기</h2>
        <button @click="$emit('close')" class="close-button">×</button>
      </div>

      <!-- 모달 내용 -->
      <div class="modal-content">
        <!-- 로딩 상태 -->
        <div v-if="loading" class="preview-loading">
          <div class="loading-spinner"></div>
          <p>예약 정보를 확인하고 있습니다...</p>
        </div>

        <!-- 미리보기 데이터 -->
        <div v-else-if="previewData" class="preview-content">
          <!-- 기본 정보 -->
          <div class="preview-section">
            <h3 class="section-title">📋 예약 정보</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">버스 요일</span>
                <span class="info-value">{{ getDayNameKorean(previewData.dayOfWeek) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">실행일</span>
                <span class="info-value">{{ getExecutionDayKorean(previewData.dayOfWeek) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">실행 시간</span>
                <span class="info-value execution-time">{{ previewData.executionTime }}</span>
              </div>
            </div>
          </div>

          <!-- 노선 정보 -->
          <div class="preview-section">
            <h3 class="section-title">🚌 노선 정보</h3>
            <div class="route-card">
              <div class="route-header">
                <span class="route-name">{{ previewData.route }}</span>
                <span class="route-badge" :class="getRouteBadgeClass(previewData.route)">
                  {{ getRouteTypeText(previewData.route) }}
                </span>
              </div>
              <div class="route-details">
                <div class="detail-item">
                  <span class="detail-icon">🕘</span>
                  <span>{{ previewData.time }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-icon">📍</span>
                  <span>{{ previewData.routeInfo?.stopList?.[0]?.stopName || '기본 정류장' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 좌석 정보 -->
          <div class="preview-section">
            <h3 class="section-title">💺 좌석 설정</h3>
            <div class="seats-info">
              <div v-if="previewData.seats && previewData.seats.length > 0" class="preferred-seats">
                <h4>선호 좌석:</h4>
                <div class="seats-list">
                  <span 
                    v-for="seat in previewData.seats" 
                    :key="seat"
                    class="seat-tag"
                  >
                    {{ seat }}
                  </span>
                </div>
                <p class="seats-note">
                  선호 좌석이 사용 가능할 경우 우선적으로 선택됩니다.
                </p>
              </div>
              <div v-else class="auto-seat">
                <h4>자동 좌석 선택:</h4>
                <p class="auto-seat-description">
                  🤖 시스템이 자동으로 최적의 좌석을 선택합니다<br>
                  (앞쪽 > 뒤쪽, 창가 > 복도 순서로 우선 선택)
                </p>
              </div>
            </div>
          </div>

          <!-- 실행 상태 -->
          <div class="preview-section">
            <h3 class="section-title">⚡ 실행 상태</h3>
            <div class="status-card" :class="getStatusClass()">
              <div class="status-icon">{{ getStatusIcon() }}</div>
              <div class="status-content">
                <h4 class="status-title">{{ getStatusTitle() }}</h4>
                <p class="status-description">{{ getStatusDescription() }}</p>
              </div>
            </div>
          </div>

          <!-- 주의사항 -->
          <div class="preview-section warning-section">
            <h3 class="section-title">⚠️ 주의사항</h3>
            <ul class="warning-list">
              <li>실제 예약은 설정된 시간에 자동으로 실행됩니다</li>
              <li>예약 성공 여부는 서버 상황과 좌석 가용성에 따라 달라질 수 있습니다</li>
              <li>{{ getRouteTypeText(previewData.route) }}은 {{ previewData.executionTime }}에 정확히 실행됩니다</li>
              <li>예약 결과는 대시보드에서 확인할 수 있습니다</li>
            </ul>
          </div>
        </div>

        <!-- 에러 상태 -->
        <div v-else class="preview-error">
          <div class="error-icon">❌</div>
          <h3>미리보기를 불러올 수 없습니다</h3>
          <p>예약 설정을 확인하고 다시 시도해주세요.</p>
        </div>
      </div>

      <!-- 모달 푸터 -->
      <div class="modal-footer">
        <button @click="$emit('refresh')" :disabled="loading" class="btn btn-secondary">
          🔄 새로고침
        </button>
        <button @click="$emit('close')" class="btn btn-primary">
          확인
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  previewData: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'refresh'])

// Methods
function getDayNameKorean(dayOfWeek) {
  const dayNames = {
    monday: '월요일',
    tuesday: '화요일',
    wednesday: '수요일',
    thursday: '목요일',
    friday: '금요일'
  }
  return dayNames[dayOfWeek] || dayOfWeek
}

function getExecutionDayKorean(dayOfWeek) {
  const executionDays = {
    monday: '일요일',
    tuesday: '월요일',
    wednesday: '화요일',
    thursday: '수요일',
    friday: '목요일'
  }
  return executionDays[dayOfWeek] || dayOfWeek
}

function getRouteTypeText(routeName) {
  return routeName?.includes('노원') ? '노원 노선' : '일반 노선'
}

function getRouteBadgeClass(routeName) {
  return routeName?.includes('노원') ? 'special-route' : 'normal-route'
}

function getStatusClass() {
  if (!props.previewData) return 'status-error'
  return props.previewData.busAvailable ? 'status-ready' : 'status-warning'
}

function getStatusIcon() {
  if (!props.previewData) return '❌'
  return props.previewData.busAvailable ? '✅' : '⚠️'
}

function getStatusTitle() {
  if (!props.previewData) return '설정 오류'
  return props.previewData.busAvailable ? '예약 준비 완료' : '주의 필요'
}

function getStatusDescription() {
  if (!props.previewData) return '예약 설정에 문제가 있습니다'
  return props.previewData.busAvailable 
    ? '모든 설정이 정상이며 예약 실행 준비가 완료되었습니다'
    : '선택한 시간의 버스를 찾을 수 없습니다. 설정을 확인해주세요'
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-container {
  background: white;
  border-radius: 16px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
}

/* 모달 헤더 */
.modal-header {
  padding: 24px 28px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
}

.modal-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: #1a202c;
  margin: 0;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.8rem;
  color: #718096;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-button:hover {
  background: #e2e8f0;
  color: #4a5568;
}

/* 모달 내용 */
.modal-content {
  padding: 0;
  max-height: 60vh;
  overflow-y: auto;
}

/* 로딩 상태 */
.preview-loading {
  padding: 60px 40px;
  text-align: center;
  color: #4a5568;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e2e8f0;
  border-top: 3px solid #3182ce;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 미리보기 내용 */
.preview-content {
  padding: 8px 0;
}

.preview-section {
  padding: 20px 28px;
  border-bottom: 1px solid #f1f5f9;
}

.preview-section:last-child {
  border-bottom: none;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 정보 그리드 */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: #718096;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 1rem;
  font-weight: 600;
  color: #1a202c;
}

.execution-time {
  color: #3182ce;
  font-size: 1.1rem;
}

/* 노선 카드 */
.route-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
}

.route-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.route-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1a202c;
}

.route-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.route-badge.normal-route {
  background: #bee3f8;
  color: #1a365d;
}

.route-badge.special-route {
  background: #c6f6d5;
  color: #22543d;
}

.route-details {
  display: flex;
  gap: 16px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  color: #4a5568;
}

.detail-icon {
  font-size: 1rem;
}

/* 좌석 정보 */
.seats-info h4 {
  font-size: 0.95rem;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 10px;
}

.seats-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.seat-tag {
  background: #3182ce;
  color: white;
  padding: 4px 10px;
  border-radius: 16px;
  font-size: 0.8rem;
  font-weight: 500;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
}

.seats-note,
.auto-seat-description {
  font-size: 0.85rem;
  color: #718096;
  line-height: 1.5;
  margin: 0;
}

.auto-seat-description {
  margin-top: 4px;
}

/* 상태 카드 */
.status-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid;
}

.status-card.status-ready {
  background: #f0fff4;
  border-color: #9ae6b4;
}

.status-card.status-warning {
  background: #fffbeb;
  border-color: #fbd38d;
}

.status-card.status-error {
  background: #fed7d7;
  border-color: #fc8181;
}

.status-icon {
  font-size: 1.5rem;
}

.status-content h4 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 4px;
}

.status-content p {
  font-size: 0.9rem;
  color: #4a5568;
  margin: 0;
  line-height: 1.4;
}

/* 주의사항 */
.warning-section {
  background: #f8fafc;
}

.warning-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.warning-list li {
  padding: 8px 0;
  font-size: 0.9rem;
  color: #4a5568;
  line-height: 1.5;
  position: relative;
  padding-left: 20px;
}

.warning-list li:before {
  content: '•';
  color: #e53e3e;
  font-weight: bold;
  position: absolute;
  left: 0;
}

/* 에러 상태 */
.preview-error {
  padding: 60px 40px;
  text-align: center;
  color: #4a5568;
}

.error-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.preview-error h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: #1a202c;
  margin-bottom: 8px;
}

.preview-error p {
  font-size: 0.9rem;
  color: #718096;
  margin: 0;
}

/* 모달 푸터 */
.modal-footer {
  padding: 20px 28px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
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

/* 반응형 */
@media (max-width: 640px) {
  .modal-overlay {
    padding: 10px;
  }
  
  .modal-header,
  .modal-footer {
    padding: 16px 20px;
  }
  
  .preview-section {
    padding: 16px 20px;
  }
  
  .modal-title {
    font-size: 1.2rem;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .route-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .route-details {
    flex-direction: column;
    gap: 8px;
  }
  
  .modal-footer {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
    justify-content: center;
  }
}
</style> 