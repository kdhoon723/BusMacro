/**
 * 대진대 버스 예약 자동화 API 서비스
 */
const dotenv = require('dotenv');
const cron = require('node-cron');
const AuthService = require('./services/auth');
const ReservationService = require('./services/reservation');

// 환경 변수 로드
dotenv.config();

/**
 * 정확한 시간에 예약을 실행하는 함수
 * @param {string} targetTime - 목표 시간 (HH:MM:SS 형식)
 * @param {Function} callback - 실행할 콜백 함수
 */
function executeAtExactTime(targetTime, callback) {
  console.log(`${targetTime}에 예약 실행 예정`);
  
  // 타겟 시간 파싱
  const [targetHour, targetMinute, targetSecond] = targetTime.split(':').map(Number);
  
  // 현재 시간 확인 및 대기 시간 계산 함수
  function checkTimeAndExecute() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();
    const currentMs = now.getMilliseconds();
    
    // 목표 시간까지 남은 시간 계산 (밀리초 단위)
    const targetTimeMs = (targetHour * 3600 + targetMinute * 60 + targetSecond) * 1000;
    const currentTimeMs = (currentHour * 3600 + currentMinute * 60 + currentSecond) * 1000 + currentMs;
    
    // 목표 시간과의 차이
    let timeLeft = targetTimeMs - currentTimeMs;
    
    // 이미 목표 시간이 지났으면 바로 실행
    if (timeLeft <= 0) {
      console.log(`목표 시간 (${targetTime})이 이미 지났습니다. 바로 실행합니다.`);
      callback();
      return;
    }
    
    // 남은 시간 출력
    const timeLeftSec = timeLeft / 1000;
    if (timeLeftSec > 60) {
      console.log(`목표 시간까지 ${(timeLeftSec / 60).toFixed(2)}분 남았습니다.`);
      
      // 1분 이상 남았으면 1초마다 체크
      setTimeout(checkTimeAndExecute, 1000);
    } else if (timeLeftSec > 10) {
      console.log(`목표 시간까지 ${timeLeftSec.toFixed(2)}초 남았습니다.`);
      
      // 10초 이상 남았으면 100ms마다 체크
      setTimeout(checkTimeAndExecute, 100);
    } else {
      console.log(`목표 시간까지 ${timeLeftSec.toFixed(2)}초 남았습니다. 정밀 카운트다운 시작!`);
      
      // 10초 미만이면 매우 정밀하게 체크
      if (timeLeft > 50) {
        setTimeout(checkTimeAndExecute, 10);
      } else {
        // 목표 시간에 맞춰 실행
        setTimeout(() => {
          const execTime = new Date();
          console.log(`정확히 ${execTime.toISOString()} (${execTime.toLocaleTimeString()})에 실행됨`);
          callback();
        }, timeLeft);
      }
    }
  }
  
  // 초기 시간 체크 시작
  checkTimeAndExecute();
}

/**
 * 로그인 후 예약 실행
 * @param {Object} config - 설정 정보
 */
async function loginAndReserve(config) {
  const { id, password, userId, busInfo } = config;
  
  // 서비스 객체 생성
  const authService = new AuthService(userId);
  const reservationService = new ReservationService(userId);
  
  try {
    // 1. 로그인
    console.log(`[${userId}] 로그인 시도...`);
    const loginResult = await authService.login(id, password);
    
    if (!loginResult.success) {
      console.error(`[${userId}] 로그인 실패:`, loginResult.message);
      return;
    }
    
    console.log(`[${userId}] 로그인 성공. 예약 정보 확인 중...`);
    
    // 2. 노선 정보 확인 (하교)
    const routesResult = await reservationService.getFromSchoolRoutes();
    if (!routesResult.success) {
      console.error(`[${userId}] 노선 정보 조회 실패:`, routesResult.message);
      return;
    }
    
    // 3. 버스 정보 매칭
    const targetRoute = routesResult.routes.find(route => 
      route.lineName.includes(busInfo.route)
    );
    
    if (!targetRoute) {
      console.error(`[${userId}] 지정한 노선(${busInfo.route})을 찾을 수 없습니다.`);
      return;
    }
    
    console.log(`[${userId}] 노선 정보 확인: ${targetRoute.lineName} (lineSeq: ${targetRoute.seq})`);
    
    // 4. 버스 시간표 확인
    const timetableResult = await reservationService.getBusTimetable(targetRoute.seq, busInfo.direction);
    if (!timetableResult.success) {
      console.error(`[${userId}] 시간표 조회 실패:`, timetableResult.message);
      return;
    }
    
    // 5. 시간표에서 원하는 시간의 버스 찾기
    const targetBus = timetableResult.timetable.find(bus => 
      bus.operateTime.includes(busInfo.time)
    );
    
    if (!targetBus) {
      console.error(`[${userId}] 지정한 시간(${busInfo.time})의 버스를 찾을 수 없습니다.`);
      return;
    }
    
    console.log(`[${userId}] 버스 시간 확인: ${targetBus.operateTime} (busSeq: ${targetBus.seq})`);
    
    // 6. 버스 좌석 정보 확인
    const seatsResult = await reservationService.getBusSeats(targetBus.seq);
    if (!seatsResult.success) {
      console.error(`[${userId}] 좌석 정보 조회 실패:`, seatsResult.message);
      return;
    }
    
    // 7. 좌석 가용성 확인
    const seatInfo = seatsResult.seats;
    if (seatInfo.seatList[busInfo.seatNo] !== '0') {
      console.error(`[${userId}] 지정한 좌석(${busInfo.seatNo})이 이미 예약되었습니다. 다른 좌석을 찾습니다...`);
      
      // 7-1. 가용 좌석 찾기
      let availableSeat = null;
      for (let i = 1; i <= 45; i++) {
        if (seatInfo.seatList[i] === '0') {
          availableSeat = i;
          break;
        }
      }
      
      if (!availableSeat) {
        console.error(`[${userId}] 가용 좌석이 없습니다.`);
        return;
      }
      
      console.log(`[${userId}] 대체 좌석 ${availableSeat}번을 사용합니다.`);
      busInfo.seatNo = availableSeat;
    }
    
    // 8. 최종 예약 요청
    console.log(`[${userId}] 버스 예약 요청 준비 완료. 예약을 시도합니다...`);
    
    const reservationResult = await reservationService.reserveBus({
      busSeq: targetBus.seq,
      lineSeq: targetRoute.seq,
      stopSeq: busInfo.stopSeq || targetRoute.stopList[0].seq, // 기본 정류장 또는 지정 정류장
      seatNo: busInfo.seatNo
    });
    
    if (reservationResult.success) {
      console.log(`[${userId}] 예약 성공! 예약번호: ${reservationResult.reservationNumber}`);
    } else {
      console.error(`[${userId}] 예약 실패:`, reservationResult.message);
    }
    
  } catch (error) {
    console.error(`[${userId}] 예약 프로세스 중 오류 발생:`, error.message);
  }
}

/**
 * 메인 애플리케이션 실행
 */
async function main() {
  console.log('대진대 버스 예약 자동화 API 서비스 시작');
  
  // 테스트 모드 확인
  const isTestMode = process.env.TEST_MODE === 'true';
  console.log(`테스트 모드: ${isTestMode ? '활성화' : '비활성화'}`);
  
  // 테스트용 로그인
  if (isTestMode) {
    const testConfig = {
      id: process.env.TEST_ID,
      password: process.env.TEST_PASSWORD,
      userId: 'test-user',
      busInfo: {
        route: process.env.CUSTOM_ROUTE || '노원',
        time: process.env.CUSTOM_FROM_SCHOOL_TIME || '15:30',
        direction: 'DOWN', // 하교
        seatNo: parseInt(process.env.CUSTOM_SEAT_NO || '11', 10),
        stopSeq: process.env.CUSTOM_STOP_SEQ
      }
    };
    
    // 테스트 모드에서 지정한 시간이 있으면 해당 시간에 실행
    if (process.env.EXACT_TIME) {
      executeAtExactTime(process.env.EXACT_TIME, () => loginAndReserve(testConfig));
    } else {
      // 현재 시간 + 10초 후에 실행 (테스트용)
      const now = new Date();
      now.setSeconds(now.getSeconds() + 10);
      const testTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      
      executeAtExactTime(testTime, () => loginAndReserve(testConfig));
    }
  } else {
    // 실제 운영 모드 - 크론 스케줄 설정
    // 일/월/화요일 20:58에 로그인하여 21:00에 예약
    cron.schedule('58 20 * * 0,1,2', () => {
      const config = {
        id: process.env.USER_ID,
        password: process.env.USER_PASSWORD,
        userId: 'prod-user',
        busInfo: {
          route: process.env.BUS_ROUTE || '노원',
          time: process.env.FROM_SCHOOL_TIME || '15:30',
          direction: 'DOWN', // 하교
          seatNo: parseInt(process.env.SEAT_NO || '11', 10),
          stopSeq: process.env.STOP_SEQ
        }
      };
      
      // 21:00:00 정각에 예약 실행
      executeAtExactTime('21:00:00', () => loginAndReserve(config));
    });
    
    console.log('일/월/화요일 20:58에 로그인하여 21:00에 예약 실행 예정');
  }
}

// 애플리케이션 시작
main().catch(error => {
  console.error('애플리케이션 실행 중 오류 발생:', error);
});
