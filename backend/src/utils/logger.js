/**
 * 통합 로깅 시스템
 * 모든 로그를 구조화하여 Firestore에 저장하고, 콘솔에도 출력합니다.
 */
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const config = require('../config');

// 원본 console 메소드 보존
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug
};

// 실행 환경 식별
const environment = config.isCloudRun ? 'cloudrun' : 'local';
const serviceId = process.env.K_SERVICE || 'local-dev';

// 로그 세션 ID (서버 시작마다 고유값)
const sessionId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

/**
 * Firestore에 로그 저장
 */
async function saveLogToFirestore(level, message, context = {}) {
  try {
    const db = getFirestore();
    const timestamp = new Date();
    const dateString = timestamp.toISOString().split('T')[0].replace(/-/g, '');
    
    // 로그 ID 생성 (타임스탬프 + 랜덤값)
    const logId = `${timestamp.toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).substring(2, 5)}`;
    
    // 기본 컨텍스트에 환경 정보 추가
    const enrichedContext = {
      environment,
      serviceId,
      sessionId,
      ...context
    };
    
    // 로그 데이터 객체
    const logData = {
      timestamp,
      level,
      message: typeof message === 'object' ? JSON.stringify(message) : String(message),
      context: enrichedContext
    };
    
    // 일별 컬렉션에 로그 저장
    await db.collection('logs').doc(dateString).collection('entries').doc(logId).set(logData);
    
    // 최근 로그 컬렉션에도 동일 내용 저장 (최신 항목만 볼 수 있도록)
    await db.collection('recent_logs').doc(logId).set({
      ...logData,
      created: timestamp  // TTL 인덱스용 필드
    });
    
    return { id: logId, ...logData };
  } catch (error) {
    // Firestore 저장 실패 시 원본 콘솔로 오류 출력 (무한 루프 방지)
    originalConsole.error('Failed to save log to Firestore:', error.message);
    return null;
  }
}

/**
 * 타이머 정보를 포함한 로그 저장
 */
function logWithTimer(level, message, timerData, additionalContext = {}) {
  const context = { ...additionalContext };
  
  if (timerData) {
    context.timer = timerData;
  }
  
  const logMessage = typeof message === 'string' ? message : JSON.stringify(message);
  
  // 콘솔 출력
  const originalMethod = originalConsole[level] || originalConsole.log;
  originalMethod(logMessage);
  
  // Firestore에 저장 (비동기 실행)
  saveLogToFirestore(level, logMessage, context);
}

/**
 * 콘솔 함수 오버라이드
 */
function overrideConsoleMethods() {
  console.log = function(...args) {
    logWithTimer('info', args.join(' '));
  };
  
  console.info = function(...args) {
    logWithTimer('info', args.join(' '));
  };
  
  console.warn = function(...args) {
    logWithTimer('warn', args.join(' '));
  };
  
  console.error = function(...args) {
    logWithTimer('error', args.join(' '));
  };
  
  console.debug = function(...args) {
    if (config.loggingConfig.level === 'debug') {
      logWithTimer('debug', args.join(' '));
    }
  };
}

/**
 * 스크린샷 정보 로깅
 */
function logScreenshot(screenshotName, screenshotPath) {
  return saveLogToFirestore('info', `Screenshot taken: ${screenshotName}`, {
    type: 'screenshot',
    screenshotName,
    screenshotPath,
    url: `/screenshots/${path.basename(screenshotPath)}`
  });
}

/**
 * 프로세스 시작 로깅
 */
function logProcessStart(processName) {
  return saveLogToFirestore('info', `Process started: ${processName}`, {
    type: 'process',
    process: processName,
    status: 'started'
  });
}

/**
 * 프로세스 종료 로깅
 */
function logProcessEnd(processName, duration, status = 'completed') {
  return saveLogToFirestore('info', `Process ended: ${processName} (${duration}ms)`, {
    type: 'process',
    process: processName,
    status,
    duration
  });
}

/**
 * 예약 결과 로깅
 */
function logReservationResult(dayOfWeek, type, result) {
  return saveLogToFirestore(
    result.status === 'success' ? 'info' : 'error',
    `Reservation ${result.status}: ${result.message}`,
    {
      type: 'reservation',
      dayOfWeek,
      reservationType: type,
      result
    }
  );
}

module.exports = {
  saveLogToFirestore,
  logWithTimer,
  logScreenshot,
  logProcessStart,
  logProcessEnd,
  logReservationResult,
  overrideConsoleMethods,
  originalConsole
}; 