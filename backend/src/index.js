/**
 * 대진대학교 버스 예약 자동화 매크로 - 백엔드
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const cron = require('node-cron');
const logger = require('./utils/logger');
const busReservation = require('./services/busReservation');
const notification = require('./services/notification');

// Firebase 초기화 (firebase/init.js에서 가져오기)
require('./firebase/init');
const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore();

// 로깅 시스템 초기화
logger.overrideConsoleMethods();
console.log('로깅 시스템 초기화 완료');

// Express 서버 설정
const app = express();
const PORT = process.env.PORT || 3000;

// 테스트 모드 설정 (환경 변수에서 가져오거나 기본값 사용)
const TEST_MODE = process.env.TEST_MODE === 'true';
const TEST_HOUR = parseInt(process.env.TEST_HOUR || '22');
const TEST_LOGIN_MINUTE = parseInt(process.env.TEST_LOGIN_MINUTE || '59');
const TEST_RESERVE_HOUR = parseInt(process.env.TEST_RESERVE_HOUR || '22');
const TEST_RESERVE_MINUTE = parseInt(process.env.TEST_RESERVE_MINUTE || '0');

// 시간 설정 로깅
console.log(`운영 모드: ${TEST_MODE ? '테스트' : '실제'}`);
if (TEST_MODE) {
  console.log(`테스트 로그인 시간: ${TEST_HOUR}:${TEST_LOGIN_MINUTE}`);
  console.log(`테스트 예약 시간: ${TEST_RESERVE_HOUR}:${TEST_RESERVE_MINUTE}`);
} else {
  console.log('예약 로그인 시간: 20:57');
  console.log('예약 실행 시간: 21:00');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 스크린샷 디렉토리 정적 서빙
const SCREENSHOT_DIR = path.join(__dirname, '../screenshots');
app.use('/screenshots', express.static(SCREENSHOT_DIR));

// 기본 모니터링 HTML 페이지 제공
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 스크린샷 목록 API
app.get('/api/screenshots', async (req, res) => {
  try {
    // 스크린샷 디렉토리가 없으면 생성
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    
    const files = await fs.readdir(SCREENSHOT_DIR);
    const screenshots = files
      .filter(file => file.endsWith('.png'))
      .sort((a, b) => b.localeCompare(a)) // 최신 파일이 먼저 오도록 정렬
      .map(file => ({
        filename: file,
        url: `/screenshots/${file}`,
        timestamp: file.split('_')[0]
      }));
    
    res.json(screenshots);
  } catch (error) {
    console.error('스크린샷 목록 조회 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

// 로그 조회 API 추가
app.get('/api/logs', async (req, res) => {
  try {
    const { date, limit = 100, level } = req.query;
    let query;
    
    if (date) {
      // 특정 날짜 로그 조회
      const dateString = date.replace(/-/g, '');
      query = db.collection('logs').doc(dateString).collection('entries');
    } else {
      // 최근 로그 조회
      query = db.collection('recent_logs');
    }
    
    // 필터링 적용
    if (level) {
      query = query.where('level', '==', level);
    }
    
    // 정렬 및 제한
    const snapshot = await query.orderBy('timestamp', 'desc').limit(parseInt(limit)).get();
    
    const logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json(logs);
  } catch (error) {
    console.error('로그 조회 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

// 상태 확인 API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'active',
    serverTime: new Date().toISOString(),
    nextScheduled: busReservation.getNextSchedule(),
    environment: process.env.K_SERVICE ? 'cloudrun' : 'local',
    sessionId: logger.sessionId,
    testMode: TEST_MODE,
    scheduledTimes: TEST_MODE ? 
      { login: `${TEST_HOUR}:${TEST_LOGIN_MINUTE}`, reserve: `${TEST_RESERVE_HOUR}:${TEST_RESERVE_MINUTE}` } : 
      { login: '20:57', reserve: '21:00' }
  });
});

// 테스트 모드 설정 API
app.post('/api/test-mode', (req, res) => {
  const { enabled, loginHour, loginMinute, reserveHour, reserveMinute } = req.body;
  
  // 테스트 모드 설정
  process.env.TEST_MODE = enabled ? 'true' : 'false';
  
  if (loginHour) process.env.TEST_HOUR = loginHour.toString();
  if (loginMinute) process.env.TEST_LOGIN_MINUTE = loginMinute.toString();
  if (reserveHour) process.env.TEST_RESERVE_HOUR = reserveHour.toString();
  if (reserveMinute) process.env.TEST_RESERVE_MINUTE = reserveMinute.toString();
  
  // 전역 변수 업데이트
  TEST_MODE = process.env.TEST_MODE === 'true';
  
  console.log(`테스트 모드 ${TEST_MODE ? '활성화' : '비활성화'}`);
  if (TEST_MODE) {
    console.log(`테스트 시간 설정: 로그인=${process.env.TEST_HOUR}:${process.env.TEST_LOGIN_MINUTE}, 예약=${process.env.TEST_RESERVE_HOUR}:${process.env.TEST_RESERVE_MINUTE}`);
  }
  
  res.json({ 
    success: true, 
    testMode: TEST_MODE,
    times: {
      login: `${process.env.TEST_HOUR}:${process.env.TEST_LOGIN_MINUTE}`,
      reserve: `${process.env.TEST_RESERVE_HOUR}:${process.env.TEST_RESERVE_MINUTE}`
    }
  });
});

// 수동 로그인 API
app.post('/api/login', async (req, res) => {
  try {
    console.log('수동 로그인 시작');
    const result = await busReservation.login();
    res.json({ success: true, message: '로그인 성공' });
  } catch (error) {
    console.error('로그인 처리 중 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

// 예약 시작 API
app.post('/api/reserve/manual', async (req, res) => {
  try {
    console.log('수동 예약 시작');
    const result = await busReservation.startReservation();
    res.json(result);
  } catch (error) {
    console.error('예약 처리 중 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

// 예약 상태 업데이트 함수
async function updateStatus(status) {
  try {
    await db.collection('status').doc('current').set({
      currentState: status,
      lastUpdated: new Date().toISOString()
    }, { merge: true });
    console.log(`상태 업데이트: ${status}`);
  } catch (error) {
    console.error('상태 업데이트 실패:', error);
  }
}

// 필요한 상태 변수
let isLoginCompleted = false;
let schedulerActive = false;
let schedulerInterval = null;

// 정밀 타이머 스케줄링 (500ms마다 체크)
function startPreciseScheduler() {
  if (schedulerActive) return;
  
  console.log('정밀 예약 스케줄러 시작');
  schedulerActive = true;
  
  // 기존 인터벌이 있으면 제거
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }
  
  // 500ms마다 시간 체크
  schedulerInterval = setInterval(async () => {
    const now = new Date();
    const day = now.getDay(); // 0(일) ~ 6(토)
    
    // 테스트 모드가 아닐 경우 일, 월, 화요일만 실행 (0, 1, 2)
    if (TEST_MODE || day <= 2) {
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const milliseconds = now.getMilliseconds();
      
      // 로그인 실행 (한 번만)
      const loginHour = TEST_MODE ? TEST_HOUR : 20;
      const loginMinute = TEST_MODE ? TEST_LOGIN_MINUTE : 57;
      
      if (hours === loginHour && minutes === loginMinute && seconds < 30 && !isLoginCompleted) {
        isLoginCompleted = true;
        console.log(`정밀 예약 준비 시작 (${loginHour}:${loginMinute})`);
        await updateStatus('preparing');
        
        try {
          // 사용자 로그인
          await busReservation.login();
          console.log('로그인 성공');
          await updateStatus('waiting');
        } catch (error) {
          console.error('로그인 실패:', error);
          await notification.sendAlert('로그인 실패', error.message);
          await updateStatus('error');
        }
      }
      
      // 예약 실행 시간 설정
      const reserveHour = TEST_MODE ? TEST_RESERVE_HOUR : 21;
      const reserveMinute = TEST_MODE ? TEST_RESERVE_MINUTE : 0;
      
      // 정확히 예약 시간에 최대한 가깝게 예약 실행
      if (hours === reserveHour && minutes === reserveMinute && seconds === 0 && milliseconds < 500) {
        console.log(`정밀 예약 실행 시작 (${reserveHour}:${reserveMinute}:00)`, new Date().toISOString());
        await updateStatus('running');
        
        try {
          const result = await busReservation.startReservation();
          console.log('예약 완료:', result);
          await notification.sendSuccess(result);
          await updateStatus('idle');
        } catch (error) {
          console.error('예약 실패:', error);
          await notification.sendAlert('예약 실패', error.message);
          await updateStatus('error');
        }
        
        // 예약 후 상태 초기화
        isLoginCompleted = false;
      }
      
      // 매일 밤 12시에 상태 초기화
      if (hours === 0 && minutes === 0 && seconds === 0 && milliseconds < 500) {
        isLoginCompleted = false;
        console.log('일일 상태 초기화 완료');
      }
    }
  }, 500); // 500ms마다 체크
}

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
  logger.saveLogToFirestore('info', '서버 시작됨', {
    type: 'server',
    port: PORT,
    environment: process.env.K_SERVICE ? 'cloudrun' : 'local',
    testMode: TEST_MODE
  });
  updateStatus('idle');
  
  // 정밀 스케줄러 시작
  startPreciseScheduler();
}); 