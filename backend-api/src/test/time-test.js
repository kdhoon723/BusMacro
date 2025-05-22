/**
 * 버스 예약 API - 정확한 시간에 예약 테스트
 */
require('dotenv').config();
const AuthService = require('../services/auth');
const ReservationService = require('../services/reservation');

/**
 * 명령줄 인자 파싱
 * @returns {Object} 파싱된 인자
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    isTest: args.includes('--test'),
    startTime: null
  };
  
  // 시작 시간 확인
  const timeArg = args.find(arg => arg.startsWith('--start-time='));
  if (timeArg) {
    options.startTime = timeArg.split('=')[1];
  } else {
    // 시작 시간이 지정되지 않은 경우, 현재 시간 + 10초로 설정
    const now = new Date();
    now.setSeconds(now.getSeconds() + 10);
    options.startTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  }
  
  return options;
}

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
 * 정확한 시간에 예약 테스트 실행
 */
async function testTimeReservation() {
  // 명령줄 인자 파싱
  const options = parseArgs();
  console.log('정확한 시간 예약 테스트 설정:', options);
  
  // 환경변수에서 로그인 정보 가져오기
  const id = process.env.TEST_ID;
  const password = process.env.TEST_PASSWORD;
  
  if (!id || !password) {
    console.error('로그인 정보가 없습니다. .env 파일에 TEST_ID와 TEST_PASSWORD를 설정하세요.');
    return;
  }
  
  try {
    // 1. 미리 로그인
    console.log('미리 로그인 중...');
    const authService = new AuthService('time-test');
    const reservationService = new ReservationService('time-test');
    
    const loginResult = await authService.login(id, password);
    if (!loginResult.success) {
      console.error('로그인 실패:', loginResult.message);
      return;
    }
    
    console.log('로그인 성공! 인증 정보 준비 완료.');
    
    // 2. 노선 정보 미리 조회
    console.log('\n노선 정보 미리 조회 중...');
    const routesResult = await reservationService.getFromSchoolRoutes();
    
    if (!routesResult.success || !routesResult.routes.length) {
      console.error('노선 정보 조회 실패');
      return;
    }
    
    // 3. 노선 선택 (테스트용으로 첫 번째 노선 선택)
    const targetRoute = routesResult.routes.find(route => 
      route.lineName.includes(process.env.CUSTOM_ROUTE || '노원')
    ) || routesResult.routes[0];
    
    console.log(`선택된 노선: ${targetRoute.lineName}`);
    
    // 4. 시간표 미리 조회
    console.log('\n시간표 미리 조회 중...');
    const timetableResult = await reservationService.getBusTimetable(targetRoute.seq, 'DOWN');
    
    if (!timetableResult.success || !timetableResult.timetable.length) {
      console.error('시간표 조회 실패');
      return;
    }
    
    // 5. 첫 번째 버스 선택
    const targetBus = timetableResult.timetable.find(bus => 
      bus.operateTime.includes(process.env.CUSTOM_FROM_SCHOOL_TIME || '')
    ) || timetableResult.timetable[0];
    
    console.log(`선택된 버스: ${targetBus.operateTime} (busSeq: ${targetBus.seq})`);
    
    // 6. 정류장 선택
    const targetStopSeq = targetRoute.stopList[0].seq;
    console.log(`선택된 정류장: ${targetRoute.stopList[0].dispatchName || targetRoute.stopList[0].stopName}`);
    
    // 7. 정확한 시간에 좌석 정보 조회 및 예약 실행
    executeAtExactTime(options.startTime, async () => {
      console.log('정확한 시간에 도달했습니다. 좌석 정보 조회 및 예약 시작...');
      
      try {
        // 좌석 정보 조회
        const seatsResult = await reservationService.getBusSeats(targetBus.seq);
        
        if (!seatsResult.success) {
          console.error('좌석 정보 조회 실패:', seatsResult.message);
          return;
        }
        
        // 좌석 선택 (11번 또는 가용 좌석)
        const seatInfo = seatsResult.seats;
        let seatNo = parseInt(process.env.CUSTOM_SEAT_NO || '11', 10);
        
        if (seatInfo.seatList[seatNo] !== '0') {
          console.log(`선택한 좌석 ${seatNo}번이 이미 예약되었습니다. 다른 좌석을 찾습니다...`);
          
          // 가용 좌석 찾기
          let found = false;
          for (let i = 1; i <= 45; i++) {
            if (seatInfo.seatList[i] === '0') {
              seatNo = i;
              found = true;
              break;
            }
          }
          
          if (!found) {
            console.error('가용 좌석이 없습니다.');
            return;
          }
        }
        
        console.log(`선택된 좌석: ${seatNo}번`);
        
        // 테스트 모드 확인
        const isTest = options.isTest || process.env.TEST_MODE === 'true';
        
        if (isTest) {
          console.log('\n테스트 모드로 실행 중이므로 실제 예약은 수행하지 않습니다.');
          console.log('예약 정보:', {
            busSeq: targetBus.seq,
            lineSeq: targetRoute.seq,
            stopSeq: targetStopSeq,
            seatNo: seatNo
          });
          
          // 테스트 완료
          return;
        }
        
        // 실제 예약 수행
        console.log('\n예약을 진행합니다...');
        
        const reservationResult = await reservationService.reserveBus({
          busSeq: targetBus.seq,
          lineSeq: targetRoute.seq,
          stopSeq: targetStopSeq,
          seatNo: seatNo
        });
        
        if (reservationResult.success) {
          console.log(`예약 성공! 예약번호: ${reservationResult.reservationNumber}`);
        } else {
          console.error('예약 실패:', reservationResult.message);
        }
      } catch (error) {
        console.error('예약 과정에서 오류 발생:', error.message);
      }
    });
  } catch (error) {
    console.error('테스트 준비 중 오류 발생:', error.message);
  }
}

// 테스트 실행
testTimeReservation().catch(error => {
  console.error('테스트 실패:', error);
}); 