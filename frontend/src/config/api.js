// API 설정 파일
export const API_CONFIG = {
  // Firebase Functions 기본 URL
  // 실제 프로젝트 ID: djbusmacro
  FUNCTIONS_BASE_URL: import.meta.env.VITE_FUNCTIONS_BASE_URL || 
                     'https://asia-northeast3-djbusmacro.cloudfunctions.net',
  
  // API 요청 타임아웃 (밀리초)
  TIMEOUT: parseInt(import.meta.env.VITE_API_TIMEOUT || '30000'),
  
  // 재시도 설정
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1초
  
  // 개발 모드 설정
  DEV_MODE: import.meta.env.DEV || false,
  
  // 로깅 설정
  ENABLE_REQUEST_LOGGING: import.meta.env.DEV || false,
  ENABLE_ERROR_LOGGING: true,
  
  // 캐시 설정
  CACHE_TTL: 5 * 60 * 1000, // 5분
  
  // 요청 헤더
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
}

// 개발 환경에서만 사용하는 설정
export const DEV_CONFIG = {
  // Mock API 사용 여부
  USE_MOCK_API: false,
  
  // 디버그 모드
  DEBUG_MODE: true,
  
  // 콘솔 로그 레벨
  LOG_LEVEL: 'debug'
}

// 환경별 설정 반환
export function getApiConfig() {
  const config = { ...API_CONFIG }
  
  if (config.DEV_MODE) {
    Object.assign(config, DEV_CONFIG)
  }
  
  return config
}

// Firebase Functions URL 유효성 검사
export function validateFunctionsUrl(url) {
  if (!url) {
    throw new Error('Firebase Functions URL이 설정되지 않았습니다')
  }
  
  if (!url.includes('cloudfunctions.net')) {
    console.warn('⚠️ Firebase Functions URL 형식이 올바르지 않을 수 있습니다:', url)
  }
  
  if (url.includes('your-project-id')) {
    throw new Error('Firebase Functions URL에서 프로젝트 ID를 실제 값으로 변경해주세요')
  }
  
  return true
}

// 설정 초기화 및 검증
export function initializeApiConfig() {
  const config = getApiConfig()
  
  try {
    validateFunctionsUrl(config.FUNCTIONS_BASE_URL)
    
    if (config.DEV_MODE) {
      console.log('🔧 API 설정 (개발 모드):', config)
    }
    
    return config
  } catch (error) {
    console.error('❌ API 설정 오류:', error.message)
    throw error
  }
} 