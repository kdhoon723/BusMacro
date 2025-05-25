/**
 * 대진대 버스 예약 - 향상된 시간 테스트 (등하교 노선 선택 기능 포함)
 */
require('dotenv').config();
const AuthService = require('../services/auth');
const ReservationService = require('../services/reservation');

/**
 * 시간 문자열을 분 단위로 변환
 * @param {string} timeStr - HH:MM 형식의 시간 문자열
 * @returns {number} 분 단위 시간
 */
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * 명령줄 인자 파싱
 * @returns {Object} 파싱된 인자
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    isTest: args.includes('--test'),
    startTime: null,
    direction: 'DOWN', // 기본값: 하교
    route: null,
    busTime: null,
    seatNo: 11,
    help: args.includes('--help') || args.includes('-h')
  };
  
  // 도움말 출력
  if (options.help) {
    console.log(`
사용법: npm run test:time [옵션]

옵션:
  --start-time=HH:MM:SS    예약을 시도할 정확한 시간 (예: 21:00:00)
  --direction=UP|DOWN      노선 방향 (UP: 등교, DOWN: 하교, 기본값: DOWN)
  --route=노선명           예약할 노선 (예: 노원, 성남)
  --bus-time=HH:MM         예약할 버스 시간 (예: 15:30)
  --seat-no=숫자           선호 좌석 번호 (기본값: 11)
  --test                   테스트 모드 (실제 예약하지 않음)
  --help, -h               이 도움말 출력

예시:
  npm run test:time -- --start-time=21:00:00 --direction=DOWN --route=노원 --bus-time=15:30
  npm run test:time -- --start-time=08:30:00 --direction=UP --route=성남 --bus-time=07:30 --test
    `);
    process.exit(0);
  }
  
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
  
  // 방향 확인
  const directionArg = args.find(arg => arg.startsWith('--direction='));
  if (directionArg) {
    const direction = directionArg.split('=')[1].toUpperCase();
    if (direction === 'UP' || direction === 'DOWN') {
      options.direction = direction;
    }
  }
  
  // 노선 확인
  const routeArg = args.find(arg => arg.startsWith('--route='));
  if (routeArg) {
    options.route = routeArg.split('=')[1];
  }
  
  // 버스 시간 확인
  const busTimeArg = args.find(arg => arg.startsWith('--bus-time='));
  if (busTimeArg) {
    options.busTime = busTimeArg.split('=')[1];
  }
  
  // 좌석 번호 확인
  const seatArg = args.find(arg => arg.startsWith('--seat-no='));
  if (seatArg) {
    options.seatNo = parseInt(seatArg.split('=')[1], 10);
  }
  
  return options;
}

/**
 * 정확한 시간에 예약을 실행하는 함수
 * @param {string} targetTime - 목표 시간 (HH:MM:SS 형식)
 * @param {Function} callback - 실행할 콜백 함수
 */
function executeAtExactTime(targetTime, callback) {
  console.log(`🎯 ${targetTime}에 예약 실행 예정`);
  
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
      console.log(`⚡ 목표 시간 (${targetTime})이 이미 지났습니다. 바로 실행합니다.`);
      callback();
      return;
    }
    
    // 남은 시간 출력
    const timeLeftSec = timeLeft / 1000;
    if (timeLeftSec > 60) {
      console.log(`⏳ 목표 시간까지 ${(timeLeftSec / 60).toFixed(2)}분 남았습니다.`);
      
      // 1분 이상 남았으면 1초마다 체크
      setTimeout(checkTimeAndExecute, 1000);
    } else if (timeLeftSec > 10) {
      console.log(`⏰ 목표 시간까지 ${timeLeftSec.toFixed(1)}초 남았습니다.`);
      
      // 10초 이상 남았으면 100ms마다 체크
      setTimeout(checkTimeAndExecute, 100);
    } else {
      console.log(`🚀 목표 시간까지 ${timeLeftSec.toFixed(2)}초 남았습니다. 정밀 카운트다운 시작!`);
      
      // 10초 미만이면 매우 정밀하게 체크
      if (timeLeft > 50) {
        setTimeout(checkTimeAndExecute, 10);
      } else {
        // 목표 시간에 맞춰 실행
        setTimeout(() => {
          const execTime = new Date();
          console.log(`✅ 정확히 ${execTime.toISOString()} (${execTime.toLocaleTimeString()})에 실행됨`);
          callback();
        }, timeLeft);
      }
    }
  }
  
  // 초기 시간 체크 시작
  checkTimeAndExecute();
}

/**
 * 노선 목록 조회 및 선택
 * @param {ReservationService} reservationService - 예약 서비스
 * @param {string} direction - 방향 (UP/DOWN)
 * @param {string} routeFilter - 노선 필터
 * @returns {Promise<Object>} 선택된 노선 정보
 */
async function selectRoute(reservationService, direction, routeFilter) {
  console.log(`\n🔍 ${direction === 'UP' ? '등교' : '하교'} 노선 정보 조회 중...`);
  
  let routesResult;
  if (direction === 'UP') {
    routesResult = await reservationService.getToSchoolRoutes();
  } else {
    routesResult = await reservationService.getFromSchoolRoutes();
  }
  
  if (!routesResult.success || !routesResult.routes.length) {
    throw new Error(`${direction === 'UP' ? '등교' : '하교'} 노선 정보 조회 실패`);
  }
  
  console.log(`📋 사용 가능한 ${direction === 'UP' ? '등교' : '하교'} 노선:`);
  routesResult.routes.forEach((route, index) => {
    console.log(`   ${index + 1}. ${route.lineName} (버스 ${route.busCnt}대)`);
  });
  
  // 노선 선택
  let targetRoute;
  if (routeFilter) {
    targetRoute = routesResult.routes.find(route => 
      route.lineName.includes(routeFilter)
    );
    if (!targetRoute) {
      console.warn(`⚠️  지정한 노선 '${routeFilter}'을 찾을 수 없습니다. 첫 번째 노선을 사용합니다.`);
      targetRoute = routesResult.routes[0];
    }
  } else {
    targetRoute = routesResult.routes[0];
  }
  
  console.log(`✅ 선택된 노선: ${targetRoute.lineName}`);
  return targetRoute;
}

/**
 * 버스 시간표 조회 및 선택
 * @param {ReservationService} reservationService - 예약 서비스
 * @param {Object} targetRoute - 선택된 노선
 * @param {string} direction - 방향
 * @param {string} timeFilter - 시간 필터
 * @returns {Promise<Object>} 선택된 버스 정보
 */
async function selectBus(reservationService, targetRoute, direction, timeFilter) {
  console.log(`\n🚌 ${targetRoute.lineName} 노선 시간표 조회 중...`);
  
  const timetableResult = await reservationService.getBusTimetable(targetRoute.seq, direction);
  
  if (!timetableResult.success || !timetableResult.timetable.length) {
    throw new Error(`${targetRoute.lineName} 노선 시간표 조회 실패`);
  }
  
  console.log(`📅 ${targetRoute.lineName} 노선 운행 시간:`);
  timetableResult.timetable.forEach((bus, index) => {
    console.log(`   ${index + 1}. ${bus.operateTime} (busSeq: ${bus.seq})`);
  });
  
  // 버스 선택 (유연한 매칭)
  let targetBus;
  if (timeFilter) {
    // 정확히 일치하는 시간 먼저 찾기
    targetBus = timetableResult.timetable.find(bus => 
      bus.operateTime.includes(timeFilter)
    );
    
    // 정확히 일치하지 않으면 가장 가까운 시간 찾기
    if (!targetBus) {
      console.log(`⚠️  정확히 일치하는 시간 '${timeFilter}'을 찾을 수 없습니다. 가장 가까운 시간을 찾습니다...`);
      
      // 시간을 분 단위로 변환하여 비교
      const targetMinutes = timeToMinutes(timeFilter);
      let closestBus = null;
      let minDiff = Infinity;
      
      timetableResult.timetable.forEach(bus => {
        const busMinutes = timeToMinutes(bus.operateTime);
        const diff = Math.abs(busMinutes - targetMinutes);
        if (diff < minDiff) {
          minDiff = diff;
          closestBus = bus;
        }
      });
      
      if (closestBus) {
        targetBus = closestBus;
        console.log(`✅ 가장 가까운 시간: ${targetBus.operateTime} (${minDiff}분 차이)`);
      } else {
        console.warn(`⚠️  가까운 시간을 찾을 수 없습니다. 첫 번째 버스를 사용합니다.`);
        targetBus = timetableResult.timetable[0];
      }
    }
  } else {
    targetBus = timetableResult.timetable[0];
  }
  
  console.log(`✅ 선택된 버스: ${targetBus.operateTime} (busSeq: ${targetBus.seq})`);
  return { targetBus, stopList: timetableResult.stopList };
}

/**
 * 정확한 시간에 예약 테스트 실행
 */
async function testEnhancedTimeReservation() {
  // 명령줄 인자 파싱
  const options = parseArgs();
  console.log('🎮 향상된 시간 예약 테스트 설정:', {
    startTime: options.startTime,
    direction: options.direction === 'UP' ? '등교' : '하교',
    route: options.route || '자동 선택',
    busTime: options.busTime || '자동 선택',
    seatNo: options.seatNo,
    testMode: options.isTest
  });
  
  // 환경변수에서 로그인 정보 가져오기
  const id = process.env.TEST_ID;
  const password = process.env.TEST_PASSWORD;
  
  if (!id || !password) {
    console.error('❌ 로그인 정보가 없습니다. .env 파일에 TEST_ID와 TEST_PASSWORD를 설정하세요.');
    return;
  }
  
  try {
    // 1. 미리 로그인
    console.log('🔐 미리 로그인 중...');
    const authService = new AuthService('enhanced-time-test');
    const reservationService = new ReservationService('enhanced-time-test');
    
    const loginResult = await authService.login(id, password);
    if (!loginResult.success) {
      console.error('❌ 로그인 실패:', loginResult.message);
      return;
    }
    
    console.log('✅ 로그인 성공! 인증 정보 준비 완료.');
    
    // 2. 노선 선택
    const targetRoute = await selectRoute(reservationService, options.direction, options.route);
    
    // 3. 버스 선택
    const { targetBus, stopList } = await selectBus(reservationService, targetRoute, options.direction, options.busTime);
    
    // 4. 정류장 선택
    const targetStopSeq = targetRoute.stopList?.[0]?.seq || stopList?.[0]?.seq || '1';
    const stopName = targetRoute.stopList?.[0]?.dispatchName || targetRoute.stopList?.[0]?.stopName || stopList?.[0]?.stopName || '기본 정류장';
    console.log(`🏃 선택된 정류장: ${stopName}`);
    
    // 5. 정확한 시간에 좌석 정보 조회 및 예약 실행
    executeAtExactTime(options.startTime, async () => {
      console.log('\n🚀 정확한 시간에 도달했습니다. 예약 프로세스 시작...');
      const startTime = Date.now();
      
      try {
        // 좌석 정보 조회
        console.log('💺 좌석 정보 조회 중...');
        const seatsResult = await reservationService.getBusSeats(targetBus.seq);
        
        if (!seatsResult.success) {
          console.error('❌ 좌석 정보 조회 실패:', seatsResult.message);
          return;
        }
        
        // 좌석 선택
        const seatInfo = seatsResult.seats;
        let seatNo = options.seatNo;
        
        if (seatInfo.seatList[seatNo] !== '0') {
          console.log(`⚠️  선택한 좌석 ${seatNo}번이 이미 예약되었습니다. 다른 좌석을 찾습니다...`);
          
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
            console.error('❌ 가용 좌석이 없습니다.');
            return;
          }
        }
        
        console.log(`✅ 선택된 좌석: ${seatNo}번`);
        
        const reservationData = {
          busSeq: targetBus.seq,
          lineSeq: targetRoute.seq,
          stopSeq: targetStopSeq,
          seatNo: seatNo
        };
        
        // 테스트 모드 확인
        if (options.isTest) {
          console.log('\n🧪 테스트 모드로 실행 중이므로 실제 예약은 수행하지 않습니다.');
          console.log('📋 예약 정보:', reservationData);
          
          const endTime = Date.now();
          console.log(`⏱️  총 처리 시간: ${endTime - startTime}ms`);
          return;
        }
        
        // 실제 예약 수행
        console.log('\n🎯 예약을 진행합니다...');
        
        const reservationResult = await reservationService.reserveBus(reservationData);
        
        const endTime = Date.now();
        
        if (reservationResult.success) {
          console.log(`🎉 예약 성공! 예약번호: ${reservationResult.reservationNumber}`);
          console.log(`⏱️  총 처리 시간: ${endTime - startTime}ms`);
        } else {
          console.error('❌ 예약 실패:', reservationResult.message);
          console.log(`⏱️  총 처리 시간: ${endTime - startTime}ms`);
        }
      } catch (error) {
        const endTime = Date.now();
        console.error('❌ 예약 과정에서 오류 발생:', error.message);
        console.log(`⏱️  총 처리 시간: ${endTime - startTime}ms`);
      }
    });
  } catch (error) {
    console.error('❌ 테스트 준비 중 오류 발생:', error.message);
  }
}

// 테스트 실행
testEnhancedTimeReservation().catch(error => {
  console.error('❌ 테스트 실패:', error);
}); 