<!-- 예약 설정 페이지 -->
<template>
  <div class="settings-container container">
    <h1 class="settings-title">예약 설정</h1>
    
    <!-- 설정 탭 -->
    <div class="settings-tabs">
      <button 
        v-for="day in days" 
        :key="day.value" 
        @click="activeDay = day.value" 
        class="tab-button" 
        :class="{ active: activeDay === day.value }"
      >
        {{ day.label }}요일
      </button>
    </div>
    
    <!-- 알림 메시지 -->
    <div v-if="message.text" :class="['alert', `alert-${message.type}`]">
      {{ message.text }}
    </div>
    
    <!-- 예약 설정 카드 -->
    <div class="settings-card">
      <form @submit.prevent="saveSettings">
        <!-- 등교 설정 -->
        <div class="settings-section">
          <h2>등교 버스 예약 설정</h2>
          
          <div class="switch-container">
            <label class="switch">
              <input type="checkbox" v-model="currentSettings.toSchool.enabled">
              <span class="slider"></span>
            </label>
            <span class="switch-label">{{ currentSettings.toSchool.enabled ? '활성화' : '비활성화' }}</span>
          </div>
          
          <div class="form-group" :class="{ disabled: !currentSettings.toSchool.enabled }">
            <label for="to-route">노선</label>
            <select 
              id="to-route" 
              v-model="currentSettings.toSchool.route" 
              :disabled="!currentSettings.toSchool.enabled"
            >
              <option value="" disabled>노선을 선택하세요</option>
              <option v-for="route in toSchoolRoutes" :key="route.id" :value="route.name">
                {{ route.name }}
              </option>
            </select>
          </div>
          
          <div class="form-group" :class="{ disabled: !currentSettings.toSchool.enabled }">
            <label for="to-time">시간</label>
            <select 
              id="to-time" 
              v-model="currentSettings.toSchool.time" 
              :disabled="!currentSettings.toSchool.enabled"
            >
              <option value="" disabled>시간을 선택하세요</option>
              <option v-for="time in toSchoolTimes" :key="time" :value="time">{{ time }}</option>
            </select>
          </div>
          
          <div class="form-group" :class="{ disabled: !currentSettings.toSchool.enabled }">
            <label for="to-station">정류장</label>
            <select 
              id="to-station" 
              v-model="currentSettings.toSchool.station" 
              :disabled="!currentSettings.toSchool.enabled"
            >
              <option value="" disabled>정류장을 선택하세요</option>
              <option v-for="station in toSchoolStations" :key="station" :value="station">{{ station }}</option>
            </select>
          </div>
          
          <div class="form-group" :class="{ disabled: !currentSettings.toSchool.enabled }">
            <label for="to-seat">선호 좌석번호</label>
            <input 
              type="number" 
              id="to-seat" 
              v-model.number="currentSettings.toSchool.seatNumber" 
              min="1" 
              max="45" 
              :disabled="!currentSettings.toSchool.enabled"
            >
            <p class="form-hint">※ 선호 좌석을 사용할 수 없는 경우 자동으로 다른 좌석을 선택합니다.</p>
          </div>
        </div>
        
        <!-- 하교 설정 -->
        <div class="settings-section">
          <h2>하교 버스 예약 설정</h2>
          
          <div class="switch-container">
            <label class="switch">
              <input type="checkbox" v-model="currentSettings.fromSchool.enabled">
              <span class="slider"></span>
            </label>
            <span class="switch-label">{{ currentSettings.fromSchool.enabled ? '활성화' : '비활성화' }}</span>
          </div>
          
          <div class="form-group" :class="{ disabled: !currentSettings.fromSchool.enabled }">
            <label for="from-route">노선</label>
            <select 
              id="from-route" 
              v-model="currentSettings.fromSchool.route" 
              :disabled="!currentSettings.fromSchool.enabled"
            >
              <option value="" disabled>노선을 선택하세요</option>
              <option v-for="route in fromSchoolRoutes" :key="route.id" :value="route.name">
                {{ route.name }}
              </option>
            </select>
          </div>
          
          <div class="form-group" :class="{ disabled: !currentSettings.fromSchool.enabled }">
            <label for="from-time">시간</label>
            <select 
              id="from-time" 
              v-model="currentSettings.fromSchool.time" 
              :disabled="!currentSettings.fromSchool.enabled"
            >
              <option value="" disabled>시간을 선택하세요</option>
              <option v-for="time in fromSchoolTimes" :key="time" :value="time">{{ time }}</option>
            </select>
          </div>
          
          <div class="form-group" :class="{ disabled: !currentSettings.fromSchool.enabled }">
            <label for="from-station">정류장</label>
            <select 
              id="from-station" 
              v-model="currentSettings.fromSchool.station" 
              :disabled="!currentSettings.fromSchool.enabled"
            >
              <option value="" disabled>정류장을 선택하세요</option>
              <option v-for="station in fromSchoolStations" :key="station" :value="station">{{ station }}</option>
            </select>
          </div>
          
          <div class="form-group" :class="{ disabled: !currentSettings.fromSchool.enabled }">
            <label for="from-seat">선호 좌석번호</label>
            <input 
              type="number" 
              id="from-seat" 
              v-model.number="currentSettings.fromSchool.seatNumber" 
              min="1" 
              max="45" 
              :disabled="!currentSettings.fromSchool.enabled"
            >
            <p class="form-hint">※ 선호 좌석을 사용할 수 없는 경우 자동으로 다른 좌석을 선택합니다.</p>
          </div>
        </div>
        
        <!-- 저장 버튼 -->
        <div class="form-actions">
          <button type="button" @click="resetSettings" class="btn-reset">초기화</button>
          <button type="submit" class="btn-save" :disabled="loading">
            {{ loading ? '저장 중...' : '설정 저장' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useReservationStore } from '../store/reservations';

// 라우터와 스토어 설정
const route = useRoute();
const router = useRouter();
const reservationStore = useReservationStore();

// 요일 설정
const days = [
  { label: '일', value: 'sunday' },
  { label: '월', value: 'monday' },
  { label: '화', value: 'tuesday' }
];

// 현재 활성화된 요일
const activeDay = ref('sunday');

// 메시지 상태
const message = reactive({
  text: '',
  type: 'success' // success, error
});

// 로딩 상태
const loading = computed(() => reservationStore.loading);

// 현재 설정값 (기본값으로 초기화)
const currentSettings = reactive({
  toSchool: {
    enabled: false,
    route: '',
    time: '',
    station: '',
    seatNumber: 1
  },
  fromSchool: {
    enabled: false,
    route: '',
    time: '',
    station: '',
    seatNumber: 1
  }
});

// 임시 버스 정보 (실제로는 Firestore에서 가져와야 함)
// 등교 버스 노선
const toSchoolRoutes = ref([
  { id: 1, name: '장기/대화' },
  { id: 2, name: '정발산' },
  { id: 3, name: '화정' },
  { id: 4, name: '대곡' }
]);

// 하교 버스 노선
const fromSchoolRoutes = ref([
  { id: 1, name: '대화A' },
  { id: 2, name: '대화B' },
  { id: 3, name: '화정' },
  { id: 4, name: '대곡' }
]);

// 임시 시간 선택 옵션
const toSchoolTimes = ref(['07:30', '07:40', '07:50', '08:00', '08:10', '08:20', '08:30']);
const fromSchoolTimes = ref(['13:30', '13:45', '17:30', '17:45', '18:00']);

// 임시 정류장 옵션
const toSchoolStations = ref(['대화역', '정발산역', '주엽역', '화정역', '대곡역']);
const fromSchoolStations = ref(['대화역', '정발산역', '주엽역', '화정역', '대곡역']);

// URL 쿼리에서 요일 정보 가져오기
onMounted(async () => {
  // URL에서 요일 정보 가져오기
  const dayParam = route.query.day;
  if (dayParam && days.some(d => d.value === dayParam)) {
    activeDay.value = dayParam;
  }
  
  // 예약 설정 로드
  await loadSettings();
  
  // 경로 옵션 로드
  await reservationStore.loadSchedules();
});

// 활성화된 요일이 변경될 때마다 설정 다시 로드
watch(activeDay, async () => {
  await loadSettings();
  
  // URL 업데이트
  router.replace({ query: { ...route.query, day: activeDay.value } });
});

// 설정 로드
async function loadSettings() {
  // 스토어에서 현재 요일의 설정 가져오기
  const daySettings = reservationStore.getScheduleForDay(activeDay.value);
  
  if (daySettings) {
    // 깊은 복사로 현재 설정 업데이트
    currentSettings.toSchool = { ...daySettings.toSchool };
    currentSettings.fromSchool = { ...daySettings.fromSchool };
  } else {
    // 기본값으로 초기화
    resetSettings();
  }
}

// 설정 초기화
function resetSettings() {
  currentSettings.toSchool = {
    enabled: false,
    route: '',
    time: '',
    station: '',
    seatNumber: 1
  };
  
  currentSettings.fromSchool = {
    enabled: false,
    route: '',
    time: '',
    station: '',
    seatNumber: 1
  };
}

// 설정 저장
async function saveSettings() {
  try {
    // 유효성 검증
    let hasError = false;
    
    if (currentSettings.toSchool.enabled) {
      if (!currentSettings.toSchool.route || !currentSettings.toSchool.time || !currentSettings.toSchool.station) {
        message.text = '등교 버스 설정을 모두 입력해주세요.';
        message.type = 'error';
        hasError = true;
      }
    }
    
    if (currentSettings.fromSchool.enabled) {
      if (!currentSettings.fromSchool.route || !currentSettings.fromSchool.time || !currentSettings.fromSchool.station) {
        message.text = '하교 버스 설정을 모두 입력해주세요.';
        message.type = 'error';
        hasError = true;
      }
    }
    
    if (hasError) return;
    
    // 설정 저장
    const success = await reservationStore.saveSchedule(activeDay.value, {
      toSchool: { ...currentSettings.toSchool },
      fromSchool: { ...currentSettings.fromSchool }
    });
    
    if (success) {
      message.text = '설정이 저장되었습니다.';
      message.type = 'success';
      
      // 3초 후 메시지 제거
      setTimeout(() => {
        message.text = '';
      }, 3000);
    } else {
      message.text = reservationStore.error || '설정 저장 중 오류가 발생했습니다.';
      message.type = 'error';
    }
  } catch (error) {
    message.text = error.message || '오류가 발생했습니다.';
    message.type = 'error';
  }
}
</script>

<style scoped>
.settings-container {
  padding: 20px;
}

.settings-title {
  color: var(--dark-color);
  margin-bottom: 30px;
  font-size: 2rem;
}

.settings-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.tab-button {
  padding: 10px 20px;
  border: none;
  background-color: #f1f1f1;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s;
}

.tab-button.active {
  background-color: var(--primary-color);
  color: white;
}

.settings-card {
  background-color: white;
  border-radius: 8px;
  box-shadow: var(--shadow);
  padding: 20px;
}

.settings-section {
  margin-bottom: 40px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
}

.settings-section h2 {
  color: var(--dark-color);
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

/* 스위치 스타일 */
.switch-container {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.switch {
  position: relative;
  display: inline-block;
  width: 60px;
  height: 34px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
  border-radius: 34px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 26px;
  width: 26px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--secondary-color);
}

input:focus + .slider {
  box-shadow: 0 0 1px var(--secondary-color);
}

input:checked + .slider:before {
  transform: translateX(26px);
}

.switch-label {
  margin-left: 15px;
  font-weight: bold;
}

/* 폼 스타일 */
.form-group {
  margin-bottom: 20px;
}

.form-group.disabled label {
  color: #999;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.form-group select,
.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  background-color: white;
}

.form-group select:focus,
.form-group input:focus {
  border-color: var(--primary-color);
  outline: none;
}

.form-group select[disabled],
.form-group input[disabled] {
  background-color: #f9f9f9;
  color: #999;
  cursor: not-allowed;
}

.form-hint {
  margin-top: 5px;
  font-size: 0.8rem;
  color: #666;
}

/* 버튼 스타일 */
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
  margin-top: 30px;
}

.btn-save,
.btn-reset {
  padding: 10px 20px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  border: none;
  transition: background-color 0.3s;
}

.btn-save {
  background-color: var(--primary-color);
  color: white;
}

.btn-save:hover {
  background-color: #2980b9;
}

.btn-save:disabled {
  background-color: #95a5a6;
  cursor: not-allowed;
}

.btn-reset {
  background-color: #f1f1f1;
  color: #333;
}

.btn-reset:hover {
  background-color: #e0e0e0;
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

/* 반응형 */
@media (max-width: 768px) {
  .settings-tabs {
    overflow-x: auto;
    white-space: nowrap;
    padding-bottom: 10px;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .btn-save,
  .btn-reset {
    width: 100%;
  }
}
</style> 