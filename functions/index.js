/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

/**
 * Firebase Functions - 대진대 버스 예약 자동화 시스템
 * 
 * HTTP 트리거 함수들:
 * - addUser: 사용자 추가
 * - updateUser: 사용자 정보 수정  
 * - deleteUser: 사용자 삭제
 * - testLogin: 로그인 테스트
 * - setReservation: 예약 설정
 * - executeReservation: 수동 예약 실행
 * - getReservationStatus: 예약 상태 조회
 * - cancelReservation: 예약 취소
 * - getSystemStatus: 시스템 상태 조회
 * - getRoutes: 노선 정보 조회
 * - getBusTimetable: 버스 시간표 조회
 * 
 * 스케줄 함수들:
 * - preLogin: 사전 로그인 (매일 20:59)
 * - executeReservation: 자동 예약 실행 (매일 21:00)
 * - monitorReservation: 상태 모니터링 (매 30초, 20-21시)
 * - dailyCleanup: 일일 정리 (매일 23:00)
 * - weeklyReport: 주간 통계 (매주 일요일 22:00)
 */

// ========== HTTP 트리거 함수들 ==========
const httpTriggers = require('./triggers/http');

// 사용자 관리
exports.addUser = httpTriggers.addUser;
exports.updateUser = httpTriggers.updateUser;
exports.deleteUser = httpTriggers.deleteUser;
exports.testLogin = httpTriggers.testLogin;

// 예약 관리
exports.setReservation = httpTriggers.setReservation;
exports.executeReservation = httpTriggers.executeReservation;
exports.getReservationStatus = httpTriggers.getReservationStatus;
exports.cancelReservation = httpTriggers.cancelReservation;

// 주간 스케줄 관리 (확장)
exports.getWeeklySchedule = httpTriggers.getWeeklySchedule;
exports.setWeeklySchedule = httpTriggers.setWeeklySchedule;
exports.updateDaySchedule = httpTriggers.updateDaySchedule;
exports.previewReservation = httpTriggers.previewReservation;
exports.getRouteScheduleInfo = httpTriggers.getRouteScheduleInfo;

// 시스템 상태
exports.getSystemStatus = httpTriggers.getSystemStatus;
exports.getRoutes = httpTriggers.getRoutes;
exports.getBusTimetable = httpTriggers.getBusTimetable;

// ========== 스케줄 함수들 ==========
const scheduledTriggers = require('./triggers/scheduled');

// 자동 스케줄 함수들
exports.preLogin = scheduledTriggers.preLogin;
exports.executeReservation = scheduledTriggers.executeReservation;
exports.monitorReservation = scheduledTriggers.monitorReservation;
exports.dailyCleanup = scheduledTriggers.dailyCleanup;
exports.weeklyReport = scheduledTriggers.weeklyReport;

// 확장 스케줄 함수 (요일별 + 시간별)
exports.preLogin21 = scheduledTriggers.preLogin21;
exports.preLogin22 = scheduledTriggers.preLogin22;
exports.executeReservationSun21 = scheduledTriggers.executeReservationSun21;
exports.executeReservationSun22 = scheduledTriggers.executeReservationSun22;
exports.executeReservationMon21 = scheduledTriggers.executeReservationMon21;
exports.executeReservationMon22 = scheduledTriggers.executeReservationMon22;
exports.executeReservationTue21 = scheduledTriggers.executeReservationTue21;
exports.executeReservationTue22 = scheduledTriggers.executeReservationTue22;
exports.executeReservationWed21 = scheduledTriggers.executeReservationWed21;
exports.executeReservationWed22 = scheduledTriggers.executeReservationWed22;
exports.executeReservationThu21 = scheduledTriggers.executeReservationThu21;
exports.executeReservationThu22 = scheduledTriggers.executeReservationThu22;

// ========== 개발/디버깅용 함수 ==========

// 시스템 정보 조회
exports.getSystemInfo = onRequest({ 
  cors: true, 
  region: 'asia-northeast3',
  memory: '1GiB',
  timeoutSeconds: 300 
}, async (req, res) => {
  try {
    const packageInfo = require('./package.json');
    
    res.json({
      success: true,
      data: {
        name: packageInfo.name || 'Firebase Bus Reservation System',
        version: packageInfo.version || '1.0.0',
        node: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'production',
        region: 'asia-northeast3',
        timezone: 'Asia/Seoul',
        timestamp: new Date().toISOString(),
        functions: {
          http: [
            'addUser', 'updateUser', 'deleteUser', 'testLogin',
            'setReservation', 'executeReservation', 'getReservationStatus', 'cancelReservation',
            'getSystemStatus', 'getRoutes', 'getBusTimetable'
          ],
          scheduled: [
            'preLogin', 'executeReservationScheduled', 'monitorReservation',
            'dailyCleanup', 'weeklyReport'
          ]
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 헬스 체크
exports.healthCheck = onRequest({ 
  cors: true, 
  region: 'asia-northeast3',
  memory: '1GiB',
  timeoutSeconds: 300 
}, async (req, res) => {
  try {
    const FirestoreService = require('./services/firestore');
    const firestoreService = new FirestoreService();
    
    // Firestore 연결 테스트
    const testDoc = await firestoreService.db.collection('health').doc('test').get();
    
    res.json({
      success: true,
      status: 'healthy',
      services: {
        firestore: 'connected',
        functions: 'running'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

console.log('🚀 Firebase Functions 초기화 완료 - 대진대 버스 예약 시스템');
