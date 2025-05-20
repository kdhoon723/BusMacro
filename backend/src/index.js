/**
 * 대진대학교 버스 예약 자동화 매크로 - 백엔드
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const cron = require('node-cron');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const busReservation = require('./services/busReservation');
const notification = require('./services/notification');

// Firebase 초기화
const firebaseConfig = {
  credential: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
};
initializeApp(firebaseConfig);
const db = getFirestore();

// Express 서버 설정
const app = express();
const PORT = process.env.PORT || 3000;

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

// 상태 확인 API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'active',
    serverTime: new Date().toISOString(),
    nextScheduled: busReservation.getNextSchedule()
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

// 예약 스케줄링 (일, 월, 화 20:57에 로그인)
cron.schedule('57 20 * * 0,1,2', async () => {
  console.log('예약 준비 시작 (20:57)');
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
});

// 정확히 21:00에 예약 실행
cron.schedule('0 21 * * 0,1,2', async () => {
  console.log('예약 실행 시작 (21:00)');
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
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
  updateStatus('idle');
}); 