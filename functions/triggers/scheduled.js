const { onSchedule } = require('firebase-functions/v2/scheduler');
const AuthService = require('../services/auth');
const ReservationService = require('../services/reservation');
const FirestoreService = require('../services/firestore');

const authService = new AuthService();
const reservationService = new ReservationService();
const firestoreService = new FirestoreService();

// 실패 원인 분석 헬퍼 함수
function getTopFailureReasons(failedLogs) {
  const reasonCounts = {};
  
  failedLogs.forEach(log => {
    const reason = log.errorMessage || 'Unknown';
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  });

  return Object.entries(reasonCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));
}

// ========== 사전 로그인 프로세스 (20:59:00) ==========
exports.preLogin = onSchedule({
  schedule: '59 20 * * 1-5',
  region: 'asia-northeast3',
  memory: '2GiB',
  timeoutSeconds: 540
}, async (event) => {
  console.log('🔐 사전 로그인 프로세스 시작');
  
  try {
    const activeUsers = await firestoreService.getActiveUsers();
    console.log(`활성 사용자 ${activeUsers.length}명 사전 로그인 시작`);
    
    // 사전 로그인 로그 생성
    const preLoginLogId = await firestoreService.createReservationLog({
      action: 'preLogin',
      status: 'pending',
      userCount: activeUsers.length,
      attemptTime: new Date()
    });

    const userIds = activeUsers.map(user => user.id);
    const batchResult = await authService.batchLogin(userIds);
    
    // 사전 로그인 결과 업데이트
    await firestoreService.updateReservationLog(preLoginLogId, {
      status: 'completed',
      successCount: batchResult.success,
      failedCount: batchResult.failed,
      details: {
        total: batchResult.total,
        results: batchResult.results.slice(0, 10) // 처음 10개만 저장
      }
    });

    console.log(`✅ 사전 로그인 완료: ${batchResult.success}/${batchResult.total} 성공`);
    
    // 세션 정리
    await authService.cleanupOldSessions(24);
    
  } catch (error) {
    console.error('❌ 사전 로그인 프로세스 실패:', error);
    
    // 실패 로그 저장
    await firestoreService.createReservationLog({
      action: 'preLogin',
      status: 'failed',
      errorMessage: error.message,
      attemptTime: new Date()
    });
  }
});

// ========== 정확한 예약 실행 (21:00:00) ==========
exports.executeReservation = onSchedule({
  schedule: '0 21 * * 1-5',
  region: 'asia-northeast3',
  memory: '2GiB',
  timeoutSeconds: 540
}, async (event) => {
  console.log('🚌 예약 실행 프로세스 시작');
  
  try {
    const reservations = await firestoreService.getTodayReservations();
    console.log(`오늘의 예약 설정 ${reservations.length}개 실행 시작`);
    
    if (reservations.length === 0) {
      console.log('오늘 실행할 예약이 없습니다.');
      return;
    }

    // 정확한 21:00:00 타이밍 조정
    const now = new Date();
    const targetTime = new Date();
    targetTime.setHours(21, 0, 0, 0);
    
    const delay = targetTime.getTime() - now.getTime();
    
    if (delay > 0 && delay < 10000) { // 10초 이내면 대기
      console.log(`⏰ ${delay}ms 후 정확한 시간에 실행됩니다.`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const actualExecutionTime = new Date();
    console.log(`🎯 실제 실행 시간: ${actualExecutionTime.toISOString()}`);

    // 예약 요청 준비
    const reservationRequests = [];
    
    for (const reservation of reservations) {
      try {
        // 로그인된 세션 확인/재로그인
        const authResult = await authService.login(reservation.userId);
        
        reservationRequests.push({
          userId: reservation.userId,
          requestUtil: authResult.requestUtil,
          authToken: authResult.authToken,
          targetRoute: reservation.targetRoute,
          targetTime: reservation.targetTime,
          preferredSeats: reservation.preferredSeats || []
        });
        
      } catch (loginError) {
        console.error(`[${reservation.userId}] 로그인 실패:`, loginError.message);
        
        // 로그인 실패 로그 저장
        await firestoreService.createReservationLog({
          userId: reservation.userId,
          action: 'reservation',
          status: 'failed',
          errorMessage: `로그인 실패: ${loginError.message}`,
          attemptTime: actualExecutionTime
        });
      }
    }

    console.log(`로그인 성공한 사용자 ${reservationRequests.length}명 예약 실행`);

    // 대량 예약 실행
    const batchResult = await reservationService.batchReservation(reservationRequests);

    // 각 결과를 개별 로그로 저장
    for (const result of batchResult.results) {
      if (result.success) {
        await firestoreService.createReservationLog({
          userId: result.userId,
          action: 'reservation',
          status: 'success',
          targetRoute: result.route,
          targetTime: result.time,
          seatNumber: result.seatNumber,
          executionTimeMs: result.executionTimeMs,
          attemptTime: actualExecutionTime
        });
      } else {
        await firestoreService.createReservationLog({
          userId: result.userId,
          action: 'reservation',
          status: 'failed',
          errorMessage: result.error,
          executionTimeMs: result.executionTimeMs,
          attemptTime: actualExecutionTime
        });
      }
    }

    console.log(`🎯 예약 실행 완료: ${batchResult.success}/${batchResult.total} 성공`);
    
    // 전체 실행 결과 로그 저장
    await firestoreService.createReservationLog({
      action: 'batchReservation',
      status: 'completed',
      totalRequests: batchResult.total,
      successCount: batchResult.success,
      failedCount: batchResult.failed,
      executionTime: actualExecutionTime,
      summary: {
        successRate: batchResult.total > 0 ? (batchResult.success / batchResult.total * 100).toFixed(1) : 0,
        averageExecutionTime: batchResult.results
          .filter(r => r.executionTimeMs)
          .reduce((sum, r) => sum + r.executionTimeMs, 0) / Math.max(batchResult.results.length, 1)
      },
      attemptTime: actualExecutionTime
    });
    
  } catch (error) {
    console.error('❌ 예약 실행 프로세스 실패:', error);
    
    // 전체 실패 로그 저장
    await firestoreService.createReservationLog({
      action: 'batchReservation',
      status: 'failed',
      errorMessage: error.message,
      attemptTime: new Date()
    });
  }
});

// ========== 상태 모니터링 (매 30초, 20-21시) ==========
exports.monitorReservation = onSchedule({
  schedule: '*/30 20-21 * * 1-5',
  region: 'asia-northeast3',
  memory: '2GiB',
  timeoutSeconds: 540
}, async (event) => {
  try {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // 진행중인 예약들의 상태 확인
    const pendingLogsSnapshot = await firestoreService.db
      .collection('reservationLogs')
      .where('status', '==', 'pending')
      .where('createdAt', '>=', new Date(Date.now() - 3600000)) // 1시간 이내
      .get();

    if (!pendingLogsSnapshot.empty) {
      console.log(`📊 진행중인 예약: ${pendingLogsSnapshot.size}개`);
    }

    // 20:58 이후부터 세부 모니터링
    if (hour === 20 && minute >= 58) {
      const activeUsers = await firestoreService.getActiveUsers();
      const todayReservations = await firestoreService.getTodayReservations();
      
      console.log(`📊 모니터링 - 활성사용자: ${activeUsers.length}, 오늘예약: ${todayReservations.length}`);
      
      // 시스템 상태 로그 저장
      await firestoreService.createReservationLog({
        action: 'systemMonitoring',
        status: 'info',
        activeUsers: activeUsers.length,
        todayReservations: todayReservations.length,
        currentTime: now.toISOString(),
        attemptTime: now
      });
    }
    
  } catch (error) {
    console.error('모니터링 실패:', error);
  }
});

// ========== 일일 세션 정리 (매일 23:00) ==========
exports.dailyCleanup = onSchedule({
  schedule: '0 23 * * *',
  region: 'asia-northeast3',
  memory: '2GiB',
  timeoutSeconds: 540
}, async (event) => {
  console.log('🧹 일일 정리 작업 시작');
  
  try {
    // 오래된 세션 정리
    await authService.cleanupOldSessions(12); // 12시간 이상 된 세션
    
    // 오래된 로그 정리 (30일 이상)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const oldLogsSnapshot = await firestoreService.db
      .collection('reservationLogs')
      .where('createdAt', '<', thirtyDaysAgo)
      .limit(100) // 한 번에 100개씩
      .get();

    if (!oldLogsSnapshot.empty) {
      const batch = firestoreService.db.batch();
      oldLogsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`오래된 로그 ${oldLogsSnapshot.size}개 정리 완료`);
    }

    // 비활성 사용자 체크
    const inactiveUsersSnapshot = await firestoreService.db
      .collection('users')
      .where('isActive', '==', true)
      .where('lastLogin', '<', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // 7일 이상 미로그인
      .get();

    if (!inactiveUsersSnapshot.empty) {
      console.log(`⚠️  비활성 사용자 ${inactiveUsersSnapshot.size}명 발견`);
    }

    console.log('✅ 일일 정리 작업 완료');
    
  } catch (error) {
    console.error('❌ 일일 정리 작업 실패:', error);
  }
});

// ========== 주간 통계 생성 (매주 일요일 22:00) ==========
exports.weeklyReport = onSchedule({
  schedule: '0 22 * * 0',
  region: 'asia-northeast3',
  memory: '2GiB',
  timeoutSeconds: 540
}, async (event) => {
  console.log('📊 주간 통계 생성 시작');
  
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // 지난 주 예약 로그 분석
    const weeklyLogsSnapshot = await firestoreService.db
      .collection('reservationLogs')
      .where('createdAt', '>=', oneWeekAgo)
      .where('action', '==', 'reservation')
      .get();

    const weeklyLogs = weeklyLogsSnapshot.docs.map(doc => doc.data());
    const successLogs = weeklyLogs.filter(log => log.status === 'success');
    const failedLogs = weeklyLogs.filter(log => log.status === 'failed');

    const weeklyStats = {
      week: new Date().toISOString().slice(0, 10),
      total: weeklyLogs.length,
      success: successLogs.length,
      failed: failedLogs.length,
      successRate: weeklyLogs.length > 0 ? (successLogs.length / weeklyLogs.length * 100).toFixed(1) : 0,
      averageExecutionTime: successLogs.length > 0 
        ? (successLogs.reduce((sum, log) => sum + (log.executionTimeMs || 0), 0) / successLogs.length).toFixed(0)
        : 0,
      topFailureReasons: getTopFailureReasons(failedLogs)
    };

    // 주간 통계 저장
    await firestoreService.db.collection('weeklyStats').add({
      ...weeklyStats,
      createdAt: new Date()
    });

    console.log('📈 주간 통계:', weeklyStats);
    console.log('✅ 주간 통계 생성 완료');
    
  } catch (error) {
    console.error('❌ 주간 통계 생성 실패:', error);
  }
});

// ========== 확장된 스케줄 시스템 (요일별 + 시간별) ==========

// 21시 예약용 사전 로그인 (20:59)
exports.preLogin21 = onSchedule({
  schedule: '59 20 * * 0,1,2,3,4', // 일~목요일
  region: 'asia-northeast3',
  memory: '2GiB',
  timeoutSeconds: 540
}, async (event) => {
  console.log('🔐 21시 예약용 사전 로그인 프로세스 시작');
  
  try {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0:일, 1:월, 2:화, 3:수, 4:목
    const targetDay = getTargetBusDay(dayOfWeek); // 다음날 버스 예약 대상
    
    if (!targetDay) {
      console.log('21시 예약 대상일이 아닙니다.');
      return;
    }

    // 21시 실행 대상 사용자들 (노원 제외)
    const users = await firestoreService.getTodayExecutionTargets(targetDay, '21:00');
    
    if (users.length === 0) {
      console.log('21시 예약 대상 사용자가 없습니다.');
      return;
    }

    console.log(`21시 예약용 사전 로그인 시작: ${users.length}명`);
    
    const userIds = users.map(user => user.userId);
    const batchResult = await authService.batchLogin(userIds);
    
    console.log(`✅ 21시 사전 로그인 완료: ${batchResult.success}/${batchResult.total} 성공`);
    
    // 세션 정리
    await authService.cleanupOldSessions(24);
    
  } catch (error) {
    console.error('❌ 21시 사전 로그인 프로세스 실패:', error);
  }
});

// 22시 예약용 사전 로그인 (21:59)
exports.preLogin22 = onSchedule({
  schedule: '59 21 * * 0,1,2,3,4', // 일~목요일
  region: 'asia-northeast3',
  memory: '2GiB',
  timeoutSeconds: 540
}, async (event) => {
  console.log('🔐 22시 예약용 사전 로그인 프로세스 시작');
  
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const targetDay = getTargetBusDay(dayOfWeek);
    
    if (!targetDay) {
      console.log('22시 예약 대상일이 아닙니다.');
      return;
    }

    // 22시 실행 대상 사용자들 (노원만)
    const users = await firestoreService.getTodayExecutionTargets(targetDay, '22:00');
    
    if (users.length === 0) {
      console.log('22시 예약 대상 사용자가 없습니다.');
      return;
    }

    console.log(`22시 예약용 사전 로그인 시작: ${users.length}명`);
    
    const userIds = users.map(user => user.userId);
    const batchResult = await authService.batchLogin(userIds);
    
    console.log(`✅ 22시 사전 로그인 완료: ${batchResult.success}/${batchResult.total} 성공`);
    
  } catch (error) {
    console.error('❌ 22시 사전 로그인 프로세스 실패:', error);
  }
});

// 일요일 21시 예약 실행 (월요일 버스 - 노원 제외)
exports.executeReservationSun21 = onSchedule({
  schedule: '0 21 * * 0', // 일요일 21:00
  region: 'asia-northeast3',
  memory: '2GiB',
  timeoutSeconds: 540
}, async (event) => {
  await executeReservationForTimeSlot('monday', '21:00', '일요일 21시');
});

// 일요일 22시 예약 실행 (월요일 버스 - 노원만)
exports.executeReservationSun22 = onSchedule({
  schedule: '0 22 * * 0', // 일요일 22:00
  region: 'asia-northeast3',
  memory: '2GiB',
  timeoutSeconds: 540
}, async (event) => {
  await executeReservationForTimeSlot('monday', '22:00', '일요일 22시');
});

// 월요일 21시 예약 실행 (화요일 버스 - 노원 제외)
exports.executeReservationMon21 = onSchedule({
  schedule: '0 21 * * 1', // 월요일 21:00
  region: 'asia-northeast3',
  memory: '2GiB',
  timeoutSeconds: 540
}, async (event) => {
  await executeReservationForTimeSlot('tuesday', '21:00', '월요일 21시');
});

// 월요일 22시 예약 실행 (화요일 버스 - 노원만)
exports.executeReservationMon22 = onSchedule({
  schedule: '0 22 * * 1', // 월요일 22:00
  region: 'asia-northeast3',
  memory: '2GiB',
  timeoutSeconds: 540
}, async (event) => {
  await executeReservationForTimeSlot('tuesday', '22:00', '월요일 22시');
});

// 화요일 21시 예약 실행 (수요일 버스 - 노원 제외)
exports.executeReservationTue21 = onSchedule({
  schedule: '0 21 * * 2', // 화요일 21:00
  region: 'asia-northeast3',
  memory: '2GiB',
  timeoutSeconds: 540
}, async (event) => {
  await executeReservationForTimeSlot('wednesday', '21:00', '화요일 21시');
});

// 화요일 22시 예약 실행 (수요일 버스 - 노원만)
exports.executeReservationTue22 = onSchedule({
  schedule: '0 22 * * 2', // 화요일 22:00
  region: 'asia-northeast3',
  memory: '2GiB',
  timeoutSeconds: 540
}, async (event) => {
  await executeReservationForTimeSlot('wednesday', '22:00', '화요일 22시');
});

// 수요일 21시 예약 실행 (목요일 버스 - 노원 제외)
exports.executeReservationWed21 = onSchedule({
  schedule: '0 21 * * 3', // 수요일 21:00
  region: 'asia-northeast3',
  memory: '2GiB',
  timeoutSeconds: 540
}, async (event) => {
  await executeReservationForTimeSlot('thursday', '21:00', '수요일 21시');
});

// 수요일 22시 예약 실행 (목요일 버스 - 노원만)
exports.executeReservationWed22 = onSchedule({
  schedule: '0 22 * * 3', // 수요일 22:00
  region: 'asia-northeast3',
  memory: '2GiB',
  timeoutSeconds: 540
}, async (event) => {
  await executeReservationForTimeSlot('thursday', '22:00', '수요일 22시');
});

// 목요일 21시 예약 실행 (금요일 버스 - 노원 제외)
exports.executeReservationThu21 = onSchedule({
  schedule: '0 21 * * 4', // 목요일 21:00
  region: 'asia-northeast3',
  memory: '2GiB',
  timeoutSeconds: 540
}, async (event) => {
  await executeReservationForTimeSlot('friday', '21:00', '목요일 21시');
});

// 목요일 22시 예약 실행 (금요일 버스 - 노원만)
exports.executeReservationThu22 = onSchedule({
  schedule: '0 22 * * 4', // 목요일 22:00
  region: 'asia-northeast3',
  memory: '2GiB',
  timeoutSeconds: 540
}, async (event) => {
  await executeReservationForTimeSlot('friday', '22:00', '목요일 22시');
});

// ========== 헬퍼 함수들 ==========

// 예약 실행 공통 로직
async function executeReservationForTimeSlot(targetBusDay, timeSlot, executionLabel) {
  console.log(`🚌 ${executionLabel} 예약 실행 프로세스 시작 (대상: ${targetBusDay} 버스)`);
  
  try {
    // 실행 대상 사용자들 조회
    const users = await firestoreService.getTodayExecutionTargets(targetBusDay, timeSlot);
    
    if (users.length === 0) {
      console.log(`${executionLabel} 실행 대상 사용자가 없습니다.`);
      return;
    }

    console.log(`${executionLabel} 예약 실행: ${users.length}명 대상`);

    // 정확한 실행 시간 조정
    const now = new Date();
    const [targetHour, targetMinute] = timeSlot.split(':').map(Number);
    const targetTime = new Date();
    targetTime.setHours(targetHour, targetMinute, 0, 0);
    
    const delay = targetTime.getTime() - now.getTime();
    
    if (delay > 0 && delay < 10000) { // 10초 이내면 대기
      console.log(`⏰ ${delay}ms 후 정확한 시간에 실행됩니다.`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const actualExecutionTime = new Date();
    console.log(`🎯 실제 실행 시간: ${actualExecutionTime.toISOString()}`);

    // 예약 요청 준비
    const reservationRequests = [];
    
    for (const user of users) {
      try {
        // 로그인된 세션 확인/재로그인
        const authResult = await authService.login(user.userId);
        
        reservationRequests.push({
          userId: user.userId,
          requestUtil: authResult.requestUtil,
          authToken: authResult.authToken,
          targetRoute: user.route,
          targetTime: user.time,
          preferredSeats: user.seats || []
        });
        
      } catch (loginError) {
        console.error(`[${user.userId}] 로그인 실패:`, loginError.message);
        
        // 로그인 실패 로그 저장
        await firestoreService.createReservationLog({
          userId: user.userId,
          action: 'reservation',
          status: 'failed',
          errorMessage: `로그인 실패: ${loginError.message}`,
          targetBusDay: targetBusDay,
          timeSlot: timeSlot,
          attemptTime: actualExecutionTime
        });
      }
    }

    console.log(`로그인 성공한 사용자 ${reservationRequests.length}명 예약 실행`);

    // 대량 예약 실행
    const batchResult = await reservationService.batchReservation(reservationRequests);

    // 각 결과를 개별 로그로 저장
    for (const result of batchResult.results) {
      if (result.success) {
        await firestoreService.createReservationLog({
          userId: result.userId,
          action: 'reservation',
          status: 'success',
          targetRoute: result.route,
          targetTime: result.time,
          seatNumber: result.seatNumber,
          executionTimeMs: result.executionTimeMs,
          targetBusDay: targetBusDay,
          timeSlot: timeSlot,
          attemptTime: actualExecutionTime
        });
      } else {
        await firestoreService.createReservationLog({
          userId: result.userId,
          action: 'reservation',
          status: 'failed',
          errorMessage: result.error,
          executionTimeMs: result.executionTimeMs,
          targetBusDay: targetBusDay,
          timeSlot: timeSlot,
          attemptTime: actualExecutionTime
        });
      }
    }

    console.log(`🎯 ${executionLabel} 예약 실행 완료: ${batchResult.success}/${batchResult.total} 성공`);
    
    // 전체 실행 결과 로그 저장
    await firestoreService.createReservationLog({
      action: 'batchReservation',
      status: 'completed',
      executionLabel: executionLabel,
      targetBusDay: targetBusDay,
      timeSlot: timeSlot,
      totalRequests: batchResult.total,
      successCount: batchResult.success,
      failedCount: batchResult.failed,
      executionTime: actualExecutionTime,
      summary: {
        successRate: batchResult.total > 0 ? (batchResult.success / batchResult.total * 100).toFixed(1) : 0,
        averageExecutionTime: batchResult.results
          .filter(r => r.executionTimeMs)
          .reduce((sum, r) => sum + r.executionTimeMs, 0) / Math.max(batchResult.results.length, 1)
      },
      attemptTime: actualExecutionTime
    });
    
  } catch (error) {
    console.error(`❌ ${executionLabel} 예약 실행 프로세스 실패:`, error);
    
    // 전체 실패 로그 저장
    await firestoreService.createReservationLog({
      action: 'batchReservation',
      status: 'failed',
      executionLabel: executionLabel,
      targetBusDay: targetBusDay,
      timeSlot: timeSlot,
      errorMessage: error.message,
      attemptTime: new Date()
    });
  }
}

// 목표 버스 요일 계산
function getTargetBusDay(currentDayOfWeek) {
  // 0:일, 1:월, 2:화, 3:수, 4:목, 5:금, 6:토
  const targetMap = {
    0: 'monday',    // 일요일 → 월요일 버스
    1: 'tuesday',   // 월요일 → 화요일 버스
    2: 'wednesday', // 화요일 → 수요일 버스
    3: 'thursday',  // 수요일 → 목요일 버스
    4: 'friday'     // 목요일 → 금요일 버스
  };
  
  return targetMap[currentDayOfWeek] || null;
} 