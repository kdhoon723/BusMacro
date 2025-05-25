const { onRequest } = require('firebase-functions/v2/https');
const AuthService = require('../services/auth');
const ReservationService = require('../services/reservation');
const FirestoreService = require('../services/firestore');

const authService = new AuthService();
const reservationService = new ReservationService();
const firestoreService = new FirestoreService();

// ========== 사용자 관리 API ==========

// 사용자 추가
exports.addUser = onRequest({ 
  cors: true,
  region: 'asia-northeast3',
  memory: '1GiB',
  timeoutSeconds: 300 
}, async (req, res) => {
  try {
    const { userId, studentId, password, name } = req.body;
    
    if (!userId || !studentId || !password) {
      return res.status(400).json({ 
        success: false, 
        message: '필수 정보가 누락되었습니다. (userId, studentId, password)' 
      });
    }

    console.log(`새 사용자 추가 시도: ${userId}`);

    // 사용자 생성
    await firestoreService.createUser(userId, {
      studentId,
      password, // 실제로는 암호화 필요
      name: name || '익명'
    });

    // 로그인 테스트
    try {
      await authService.login(userId);
      console.log(`사용자 추가 및 로그인 테스트 성공: ${userId}`);
      
      res.json({ 
        success: true, 
        message: '사용자가 성공적으로 추가되었습니다.',
        userId: userId
      });
    } catch (loginError) {
      // 로그인 실패 시 사용자 삭제
      await firestoreService.deleteUser(userId);
      throw new Error(`로그인 테스트 실패: ${loginError.message}`);
    }
  } catch (error) {
    console.error('사용자 추가 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// 사용자 정보 수정
exports.updateUser = onRequest({ 
  cors: true,
  region: 'asia-northeast3',
  memory: '1GiB',
  timeoutSeconds: 300 
}, async (req, res) => {
  try {
    const { userId, studentId, password, name, isActive } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'userId가 필요합니다.' 
      });
    }

    const updates = {};
    if (studentId) updates.studentId = studentId;
    if (password) updates.password = password; // 실제로는 암호화 필요
    if (name) updates.name = name;
    if (typeof isActive === 'boolean') updates.isActive = isActive;

    await firestoreService.updateUser(userId, updates);
    
    res.json({ 
      success: true, 
      message: '사용자 정보가 수정되었습니다.',
      userId: userId
    });
  } catch (error) {
    console.error('사용자 정보 수정 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// 사용자 삭제
exports.deleteUser = onRequest({ 
  cors: true,
  region: 'asia-northeast3',
  memory: '1GiB',
  timeoutSeconds: 300 
}, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'userId가 필요합니다.' 
      });
    }

    await firestoreService.deleteUser(userId);
    
    res.json({ 
      success: true, 
      message: '사용자가 삭제되었습니다.',
      userId: userId
    });
  } catch (error) {
    console.error('사용자 삭제 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// 로그인 테스트
exports.testLogin = onRequest({ 
  cors: true,
  region: 'asia-northeast3',
  memory: '1GiB',
  timeoutSeconds: 300 
}, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'userId가 필요합니다.' 
      });
    }

    const result = await authService.login(userId);
    
    res.json({ 
      success: true, 
      message: '로그인 성공',
      authToken: result.authToken,
      reusedSession: result.reusedSession
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ========== 예약 관리 API ==========

// 예약 설정 저장
exports.setReservation = onRequest({ 
  cors: true,
  region: 'asia-northeast3',
  memory: '1GiB',
  timeoutSeconds: 300 
}, async (req, res) => {
  try {
    const { userId, targetRoute, targetTime, preferredSeats, autoReserve } = req.body;
    
    if (!userId || !targetRoute || !targetTime) {
      return res.status(400).json({ 
        success: false, 
        message: '필수 정보가 누락되었습니다. (userId, targetRoute, targetTime)' 
      });
    }

    await firestoreService.setReservationSettings(userId, {
      targetRoute,
      targetTime,
      preferredSeats: preferredSeats || [],
      autoReserve: autoReserve !== false
    });

    res.json({ 
      success: true, 
      message: '예약 설정이 저장되었습니다.',
      settings: {
        userId,
        targetRoute,
        targetTime,
        preferredSeats: preferredSeats || [],
        autoReserve: autoReserve !== false
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// 수동 예약 실행
exports.executeReservation = onRequest({ 
  cors: true,
  region: 'asia-northeast3',
  memory: '1GiB',
  timeoutSeconds: 300 
}, async (req, res) => {
  try {
    const { userId, targetRoute, targetTime, preferredSeats } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'userId가 필요합니다.' 
      });
    }

    // 로그인
    const authResult = await authService.login(userId);
    
    // 예약 실행
    const reservationResult = await reservationService.makeReservation(
      userId,
      authResult.requestUtil,
      authResult.authToken,
      targetRoute || '기본노선',
      targetTime || '21:00',
      preferredSeats || []
    );

    // 결과 로그 저장
    await firestoreService.createReservationLog({
      userId: userId,
      targetRoute: reservationResult.route,
      targetTime: reservationResult.time,
      status: 'success',
      seatNumber: reservationResult.seatNumber,
      executionTimeMs: reservationResult.executionTimeMs,
      attemptTime: new Date()
    });

    res.json({ 
      success: true, 
      message: '예약이 성공했습니다!',
      result: reservationResult
    });
  } catch (error) {
    // 실패 로그 저장
    try {
      await firestoreService.createReservationLog({
        userId: req.body.userId,
        status: 'failed',
        errorMessage: error.message,
        executionTimeMs: error.executionTimeMs || 0,
        attemptTime: new Date()
      });
    } catch (logError) {
      console.error('로그 저장 실패:', logError);
    }

    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// 예약 상태 조회
exports.getReservationStatus = onRequest({ 
  cors: true,
  region: 'asia-northeast3',
  memory: '1GiB',
  timeoutSeconds: 300 
}, async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'userId가 필요합니다.' 
      });
    }

    const settings = await firestoreService.getReservationSettings(userId);
    const user = await firestoreService.getUser(userId);
    const logs = await firestoreService.getReservationLogs(userId, 10);

    res.json({
      success: true,
      data: {
        user,
        settings,
        recentLogs: logs
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// 예약 취소
exports.cancelReservation = onRequest({ 
  cors: true,
  region: 'asia-northeast3',
  memory: '1GiB',
  timeoutSeconds: 300 
}, async (req, res) => {
  try {
    const { userId, reservationId } = req.body;
    
    if (!userId || !reservationId) {
      return res.status(400).json({ 
        success: false, 
        message: '필수 정보가 누락되었습니다. (userId, reservationId)' 
      });
    }

    // 로그인
    const authResult = await authService.login(userId);
    
    // 예약 취소
    const cancelResult = await reservationService.cancelReservation(
      userId,
      authResult.requestUtil,
      authResult.authToken,
      reservationId
    );

    res.json({ 
      success: true, 
      message: '예약이 취소되었습니다.',
      result: cancelResult
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ========== 주간 스케줄 관리 API (확장) ==========

// 주간 스케줄 조회
exports.getWeeklySchedule = onRequest({ 
  cors: true,
  region: 'asia-northeast3',
  memory: '1GiB',
  timeoutSeconds: 300 
}, async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'userId가 필요합니다.' 
      });
    }

    const weeklySchedule = await firestoreService.getWeeklySchedule(userId);
    
    res.json({ 
      success: true, 
      data: weeklySchedule
    });
  } catch (error) {
    console.error('주간 스케줄 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// 주간 스케줄 저장
exports.setWeeklySchedule = onRequest({ 
  cors: true,
  region: 'asia-northeast3',
  memory: '1GiB',
  timeoutSeconds: 300 
}, async (req, res) => {
  try {
    const { userId, weeklySchedule } = req.body;
    
    if (!userId || !weeklySchedule) {
      return res.status(400).json({ 
        success: false, 
        message: '필수 정보가 누락되었습니다. (userId, weeklySchedule)' 
      });
    }

    // 각 요일별 노선 정보 검증 및 시간 자동 설정
    const processedSchedule = {};
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    
    for (const day of validDays) {
      if (weeklySchedule[day]) {
        const daySchedule = weeklySchedule[day];
        
        // 노선별 자동 시간 설정
        if (daySchedule.enabled && daySchedule.route) {
          const isNowonRoute = daySchedule.route.includes('노원');
          daySchedule.time = isNowonRoute ? '22:00' : '21:00';
          daySchedule.executionDay = getDayBefore(day); // 실행일은 전날
        }
        
        processedSchedule[day] = daySchedule;
      }
    }

    await firestoreService.setWeeklySchedule(userId, processedSchedule);
    
    res.json({ 
      success: true, 
      message: '주간 스케줄이 저장되었습니다.',
      data: processedSchedule
    });
  } catch (error) {
    console.error('주간 스케줄 저장 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// 특정 요일 스케줄 업데이트
exports.updateDaySchedule = onRequest({ 
  cors: true,
  region: 'asia-northeast3',
  memory: '1GiB',
  timeoutSeconds: 300 
}, async (req, res) => {
  try {
    const { userId, dayOfWeek, daySchedule } = req.body;
    
    if (!userId || !dayOfWeek || !daySchedule) {
      return res.status(400).json({ 
        success: false, 
        message: '필수 정보가 누락되었습니다. (userId, dayOfWeek, daySchedule)' 
      });
    }

    // 노선별 자동 시간 설정
    if (daySchedule.enabled && daySchedule.route) {
      const isNowonRoute = daySchedule.route.includes('노원');
      daySchedule.time = isNowonRoute ? '22:00' : '21:00';
      daySchedule.executionDay = getDayBefore(dayOfWeek);
    }

    await firestoreService.updateDaySchedule(userId, dayOfWeek, daySchedule);
    
    res.json({ 
      success: true, 
      message: `${dayOfWeek} 스케줄이 업데이트되었습니다.`,
      data: daySchedule
    });
  } catch (error) {
    console.error('요일 스케줄 업데이트 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// 예약 미리보기 (실제 실행 전 확인용)
exports.previewReservation = onRequest({ 
  cors: true,
  region: 'asia-northeast3',
  memory: '1GiB',
  timeoutSeconds: 300 
}, async (req, res) => {
  try {
    const { userId, dayOfWeek } = req.query;
    
    if (!userId || !dayOfWeek) {
      return res.status(400).json({ 
        success: false, 
        message: '필수 정보가 누락되었습니다. (userId, dayOfWeek)' 
      });
    }

    const weeklySchedule = await firestoreService.getWeeklySchedule(userId);
    const daySchedule = weeklySchedule[dayOfWeek];
    
    if (!daySchedule || !daySchedule.enabled) {
      return res.json({ 
        success: true, 
        message: `${dayOfWeek}에는 예약이 설정되지 않았습니다.`,
        data: null
      });
    }

    // 로그인 테스트
    const authResult = await authService.login(userId);
    
    // 노선 정보 확인
    const routes = await reservationService.getRoutes(userId, authResult.requestUtil, authResult.authToken);
    const targetRoute = routes.down.find(route => route.lineName.includes(daySchedule.route));
    
    if (!targetRoute) {
      return res.json({
        success: false,
        message: `지정한 노선(${daySchedule.route})을 찾을 수 없습니다.`,
        data: null
      });
    }

    // 시간표 확인
    const timetable = await reservationService.getBusTimetable(
      userId, 
      authResult.requestUtil, 
      targetRoute.seq, 
      'DOWN'
    );

    const targetBus = timetable.timetable.find(bus => 
      bus.operateTime && bus.operateTime.includes(daySchedule.time)
    );

    const preview = {
      dayOfWeek: dayOfWeek,
      route: targetRoute.lineName,
      time: daySchedule.time,
      seats: daySchedule.seats,
      executionTime: daySchedule.time,
      executionDay: getDayBefore(dayOfWeek),
      busAvailable: !!targetBus,
      routeInfo: targetRoute
    };

    res.json({ 
      success: true, 
      message: '예약 미리보기 성공',
      data: preview
    });
  } catch (error) {
    console.error('예약 미리보기 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// 노선별 예약 시간 정보 조회
exports.getRouteScheduleInfo = onRequest({ 
  cors: true,
  region: 'asia-northeast3',
  memory: '1GiB',
  timeoutSeconds: 300 
}, async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'userId가 필요합니다.' 
      });
    }

    // 로그인 후 노선 정보 조회
    const authResult = await authService.login(userId);
    const routes = await reservationService.getRoutes(userId, authResult.requestUtil, authResult.authToken);
    
    // 노선별 예약 시간 정보 추가
    const routeScheduleInfo = {
      down: routes.down.map(route => ({
        ...route,
        executionTime: route.lineName.includes('노원') ? '22:00' : '21:00',
        isSpecialRoute: route.lineName.includes('노원'),
        description: route.lineName.includes('노원') ? 
                    '노원 노선 - 22시 정각 예약' : 
                    '일반 노선 - 21시 정각 예약'
      })),
      up: routes.up.map(route => ({
        ...route,
        executionTime: route.lineName.includes('노원') ? '22:00' : '21:00',
        isSpecialRoute: route.lineName.includes('노원'),
        description: route.lineName.includes('노원') ? 
                    '노원 노선 - 22시 정각 예약' : 
                    '일반 노선 - 21시 정각 예약'
      }))
    };

    res.json({ 
      success: true, 
      data: routeScheduleInfo
    });
  } catch (error) {
    console.error('노선 스케줄 정보 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// 헬퍼 함수: 전날 요일 계산
function getDayBefore(dayOfWeek) {
  const dayMap = {
    'monday': 'sunday',
    'tuesday': 'monday', 
    'wednesday': 'tuesday',
    'thursday': 'wednesday',
    'friday': 'thursday'
  };
  return dayMap[dayOfWeek];
}

// ========== 시스템 상태 API ==========

// 전체 시스템 상태 조회
exports.getSystemStatus = onRequest({ 
  cors: true,
  region: 'asia-northeast3',
  memory: '1GiB',
  timeoutSeconds: 300 
}, async (req, res) => {
  try {
    const activeUsers = await firestoreService.getActiveUsers();
    const todayReservations = await firestoreService.getTodayReservations();
    
    // 최근 24시간 로그 통계
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogsSnapshot = await firestoreService.db
      .collection('reservationLogs')
      .where('createdAt', '>=', last24Hours)
      .get();
    
    const recentLogs = recentLogsSnapshot.docs.map(doc => doc.data());
    const successCount = recentLogs.filter(log => log.status === 'success').length;
    const failedCount = recentLogs.filter(log => log.status === 'failed').length;

    res.json({
      success: true,
      data: {
        activeUsers: activeUsers.length,
        todayReservations: todayReservations.length,
        last24Hours: {
          total: recentLogs.length,
          success: successCount,
          failed: failedCount,
          successRate: recentLogs.length > 0 ? (successCount / recentLogs.length * 100).toFixed(1) : 0
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// 노선 정보 조회
exports.getRoutes = onRequest({ 
  cors: true,
  region: 'asia-northeast3',
  memory: '1GiB',
  timeoutSeconds: 300 
}, async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'userId가 필요합니다.' 
      });
    }

    // 로그인
    const authResult = await authService.login(userId);
    
    // 노선 정보 조회
    const routes = await reservationService.getRoutes(
      userId,
      authResult.requestUtil,
      authResult.authToken
    );

    res.json({ 
      success: true, 
      data: routes
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// 버스 시간표 조회
exports.getBusTimetable = onRequest({ 
  cors: true,
  region: 'asia-northeast3',
  memory: '1GiB',
  timeoutSeconds: 300 
}, async (req, res) => {
  try {
    const { userId, routeSeq } = req.query;
    
    if (!userId || !routeSeq) {
      return res.status(400).json({ 
        success: false, 
        message: '필수 정보가 누락되었습니다. (userId, routeSeq)' 
      });
    }

    // 로그인
    const authResult = await authService.login(userId);
    
    // 시간표 조회
    const timetable = await reservationService.getBusTimetable(
      userId,
      authResult.requestUtil,
      authResult.authToken,
      routeSeq
    );

    res.json({ 
      success: true, 
      data: timetable
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}); 