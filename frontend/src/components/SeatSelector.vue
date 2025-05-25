<template>
  <div class="seat-selector">
    <label class="form-label">💺 선호 좌석 번호 (1-44번)</label>
    
    <!-- 직접 입력 -->
    <div class="seats-input-container">
      <input 
        type="text"
        :value="seatNumbersDisplay"
        @input="handleInputChange"
        :disabled="disabled"
        placeholder="예: 1, 5, 10 (쉼표로 구분)"
        class="form-input seats-input"
      />
      <small class="seats-help">
        원하는 좌석 번호를 입력하세요 (1-44번). 비어있으면 자동으로 좋은 좌석을 선택합니다.
      </small>
    </div>
    
    <!-- 빠른 좌석 선택 -->
    <div class="quick-seats">
      <h4>빠른 선택:</h4>
      <div class="seat-buttons">
        <button 
          type="button"
          @click="selectQuickSeats([1, 2, 3, 4])"
          class="btn-seat-quick"
          :disabled="disabled"
        >
          앞자리 (1-4)
        </button>
        <button 
          type="button"
          @click="selectQuickSeats([10, 11, 12, 13])"
          class="btn-seat-quick"
          :disabled="disabled"
        >
          중간 (10-13)
        </button>
        <button 
          type="button"
          @click="selectQuickSeats([20, 21, 22, 23])"
          class="btn-seat-quick"
          :disabled="disabled"
        >
          뒷자리 (20-23)
        </button>
        <button 
          type="button"
          @click="clearSeats"
          class="btn-seat-clear"
          :disabled="disabled"
        >
          초기화
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, defineEmits, defineProps } from 'vue'

const props = defineProps({
  seatNumbers: {
    type: Array,
    default: () => []
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update'])

// Computed
const seatNumbersDisplay = computed(() => {
  return Array.isArray(props.seatNumbers) 
    ? props.seatNumbers.join(', ')
    : ''
})

// Methods
function handleInputChange(event) {
  const value = event.target.value
  const seatNumbers = value
    .split(',')
    .map(seat => parseInt(seat.trim()))
    .filter(seat => !isNaN(seat) && seat >= 1 && seat <= 44)
  
  emit('update', seatNumbers)
}

function selectQuickSeats(seats) {
  emit('update', seats)
}

function clearSeats() {
  emit('update', [])
}
</script>

<style scoped>
/* 좌석 선택 */
.seat-selector {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 8px;
}

.seats-input-container {
  position: relative;
  margin-bottom: 15px;
}

.seats-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  transition: border-color 0.2s, box-shadow 0.2s;
  background: white;
  color: #2d3748;
}

.seats-input:focus {
  outline: none;
  border-color: #3182ce;
  box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.1);
}

.seats-input:disabled {
  background: #f7fafc;
  color: #a0aec0;
  cursor: not-allowed;
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
</style> 