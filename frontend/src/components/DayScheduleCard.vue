<template>
  <div class="day-schedule-card">
    <!-- 카드 헤더 -->
    <div class="card-header">
      <div class="day-info">
        <h3 class="day-name">{{ dayKorean }}</h3>
        <p class="day-description">등교와 하교 예약을 각각 설정할 수 있습니다</p>
      </div>
    </div>

    <!-- 등교/하교 탭 -->
    <div class="direction-tabs">
      <button 
        :class="['direction-tab', { active: activeDirection === 'toSchool' }]"
        @click="activeDirection = 'toSchool'"
        :disabled="loading"
      >
        🏫 등교 (대진대 → 외부)
        <span v-if="dayConfig.toSchool.enabled" class="enabled-indicator">●</span>
      </button>
      <button 
        :class="['direction-tab', { active: activeDirection === 'fromSchool' }]"
        @click="activeDirection = 'fromSchool'"
        :disabled="loading"
      >
        🏠 하교 (외부 → 대진대)
        <span v-if="dayConfig.fromSchool.enabled" class="enabled-indicator">●</span>
      </button>
    </div>

    <!-- 등교 설정 -->
    <div v-if="activeDirection === 'toSchool'" class="direction-section">
      <div class="section-header">
        <h4>🏫 등교 예약 설정</h4>
        <label class="toggle-switch">
          <input 
            type="checkbox" 
            :checked="dayConfig.toSchool.enabled"
            @change="handleToggle('toSchool')"
            :disabled="loading"
          />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div v-if="!dayConfig.toSchool.enabled" class="inactive-message">
        <p>🔒 등교 예약이 비활성화되어 있습니다</p>
        <p class="inactive-hint">위의 토글을 켜서 등교 예약을 설정하세요</p>
      </div>

      <div v-else class="config-content">
        <!-- 실행 시간 정보 -->
        <div v-if="dayConfig.toSchool.route" class="execution-info-card">
          <div class="time-badge" :class="getToSchoolTimeBadgeClass">
            <span class="time-icon">{{ getToSchoolTimeIcon }}</span>
            <span class="time-text">{{ getToSchoolTimeText }}</span>
          </div>
          <p class="time-description">{{ getToSchoolTimeDescription }}</p>
        </div>

        <!-- 노선 선택 -->
        <div class="form-group">
          <label class="form-label">🚌 등교 버스 노선</label>
          <select 
            :value="dayConfig.toSchool.route"
            @change="updateConfig('toSchool', 'route', $event.target.value)"
            :disabled="loading"
            class="form-select"
          >
            <option value="">노선을 선택하세요</option>
            <option 
              v-for="route in upRouteOptions" 
              :key="route.value"
              :value="route.value"
              :class="{ 'special-route': route.isSpecial }"
            >
              {{ route.label }}
            </option>
          </select>
        </div>

        <!-- 탑승 시간 선택 -->
        <div v-if="dayConfig.toSchool.route" class="form-group">
          <label class="form-label">⏰ 등교 탑승 시간</label>
          <select 
            :value="dayConfig.toSchool.busTime"
            @change="updateConfig('toSchool', 'busTime', $event.target.value)"
            :disabled="loading"
            class="form-select"
          >
            <option value="">시간을 선택하세요</option>
            <option 
              v-for="time in toSchoolTimes" 
              :key="time.value"
              :value="time.value"
            >
              {{ time.label }}
            </option>
          </select>
        </div>

        <!-- 승차역 선택 -->
        <div v-if="dayConfig.toSchool.route" class="form-group">
          <label class="form-label">🚏 승차역 (대진대 → 외부)</label>
          <select 
            :value="dayConfig.toSchool.stopSeq"
            @change="updateStop('toSchool', $event.target.value)"
            :disabled="loading"
            class="form-select"
          >
            <option value="">승차역을 선택하세요</option>
            <option 
              v-for="stop in getStopsForDirection('toSchool')" 
              :key="stop.seq"
              :value="stop.seq"
            >
              {{ stop.name }}
            </option>
          </select>
        </div>

        <!-- 선호 좌석 -->
        <SeatSelector
          :seatNumbers="dayConfig.toSchool.seatNumbers"
          @update="updateConfig('toSchool', 'seatNumbers', $event)"
          :disabled="loading"
        />

        <!-- 미리보기 버튼 -->
        <div class="card-actions">
          <button 
            @click="handlePreview('toSchool')"
            :disabled="loading || !isConfigComplete('toSchool')"
            class="btn btn-preview"
          >
            👁️ 등교 예약 미리보기
          </button>
        </div>
      </div>
    </div>

    <!-- 하교 설정 -->
    <div v-if="activeDirection === 'fromSchool'" class="direction-section">
      <div class="section-header">
        <h4>🏠 하교 예약 설정</h4>
        <label class="toggle-switch">
          <input 
            type="checkbox" 
            :checked="dayConfig.fromSchool.enabled"
            @change="handleToggle('fromSchool')"
            :disabled="loading"
          />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div v-if="!dayConfig.fromSchool.enabled" class="inactive-message">
        <p>🔒 하교 예약이 비활성화되어 있습니다</p>
        <p class="inactive-hint">위의 토글을 켜서 하교 예약을 설정하세요</p>
      </div>

      <div v-else class="config-content">
        <!-- 노선 선택 -->
        <div class="form-group">
          <label class="form-label">🚌 하교 버스 노선</label>
          <select 
            :value="dayConfig.fromSchool.route"
            @change="updateConfig('fromSchool', 'route', $event.target.value)"
            :disabled="loading"
            class="form-select"
          >
            <option value="">노선을 선택하세요</option>
            <option 
              v-for="route in downRouteOptions" 
              :key="route.value"
              :value="route.value"
              :class="{ 'special-route': route.isSpecial }"
            >
              {{ route.label }}
            </option>
          </select>
        </div>

        <!-- 실행 시간 정보 -->
        <div v-if="dayConfig.fromSchool.route" class="execution-info-card">
          <div class="time-badge" :class="getFromSchoolTimeBadgeClass">
            <span class="time-icon">{{ getFromSchoolTimeIcon }}</span>
            <span class="time-text">{{ getFromSchoolTimeText }}</span>
          </div>
          <p class="time-description">{{ getFromSchoolTimeDescription }}</p>
        </div>

        <!-- 탑승 시간 선택 -->
        <div v-if="dayConfig.fromSchool.route" class="form-group">
          <label class="form-label">⏰ 하교 탑승 시간</label>
          <select 
            :value="dayConfig.fromSchool.busTime"
            @change="updateConfig('fromSchool', 'busTime', $event.target.value)"
            :disabled="loading"
            class="form-select"
          >
            <option value="">시간을 선택하세요</option>
            <option 
              v-for="time in fromSchoolTimes" 
              :key="time.value"
              :value="time.value"
            >
              {{ time.label }}
            </option>
          </select>
        </div>

        <!-- 승차역 선택 -->
        <div v-if="dayConfig.fromSchool.route" class="form-group">
          <label class="form-label">🚏 승차역 (외부 → 대진대)</label>
          <select 
            :value="dayConfig.fromSchool.stopSeq"
            @change="updateStop('fromSchool', $event.target.value)"
            :disabled="loading"
            class="form-select"
          >
            <option value="">승차역을 선택하세요</option>
            <option 
              v-for="stop in getStopsForDirection('fromSchool')" 
              :key="stop.seq"
              :value="stop.seq"
            >
              {{ stop.name }}
            </option>
          </select>
        </div>

        <!-- 선호 좌석 -->
        <SeatSelector
          :seatNumbers="dayConfig.fromSchool.seatNumbers"
          @update="updateConfig('fromSchool', 'seatNumbers', $event)"
          :disabled="loading"
        />

        <!-- 미리보기 버튼 -->
        <div class="card-actions">
          <button 
            @click="handlePreview('fromSchool')"
            :disabled="loading || !isConfigComplete('fromSchool')"
            class="btn btn-preview"
          >
            👁️하교 예약 미리보기
          </button>
        </div>
      </div>
    </div>

    <!-- 로딩 오버레이 -->
    <div v-if="loading" class="card-loading">
      <div class="loading-spinner"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, defineEmits, defineProps } from 'vue'
import SeatSelector from './SeatSelector.vue'
import { useWeeklyScheduleStore } from '../store/weeklySchedule'

const props = defineProps({
  day: {
    type: String,
    required: true
  },
  dayKorean: {
    type: String,
    required: true
  },
  dayConfig: {
    type: Object,
    required: true
  },
  routeOptions: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update', 'toggle', 'preview'])

// Store
const weeklyStore = useWeeklyScheduleStore()

// 현재 활성 방향 (등교/하교)
const activeDirection = ref('toSchool')

// Computed properties
const upRouteOptions = computed(() => {
  // 등교 노선 (대진대 → 외부) - store에서 가져온 실제 데이터 사용
  if (weeklyStore.routeScheduleInfo.up && weeklyStore.routeScheduleInfo.up.length > 0) {
    return weeklyStore.routeScheduleInfo.up.map(route => ({
      value: route.lineName,
      label: `${route.lineName} (${route.description})`,
      isSpecial: route.isSpecialRoute
    }))
  }
  
  // 백업 데이터 (실제 수집된 등교 노선)
  return [
    { value: '[등교]노원', label: '[등교]노원 (19대 운행)', isSpecial: true },
    { value: '[등교]강동/천호', label: '[등교]강동/천호 (1대 운행)', isSpecial: false },
    { value: '[등교]성남', label: '[등교]성남 (3대 운행)', isSpecial: false },
    { value: '[등교]수원', label: '[등교]수원 (1대 운행)', isSpecial: false },
    { value: '[등교]장기/대화', label: '[등교]장기/대화 (1대 운행)', isSpecial: false },
    { value: '[등교]잠실/강변', label: '[등교]잠실/강변 (2대 운행)', isSpecial: false },
    { value: '[등교]화정', label: '[등교]화정 (2대 운행)', isSpecial: false },
    { value: '[등교]연신내', label: '[등교]연신내 (1대 운행)', isSpecial: false }
  ]
})

const downRouteOptions = computed(() => {
  // 하교 노선 (외부 → 대진대) - store에서 가져온 실제 데이터 사용
  if (weeklyStore.routeScheduleInfo.down && weeklyStore.routeScheduleInfo.down.length > 0) {
    return weeklyStore.routeScheduleInfo.down.map(route => ({
      value: route.lineName,
      label: `${route.lineName} (${route.description})`,
      isSpecial: route.isSpecialRoute
    }))
  }
  
  // 백업 데이터 (실제 수집된 하교 노선)
  return [
    { value: '[하교]노원', label: '[하교]노원 (30대 운행)', isSpecial: true },
    { value: '[하교]성남', label: '[하교]성남 (3대 운행)', isSpecial: false },
    { value: '[하교]수원', label: '[하교]수원 (2대 운행)', isSpecial: false },
    { value: '[하교]장기/대화', label: '[하교]장기/대화 (2대 운행)', isSpecial: false },
    { value: '[하교]잠실/강변', label: '[하교]잠실/강변 (2대 운행)', isSpecial: false },
    { value: '[하교]화정', label: '[하교]화정 (2대 운행)', isSpecial: false },
    { value: '[하교]연신내', label: '[하교]연신내 (1대 운행)', isSpecial: false },
    { value: '[하교]오남(진접)', label: '[하교]오남(진접) (2대 운행)', isSpecial: false }
  ]
})

// 등교 시간 (아침 시간대)
const toSchoolTimes = computed(() => {
  // 선택된 노선의 실제 시간표 데이터 사용
  const selectedRoute = props.dayConfig.toSchool.route
  if (selectedRoute && weeklyStore.routeScheduleInfo.timetables.up[selectedRoute]) {
    const times = weeklyStore.routeScheduleInfo.timetables.up[selectedRoute].times
    return times.map(t => ({
      value: t.time,
      label: `${t.time} (잔여: ${t.seatCount - t.appCount}/${t.seatCount}석)`
    }))
  }
  
  // 백업 데이터 (실제 등교 시간표 - 노원 노선 기준)
  return [
    { value: '07:50', label: '07:50 (잔여: 33/44석)' },
    { value: '08:00', label: '08:00 (잔여: 24/44석)' },
    { value: '08:10', label: '08:10 (잔여: 27/44석)' },
    { value: '08:20', label: '08:20 (잔여: 9/44석)' },
    { value: '08:30', label: '08:30 (잔여: 1/44석)' },
    { value: '08:40', label: '08:40 (만석)' },
    { value: '08:50', label: '08:50 (잔여: 15/44석)' },
    { value: '09:00', label: '09:00 (만석)' },
    { value: '09:10', label: '09:10 (만석)' }
  ]
})

// 하교 시간 (오후 시간대)
const fromSchoolTimes = computed(() => {
  // 선택된 노선의 실제 시간표 데이터 사용
  const selectedRoute = props.dayConfig.fromSchool.route
  if (selectedRoute && weeklyStore.routeScheduleInfo.timetables.down[selectedRoute]) {
    const times = weeklyStore.routeScheduleInfo.timetables.down[selectedRoute].times
    return times.map(t => ({
      value: t.time,
      label: `${t.time} (잔여: ${t.seatCount - t.appCount}/${t.seatCount}석)`
    }))
  }
  
  // 백업 데이터 (실제 하교 시간표 - 노원 노선 기준)
  return [
    { value: '09:00', label: '09:00 (잔여: 44/44석)' },
    { value: '09:10', label: '09:10 (잔여: 44/44석)' },
    { value: '09:20', label: '09:20 (잔여: 44/44석)' },
    { value: '09:30', label: '09:30 (잔여: 44/44석)' },
    { value: '09:40', label: '09:40 (잔여: 44/44석)' },
    { value: '10:30', label: '10:30 (잔여: 43/44석)' },
    { value: '11:00', label: '11:00 (잔여: 35/44석)' },
    { value: '13:00', label: '13:00 (잔여: 7/44석)' },
    { value: '13:15', label: '13:15 (잔여: 30/44석)' },
    { value: '13:30', label: '13:30 (잔여: 27/44석)' },
    { value: '13:45', label: '13:45 (잔여: 34/44석)' },
    { value: '14:00', label: '14:00 (잔여: 41/44석)' },
    { value: '14:30', label: '14:30 (잔여: 41/44석)' },
    { value: '15:00', label: '15:00 (잔여: 21/44석)' },
    { value: '15:10', label: '15:10 (잔여: 24/44석)' },
    { value: '15:20', label: '15:20 (잔여: 7/44석)' },
    { value: '15:30', label: '15:30 (잔여: 7/44석)' },
    { value: '15:40', label: '15:40 (잔여: 7/44석)' },
    { value: '15:50', label: '15:50 (잔여: 7/44석)' },
    { value: '16:00', label: '16:00 (잔여: 7/44석)' }
  ]
})

// 하교 시간 뱃지 클래스
const getFromSchoolTimeBadgeClass = computed(() => {
  if (!props.dayConfig.fromSchool.route) return ''
  return (props.dayConfig.fromSchool.route.includes('노원') || props.dayConfig.fromSchool.route === '112') ? 'time-22' : 'time-21'
})

// 등교 시간 뱃지 클래스
const getToSchoolTimeBadgeClass = computed(() => {
  if (!props.dayConfig.toSchool.route) return ''
  return (props.dayConfig.toSchool.route.includes('노원') || props.dayConfig.toSchool.route === '112') ? 'time-22' : 'time-21'
})

const getToSchoolTimeIcon = computed(() => '🌆')

const getToSchoolTimeText = computed(() => {
  if (!props.dayConfig.toSchool.route) return ''
  return (props.dayConfig.toSchool.route.includes('노원') || props.dayConfig.toSchool.route === '112') ? '22시 정각 실행' : '21시 정각 실행'
})

const getToSchoolTimeDescription = computed(() => {
  if (!props.dayConfig.toSchool.route) return ''
  const executionDay = getExecutionDayKorean(props.day)
  return (props.dayConfig.toSchool.route.includes('노원') || props.dayConfig.toSchool.route === '112')
    ? `${executionDay} 저녁 22시에 ${props.dayKorean} 등교 예약이 자동 실행됩니다`
    : `${executionDay} 저녁 21시에 ${props.dayKorean} 등교 예약이 자동 실행됩니다`
})

const getFromSchoolTimeIcon = computed(() => '🌆')

const getFromSchoolTimeText = computed(() => {
  if (!props.dayConfig.fromSchool.route) return ''
  return (props.dayConfig.fromSchool.route.includes('노원') || props.dayConfig.fromSchool.route === '112') ? '22시 정각' : '21시 정각'
})

const getFromSchoolTimeDescription = computed(() => {
  if (!props.dayConfig.fromSchool.route) return ''
  const executionDay = getExecutionDayKorean(props.day)
  return (props.dayConfig.fromSchool.route.includes('노원') || props.dayConfig.fromSchool.route === '112')
    ? `${executionDay} 저녁 22시에 ${props.dayKorean} 하교 예약이 자동 실행됩니다`
    : `${executionDay} 저녁 21시에 ${props.dayKorean} 하교 예약이 자동 실행됩니다`
})

// Methods
function getStopsForDirection(direction) {
  const route = direction === 'toSchool' ? props.dayConfig.toSchool.route : props.dayConfig.fromSchool.route
  
  if (!route) return []
  
  // Store에서 실제 정류장 데이터 가져오기
  const stopsData = direction === 'toSchool' 
    ? weeklyStore.routeScheduleInfo.stops.up[route]
    : weeklyStore.routeScheduleInfo.stops.down[route]
  
  if (stopsData && stopsData.length > 0) {
    return stopsData
  }
  
  // 백업 데이터
  if (direction === 'toSchool') {
    // 등교: 대진대에서 출발하는 정류장들 (실제 데이터 기반)
    const stopsByRoute = {
      '[등교]노원': [
        { seq: 102, name: '1)대진대학교' },
        { seq: 103, name: '2)포천터미널' },
        { seq: 104, name: '3)노원역' }
      ],
      '[등교]강동/천호': [
        { seq: 134, name: '1)강동역' },
        { seq: 135, name: '2)천호역' }
      ],
      '[등교]성남': [
        { seq: 102, name: '1)대진대학교' },
        { seq: 103, name: '2)포천터미널' },
        { seq: 136, name: '3)성남터미널' },
        { seq: 137, name: '4)수내역' }
      ],
      '[등교]수원': [
        { seq: 102, name: '1)대진대학교' },
        { seq: 103, name: '2)포천터미널' },
        { seq: 138, name: '3)수원역' }
      ],
      '[등교]장기/대화': [
        { seq: 104, name: '1)장기역' },
        { seq: 105, name: '2)대화역' }
      ],
      '[등교]잠실/강변': [
        { seq: 318, name: '1)잠실역' },
        { seq: 319, name: '2)강변역' }
      ],
      '[등교]화정': [
        { seq: 65, name: '1)화정역' },
        { seq: 64, name: '2)원당역' }
      ],
      '[등교]연신내': [
        { seq: 351, name: '1)연신내' },
        { seq: 352, name: '2)구파발역' },
        { seq: 353, name: '3)삼송역' }
      ]
    }
    return stopsByRoute[route] || []
  } else {
    // 하교: 외부에서 대진대로 오는 정류장들 (실제 데이터 기반)
    const stopsByRoute = {
      '[하교]노원': [
        { seq: 104, name: '1)노원역' },
        { seq: 103, name: '2)포천터미널' },
        { seq: 102, name: '3)대진대학교' }
      ],
      '[하교]성남': [
        { seq: 136, name: '1)성남터미널' },
        { seq: 137, name: '2)수내역' },
        { seq: 103, name: '3)포천터미널' },
        { seq: 102, name: '4)대진대학교' }
      ],
      '[하교]수원': [
        { seq: 138, name: '1)수원역' },
        { seq: 103, name: '2)포천터미널' },
        { seq: 102, name: '3)대진대학교' }
      ],
      '[하교]장기/대화': [
        { seq: 104, name: '1)장기역' },
        { seq: 105, name: '2)대화역' }
      ],
      '[하교]잠실/강변': [
        { seq: 318, name: '1)잠실역' },
        { seq: 319, name: '2)강변역' }
      ],
      '[하교]화정': [
        { seq: 65, name: '1)화정역' },
        { seq: 64, name: '2)원당역' }
      ],
      '[하교]연신내': [
        { seq: 351, name: '1)연신내' },
        { seq: 352, name: '2)구파발역' },
        { seq: 353, name: '3)삼송역' }
      ],
      '[하교]오남(진접)': [
        { seq: 59, name: '1)오남도서관' },
        { seq: 60, name: '2)금강아파트' },
        { seq: 130, name: '3)반도유보라' }
      ]
    }
    return stopsByRoute[route] || []
  }
}

function isConfigComplete(direction) {
  const config = props.dayConfig[direction]
  return config.enabled && config.route && config.busTime && config.stopSeq
}

function handleToggle(direction) {
  emit('toggle', props.day, direction)
}

function updateConfig(direction, field, value) {
  const updates = { [field]: value }
  
  // 노선 변경 시 하위 설정 초기화
  if (field === 'route') {
    updates.busTime = ''
    updates.stopSeq = ''
    updates.stopName = ''
  }
  
  emit('update', props.day, direction, updates)
}

function updateStop(direction, stopSeq) {
  const stops = getStopsForDirection(direction)
  const stop = stops.find(s => s.seq === stopSeq)
  
  emit('update', props.day, direction, {
    stopSeq,
    stopName: stop ? stop.name : ''
  })
}

function handlePreview(direction) {
  emit('preview', props.day, direction)
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
</script>

<style scoped>
.day-schedule-card {
  background: white;
  border-radius: 12px;
  border: 2px solid #e2e8f0;
  overflow: hidden;
  transition: all 0.3s ease;
  position: relative;
}

.day-schedule-card.active {
  border-color: #3182ce;
  box-shadow: 0 4px 12px rgba(49, 130, 206, 0.15);
}

.day-schedule-card.disabled {
  opacity: 0.7;
}

.day-schedule-card:hover:not(.disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

/* 카드 헤더 */
.card-header {
  padding: 20px;
  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.day-info {
  flex-grow: 1;
}

.day-name {
  font-size: 1.3rem;
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 4px;
}

.day-description {
  font-size: 0.9rem;
  color: #4a5568;
  margin: 0;
}

/* 등교/하교 탭 */
.direction-tabs {
  display: flex;
  gap: 0;
  padding: 0 20px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.direction-tab {
  padding: 12px 20px;
  border: 1px solid #e2e8f0;
  border-bottom: none;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f8f9fa;
  color: #6c757d;
  flex: 1;
  justify-content: center;
  position: relative;
}

.direction-tab:first-child {
  border-radius: 8px 0 0 0;
}

.direction-tab:last-child {
  border-radius: 0 8px 0 0;
}

.direction-tab.active {
  background: white;
  color: #3182ce;
  border-color: #3182ce;
  border-bottom: 1px solid white;
  z-index: 1;
}

.direction-tab:hover:not(.active) {
  background: #e9ecef;
}

.enabled-indicator {
  font-size: 0.6rem;
  color: #28a745;
  font-weight: bold;
}

/* 등교/하교 섹션 */
.direction-section {
  background: white;
  border-radius: 0 0 12px 12px;
  border: 1px solid #e2e8f0;
  border-top: none;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 20px 10px;
  border-bottom: 1px solid #f1f5f9;
}

.section-header h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0;
}

/* 실행 시간 정보 카드 */
.execution-info-card {
  margin: 15px 0;
  padding: 15px;
  background: linear-gradient(135deg, #f0fff4 0%, #e6fffa 100%);
  border: 1px solid #9ae6b4;
  border-radius: 10px;
  border-left: 4px solid #38a169;
}

.time-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 10px;
}

.time-badge.to-school {
  background: #e3f2fd;
  color: #1565c0;
  border: 1px solid #bbdefb;
}

.time-badge.time-21 {
  background: #bee3f8;
  color: #1a365d;
  border: 1px solid #90cdf4;
}

.time-badge.time-22 {
  background: #c6f6d5;
  color: #1a202c;
  border: 1px solid #9ae6b4;
}

.time-icon {
  font-size: 1rem;
}

.time-text {
  font-size: 0.85rem;
  font-weight: 600;
}

.time-description {
  font-size: 0.8rem;
  color: #2d3748;
  margin: 0;
  line-height: 1.4;
}

/* 카드 내용 */
.config-content {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 8px;
}

.form-select,
.form-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  background: white;
  color: #2d3748;
}

.form-select:focus,
.form-input:focus {
  outline: none;
  border-color: #3182ce;
  box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.1);
}

.form-select:disabled,
.form-input:disabled {
  background: #f7fafc;
  color: #a0aec0;
  cursor: not-allowed;
}

/* 셀렉트 옵션 스타일 강화 */
.form-select option {
  background: white;
  color: #2d3748;
  padding: 10px;
  font-weight: normal;
}

.form-select option[value=""] {
  color: #718096;
  font-style: italic;
}

.form-select option.special-route {
  background: #e6fffa !important;
  color: #065f46 !important;
  font-weight: 600 !important;
}

.form-select option:hover {
  background: #f7fafc !important;
}

.form-select option:checked {
  background: #3182ce !important;
  color: white !important;
}

/* 브라우저별 호환성 개선 */
.form-select {
  /* WebKit 계열 브라우저 */
  -webkit-appearance: none;
  /* Firefox */
  -moz-appearance: none;
  /* 표준 */
  appearance: none;
  
  /* 드롭다운 화살표 추가 */
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
  padding-right: 40px;
}

/* 좌석 입력 */
.seats-selection {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.seats-input-container {
  position: relative;
}

.seats-input {
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
}

.seats-help {
  display: block;
  font-size: 0.75rem;
  color: #718096;
  margin-top: 4px;
  line-height: 1.4;
}

/* 빠른 좌석 선택 */
.quick-seats {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 15px;
}

.quick-seats h4 {
  font-size: 0.85rem;
  font-weight: 600;
  color: #495057;
  margin: 0 0 10px 0;
}

.seat-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-seat-quick,
.btn-seat-clear {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
  min-width: 80px;
}

.btn-seat-quick {
  background: #e3f2fd;
  color: #1565c0;
  border: 1px solid #bbdefb;
}

.btn-seat-quick:hover:not(:disabled) {
  background: #bbdefb;
  transform: translateY(-1px);
}

.btn-seat-clear {
  background: #fce4ec;
  color: #c2185b;
  border: 1px solid #f8bbd9;
}

.btn-seat-clear:hover:not(:disabled) {
  background: #f8bbd9;
  transform: translateY(-1px);
}

.btn-seat-quick:disabled,
.btn-seat-clear:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* 카드 액션 */
.card-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #e2e8f0;
}

.btn {
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  justify-content: center;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-preview {
  background: #edf2f7;
  color: #4a5568;
  border: 1px solid #cbd5e0;
}

.btn-preview:hover:not(:disabled) {
  background: #e2e8f0;
}

/* 비활성 메시지 */
.inactive-message {
  padding: 40px 20px;
  text-align: center;
  color: #718096;
}

.inactive-message p {
  margin: 8px 0;
}

.inactive-hint {
  font-size: 0.85rem;
  color: #a0aec0;
}

/* 카드 로딩 */
.card-loading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #e2e8f0;
  border-top: 2px solid #3182ce;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 반응형 */
@media (max-width: 480px) {
  .card-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }
  
  .day-name {
    font-size: 1.1rem;
  }
  
  .card-content {
    padding: 15px;
  }
}

/* 토글 스위치 */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
  cursor: pointer;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #cbd5e0;
  transition: 0.3s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

input:checked + .toggle-slider {
  background-color: #3182ce;
}

input:checked + .toggle-slider:before {
  transform: translateX(26px);
}

input:disabled + .toggle-slider {
  opacity: 0.5;
  cursor: not-allowed;
}
</style> 