/**
 * 대진대학교 버스 예약 자동화 매크로 - 백엔드
 */
require('dotenv').config();
const express = require('express');
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

// 상태 확인 API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'active',
    serverTime: new Date().toISOString(),
    nextScheduled: busReservation.getNextSchedule()
  });
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

// 예약 스케줄링 (일, 월, 화 21:00 정각)
cron.schedule('57 20 * * 0,1,2', async () => {
  console.log('예약 준비 시작 (20:57)');
  await updateStatus('preparing');
  
  try {
    // 사용자 로그인
    await busReservation.login();
    console.log('로그인 성공');
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