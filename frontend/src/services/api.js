import axios from 'axios'
import { getApiConfig } from '../config/api'

// API 설정 로드
const config = getApiConfig()

// API 클라이언트 설정
const apiClient = axios.create({
  baseURL: config.FUNCTIONS_BASE_URL,
  timeout: config.TIMEOUT,
  headers: config.DEFAULT_HEADERS
})

// 요청 인터셉터 (로깅 및 인증 토큰 추가)
if (config.ENABLE_REQUEST_LOGGING) {
  apiClient.interceptors.request.use(
    async request => {
      console.log('🚀 API 요청:', {
        method: request.method?.toUpperCase(),
        url: request.url,
        data: request.data
      })

      // Firebase Auth 토큰이 필요한 경우 추가
      try {
        const { getAuth } = await import('firebase/auth')
        const auth = getAuth()
        if (auth.currentUser) {
          const token = await auth.currentUser.getIdToken()
          request.headers.Authorization = `Bearer ${token}`
        }
      } catch (error) {
        console.warn('Firebase Auth 토큰 가져오기 실패:', error)
      }

      return request
    },
    error => {
      console.error('❌ 요청 인터셉터 오류:', error)
      return Promise.reject(error)
    }
  )
}

// 응답 인터셉터 (로깅 및 에러 처리)
apiClient.interceptors.response.use(
  response => {
    if (config.ENABLE_REQUEST_LOGGING) {
      console.log('✅ API 응답:', {
        status: response.status,
        url: response.config.url,
        data: response.data
      })
    }
    return response
  },
  error => {
    if (config.ENABLE_ERROR_LOGGING) {
      console.error('❌ API 요청 실패:', {
        status: error.response?.status,
        url: error.config?.url,
        message: error.response?.data?.message || error.message,
        data: error.response?.data
      })
    }
    return Promise.reject(error)
  }
)

class BusReservationAPI {
  // ========== 사용자 관리 ==========
  
  async addUser(userData) {
    try {
      const response = await apiClient.post('/addUser', userData)
      return response.data
    } catch (error) {
      throw this.handleError(error, '사용자 추가 실패')
    }
  }

  async updateUser(userData) {
    try {
      const response = await apiClient.post('/updateUser', userData)
      return response.data
    } catch (error) {
      throw this.handleError(error, '사용자 정보 수정 실패')
    }
  }

  async deleteUser(userId) {
    try {
      const response = await apiClient.post('/deleteUser', { userId })
      return response.data
    } catch (error) {
      throw this.handleError(error, '사용자 삭제 실패')
    }
  }

  async testLogin(userId) {
    try {
      const response = await apiClient.post('/testLogin', { userId })
      return response.data
    } catch (error) {
      throw this.handleError(error, '로그인 테스트 실패')
    }
  }

  // ========== 주간 스케줄 관리 (신규) ==========
  
  async getWeeklySchedule(userId) {
    try {
      const response = await apiClient.get('/getWeeklySchedule', {
        params: { userId }
      })
      return response.data
    } catch (error) {
      throw this.handleError(error, '주간 스케줄 조회 실패')
    }
  }

  async setWeeklySchedule(userId, weeklySchedule) {
    try {
      const response = await apiClient.post('/setWeeklySchedule', {
        userId,
        weeklySchedule
      })
      return response.data
    } catch (error) {
      throw this.handleError(error, '주간 스케줄 저장 실패')
    }
  }

  async updateDaySchedule(userId, dayOfWeek, daySchedule) {
    try {
      const response = await apiClient.post('/updateDaySchedule', {
        userId,
        dayOfWeek,
        daySchedule
      })
      return response.data
    } catch (error) {
      throw this.handleError(error, '요일 스케줄 업데이트 실패')
    }
  }

  async previewReservation(userId, dayOfWeek) {
    try {
      const response = await apiClient.get('/previewReservation', {
        params: { userId, dayOfWeek }
      })
      return response.data
    } catch (error) {
      throw this.handleError(error, '예약 미리보기 실패')
    }
  }

  async getRouteScheduleInfo(userId) {
    try {
      const response = await apiClient.get('/getRouteScheduleInfo', {
        params: { userId }
      })
      return response.data
    } catch (error) {
      throw this.handleError(error, '노선 스케줄 정보 조회 실패')
    }
  }

  // ========== 기존 예약 관리 ==========
  
  async setReservation(reservationData) {
    try {
      const response = await apiClient.post('/setReservation', reservationData)
      return response.data
    } catch (error) {
      throw this.handleError(error, '예약 설정 저장 실패')
    }
  }

  async executeReservation(reservationData) {
    try {
      const response = await apiClient.post('/executeReservation', reservationData)
      return response.data
    } catch (error) {
      throw this.handleError(error, '예약 실행 실패')
    }
  }

  async getReservationStatus(userId) {
    try {
      const response = await apiClient.get('/getReservationStatus', {
        params: { userId }
      })
      return response.data
    } catch (error) {
      throw this.handleError(error, '예약 상태 조회 실패')
    }
  }

  async cancelReservation(userId, reservationId) {
    try {
      const response = await apiClient.post('/cancelReservation', {
        userId,
        reservationId
      })
      return response.data
    } catch (error) {
      throw this.handleError(error, '예약 취소 실패')
    }
  }

  // ========== 시스템 정보 ==========
  
  async getSystemStatus() {
    try {
      const response = await apiClient.get('/getSystemStatus')
      return response.data
    } catch (error) {
      throw this.handleError(error, '시스템 상태 조회 실패')
    }
  }

  async getRoutes(userId) {
    try {
      const response = await apiClient.get('/getRoutes', {
        params: { userId }
      })
      return response.data
    } catch (error) {
      throw this.handleError(error, '노선 정보 조회 실패')
    }
  }

  async getBusTimetable(userId, routeSeq) {
    try {
      const response = await apiClient.get('/getBusTimetable', {
        params: { userId, routeSeq }
      })
      return response.data
    } catch (error) {
      throw this.handleError(error, '버스 시간표 조회 실패')
    }
  }

  async getSystemInfo() {
    try {
      const response = await apiClient.get('/getSystemInfo')
      return response.data
    } catch (error) {
      throw this.handleError(error, '시스템 정보 조회 실패')
    }
  }

  async healthCheck() {
    try {
      const response = await apiClient.get('/healthCheck')
      return response.data
    } catch (error) {
      throw this.handleError(error, '헬스 체크 실패')
    }
  }

  // ========== 유틸리티 메서드 ==========
  
  handleError(error, defaultMessage) {
    const message = error.response?.data?.message || defaultMessage
    const details = {
      message,
      status: error.response?.status,
      data: error.response?.data
    }
    console.error('API 에러:', details)
    return new Error(message)
  }

  // 요일 한글 변환
  getDayNameKorean(dayOfWeek) {
    const dayNames = {
      monday: '월요일',
      tuesday: '화요일',
      wednesday: '수요일',
      thursday: '목요일',
      friday: '금요일'
    }
    return dayNames[dayOfWeek] || dayOfWeek
  }

  // 실행 시간 포맷팅
  formatExecutionTime(timeSlot) {
    return timeSlot === '22:00' ? '22시 정각' : '21시 정각'
  }

  // 노선 타입 확인
  isSpecialRoute(routeName) {
    return routeName.includes('노원')
  }

  // 예약 상태 한글 변환
  getStatusKorean(status) {
    const statusNames = {
      success: '성공',
      failed: '실패',
      pending: '대기중',
      completed: '완료'
    }
    return statusNames[status] || status
  }
}

// 싱글톤 인스턴스 생성
const busAPI = new BusReservationAPI()

export default busAPI

// 개별 메서드들도 export (기존 코드 호환성)
export const {
  addUser,
  updateUser,
  deleteUser,
  testLogin,
  getWeeklySchedule,
  setWeeklySchedule,
  updateDaySchedule,
  previewReservation,
  getRouteScheduleInfo,
  setReservation,
  executeReservation,
  getReservationStatus,
  cancelReservation,
  getSystemStatus,
  getRoutes,
  getBusTimetable,
  getSystemInfo,
  healthCheck
} = busAPI 