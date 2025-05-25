/**
 * 대진대 버스 예약 - 등교/하교 동시 예약 테스트
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
    enableUp: !args.includes('--no-up'),      // 등교 활성화 (기본: true)
    enableDown: !args.includes('--no-down'),  // 하교 활성화 (기본: true)
    help: args.includes('--help') || args.includes('-h')
  };
  
  // 도움말 출력
  if (options.help) {
    console.log(`
사용법: npm run test:dual [옵션]

옵션:
  --start-time=HH:MM:SS    예약을 시도할 정확한 시간 (예: 21:00:00)
  --no-up                  등교 예약 비활성화
  --no-down                하교 예약 비활성화
  --test                   테스트 모드 (즉시 실행, 실제 예약 진행)
  --help, -h               이 도움말 출력

환경변수 설정:
  # 등교 설정
  UP_ROUTE=장기/대화         # 등교 노선
  UP_TIME=07:50             # 등교 버스 시간
  UP_SEAT_NO=11             # 등교 좌석
  
  # 하교 설정
  DOWN_ROUTE=노원           # 하교 노선
  DOWN_TIME=15:30           # 하교 버스 시간
  DOWN_SEAT_NO=11           # 하교 좌석

예시:
  npm run test:dual -- --test                              # 즉시 실제 예약 실행
  npm run test:dual -- --start-time=21:00:00              # 특정 시간에 실제 예약
  npm run test:dual -- --start-time=08:00:00 --no-down    # 등교만 특정 시간에
  npm run test:dual -- --test --no-up                     # 하교만 즉시 실행
    `);
    process.exit(0);
  }
  
  // 시작 시간 확인
  const timeArg = args.find(arg => arg.startsWith('--start-time='));
  if (timeArg) {
    options.startTime = timeArg.split('=')[1];
  } else if (options.isTest) {
    // 테스트 모드일 때는 즉시 실행
    options.startTime = 'immediate';
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
  console.log(`🎯 ${targetTime}에 동시 예약 실행 예정`);
  
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
      setTimeout(checkTimeAndExecute, 1000);
    } else if (timeLeftSec > 10) {
      console.log(`⏰ 목표 시간까지 ${timeLeftSec.toFixed(1)}초 남았습니다.`);
      setTimeout(checkTimeAndExecute, 100);
    } else {
      console.log(`🚀 목표 시간까지 ${timeLeftSec.toFixed(2)}초 남았습니다. 정밀 카운트다운 시작!`);
      
      if (timeLeft > 50) {
        setTimeout(checkTimeAndExecute, 10);
      } else {
        setTimeout(() => {
          const execTime = new Date();
          console.log(`✅ 정확히 ${execTime.toISOString()} (${execTime.toLocaleTimeString()})에 실행됨`);
          callback();
        }, timeLeft);
      }
    }
  }
  
  checkTimeAndExecute();
}

/**
 * 단일 방향 예약 처리 (모든 API 호출을 정확한 시간에 실행)
 * @param {string} direction - 방향 (UP/DOWN)
 * @param {Object} config - 예약 설정
 * @param {ReservationService} reservationService - 예약 서비스
 * @param {boolean} isTest - 테스트 모드 여부
 * @returns {Promise<Object>} 예약 결과
 */
async function processSingleReservation(direction, config, reservationService, isTest) {
  const directionName = direction === 'UP' ? '등교' : '하교';
  const startTime = Date.now();
  
  try {
    console.log(`\n🔍 ${directionName} 노선 정보 조회 중...`);
    
    // 1. 노선 정보 조회 (정각에 실행)
    let routesResult;
    if (direction === 'UP') {
      routesResult = await reservationService.getToSchoolRoutes();
    } else {
      routesResult = await reservationService.getFromSchoolRoutes();
    }
    
    if (!routesResult.success || !routesResult.routes.length) {
      throw new Error(`${directionName} 노선 정보 조회 실패`);
    }
    
    console.log(`📋 ${directionName} 사용 가능한 노선:`);
    routesResult.routes.forEach((route, index) => {
      console.log(`   ${index + 1}. ${route.lineName} (버스 ${route.busCnt}대)`);
    });
    
    // 2. 노선 선택
    const targetRoute = routesResult.routes.find(route => 
      route.lineName.includes(config.route)
    ) || routesResult.routes[0];
    
    console.log(`✅ ${directionName} 선택된 노선: ${targetRoute.lineName}`);
    
    // 3. 시간표 조회 (정각에 실행)
    console.log(`\n🚌 ${directionName} ${targetRoute.lineName} 노선 시간표 조회 중...`);
    const timetableResult = await reservationService.getBusTimetable(targetRoute.seq, direction);
    
    if (!timetableResult.success || !timetableResult.timetable.length) {
      throw new Error(`${directionName} 시간표 조회 실패`);
    }
    
    console.log(`📅 ${directionName} ${targetRoute.lineName} 노선 운행 시간:`);
    timetableResult.timetable.forEach((bus, index) => {
      console.log(`   ${index + 1}. ${bus.operateTime} (busSeq: ${bus.seq})`);
    });
    
    // 4. 버스 선택 (유연한 매칭)
    let targetBus = timetableResult.timetable.find(bus => 
      bus.operateTime.includes(config.time)
    );
    
    // 정확히 일치하지 않으면 가장 가까운 시간 찾기
    if (!targetBus) {
      console.log(`⚠️  ${directionName} 정확히 일치하는 시간 '${config.time}'을 찾을 수 없습니다. 가장 가까운 시간을 찾습니다...`);
      
      // 시간을 분 단위로 변환하여 비교
      const targetMinutes = timeToMinutes(config.time);
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
        console.log(`✅ ${directionName} 가장 가까운 시간: ${targetBus.operateTime} (${minDiff}분 차이)`);
      } else {
        targetBus = timetableResult.timetable[0];
        console.log(`⚠️  ${directionName} 가까운 시간을 찾을 수 없어 첫 번째 버스를 사용합니다.`);
      }
    } else {
      console.log(`✅ ${directionName} 선택된 버스: ${targetBus.operateTime} (busSeq: ${targetBus.seq})`);
    }
    
    // 5. 정류장 선택 (정각에 실행)
    const targetStopSeq = config.stopSeq || targetRoute.stopList?.[0]?.seq || timetableResult.stopList?.[0]?.seq || '1';
    const stopName = targetRoute.stopList?.[0]?.dispatchName || targetRoute.stopList?.[0]?.stopName || timetableResult.stopList?.[0]?.stopName || '기본 정류장';
    console.log(`🏃 ${directionName} 선택된 정류장: ${stopName}`);
    
    // 6. 좌석 정보 조회 (정각에 실행)
    console.log(`💺 ${directionName} 좌석 정보 조회 중...`);
    const seatsResult = await reservationService.getBusSeats(targetBus.seq);
    
    if (!seatsResult.success) {
      throw new Error(`${directionName} 좌석 정보 조회 실패: ${seatsResult.message}`);
    }
    
    // 7. 좌석 선택
    const seatInfo = seatsResult.seats;
    let seatNo = config.seatNo;
    
    if (seatInfo.seatList[seatNo] !== '0') {
      console.log(`⚠️  ${directionName} 선택한 좌석 ${seatNo}번이 이미 예약되었습니다. 다른 좌석을 찾습니다...`);
      
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
        throw new Error(`${directionName} 가용 좌석이 없습니다`);
      }
    }
    
    console.log(`✅ ${directionName} 선택된 좌석: ${seatNo}번`);
    
    const reservationData = {
      busSeq: targetBus.seq,
      lineSeq: targetRoute.seq,
      stopSeq: targetStopSeq,
      seatNo: seatNo
    };
    
    // 8. 실제 예약 수행
    console.log(`\n🎯 ${directionName} 예약을 진행합니다...`);
    const reservationResult = await reservationService.reserveBus(reservationData);
    
    const endTime = Date.now();
    
    if (reservationResult.success) {
      return {
        success: true,
        direction: directionName,
        message: `예약 성공! 예약번호: ${reservationResult.reservationNumber}`,
        processingTime: endTime - startTime,
        reservationNumber: reservationResult.reservationNumber
      };
    } else {
      return {
        success: false,
        direction: directionName,
        message: `예약 실패: ${reservationResult.message}`,
        processingTime: endTime - startTime
      };
    }
    
  } catch (error) {
    const endTime = Date.now();
    return {
      success: false,
      direction: directionName,
      message: `오류 발생: ${error.message}`,
      processingTime: endTime - startTime,
      error: error.message
    };
  }
}

/**
 * 등교/하교 동시 예약 테스트 실행
 */
async function testDualReservation() {
  const options = parseArgs();
  
  // 환경변수에서 설정 읽기
  const upConfig = {
    route: process.env.UP_ROUTE || process.env.CUSTOM_ROUTE || '장기/대화',
    time: process.env.UP_TIME || process.env.CUSTOM_BUS_TIME || '07:50',
    seatNo: parseInt(process.env.UP_SEAT_NO || process.env.CUSTOM_SEAT_NO || '11', 10),
    stopSeq: process.env.UP_STOP_SEQ || process.env.CUSTOM_STOP_SEQ
  };
  
  const downConfig = {
    route: process.env.DOWN_ROUTE || process.env.CUSTOM_ROUTE || '노원',
    time: process.env.DOWN_TIME || process.env.CUSTOM_BUS_TIME || '15:30',
    seatNo: parseInt(process.env.DOWN_SEAT_NO || process.env.CUSTOM_SEAT_NO || '11', 10),
    stopSeq: process.env.DOWN_STOP_SEQ || process.env.CUSTOM_STOP_SEQ
  };
  
  console.log('🎮 등교/하교 동시 예약 테스트 설정:');
  if (options.enableUp) {
    console.log('📈 등교 설정:', upConfig);
  }
  if (options.enableDown) {
    console.log('📉 하교 설정:', downConfig);
  }
  console.log('⏰ 실행 시간:', options.startTime);
  console.log('🚀 즉시 실행:', options.isTest);
  
  // 환경변수에서 로그인 정보 가져오기
  const id = process.env.TEST_ID;
  const password = process.env.TEST_PASSWORD;
  
  if (!id || !password) {
    console.error('❌ 로그인 정보가 없습니다. .env 파일에 TEST_ID와 TEST_PASSWORD를 설정하세요.');
    return;
  }
  
  try {
    // 1. 미리 로그인만 수행
    console.log('🔐 미리 로그인 중...');
    const authService = new AuthService('dual-reservation-test');
    const reservationService = new ReservationService('dual-reservation-test');
    
    const loginResult = await authService.login(id, password);
    if (!loginResult.success) {
      console.error('❌ 로그인 실패:', loginResult.message);
      return;
    }
    
    console.log('✅ 로그인 성공! 인증 정보 준비 완료.');
    console.log('⚠️  모든 API 호출은 정각에 수행됩니다.');
    
    // 2. 즉시 실행 또는 정확한 시간에 동시 예약 실행
    if (options.startTime === 'immediate') {
      console.log('\n🚀 즉시 동시 예약 프로세스 시작...');
      const overallStartTime = Date.now();
      
      const reservationPromises = [];
      
      // 등교 예약 추가
      if (options.enableUp) {
        reservationPromises.push(
          processSingleReservation('UP', upConfig, reservationService, options.isTest)
        );
      }
      
      // 하교 예약 추가
      if (options.enableDown) {
        reservationPromises.push(
          processSingleReservation('DOWN', downConfig, reservationService, options.isTest)
        );
      }
      
      if (reservationPromises.length === 0) {
        console.log('❌ 실행할 예약이 없습니다. --no-up 또는 --no-down 옵션을 확인하세요.');
        return;
      }
      
      try {
        // 동시 실행
        console.log(`\n⚡ ${reservationPromises.length}개 예약을 동시에 실행합니다...`);
        const results = await Promise.all(reservationPromises);
        
        const overallEndTime = Date.now();
        
        // 결과 출력
        console.log('\n📊 === 예약 결과 요약 ===');
        let successCount = 0;
        let failureCount = 0;
        
        results.forEach(result => {
          if (result.success) {
            console.log(`✅ ${result.direction}: ${result.message} (${result.processingTime}ms)`);
            successCount++;
          } else {
            console.log(`❌ ${result.direction}: ${result.message} (${result.processingTime}ms)`);
            failureCount++;
          }
        });
        
        console.log(`\n📈 성공: ${successCount}개, 실패: ${failureCount}개`);
        console.log(`⏱️  전체 처리 시간: ${overallEndTime - overallStartTime}ms`);
        console.log(`🔄 최대 개별 처리 시간: ${Math.max(...results.map(r => r.processingTime))}ms`);
        
      } catch (error) {
        const overallEndTime = Date.now();
        console.error('❌ 동시 예약 처리 중 오류 발생:', error.message);
        console.log(`⏱️  전체 처리 시간: ${overallEndTime - overallStartTime}ms`);
      }
    } else {
      // 정확한 시간에 동시 예약 실행
      executeAtExactTime(options.startTime, async () => {
        console.log('\n🚀 정확한 시간에 도달했습니다. 동시 예약 프로세스 시작...');
        const overallStartTime = Date.now();
        
        const reservationPromises = [];
        
        // 등교 예약 추가
        if (options.enableUp) {
          reservationPromises.push(
            processSingleReservation('UP', upConfig, reservationService, options.isTest)
          );
        }
        
        // 하교 예약 추가
        if (options.enableDown) {
          reservationPromises.push(
            processSingleReservation('DOWN', downConfig, reservationService, options.isTest)
          );
        }
        
        if (reservationPromises.length === 0) {
          console.log('❌ 실행할 예약이 없습니다. --no-up 또는 --no-down 옵션을 확인하세요.');
          return;
        }
        
        try {
          // 동시 실행
          console.log(`\n⚡ ${reservationPromises.length}개 예약을 동시에 실행합니다...`);
          const results = await Promise.all(reservationPromises);
          
          const overallEndTime = Date.now();
          
          // 결과 출력
          console.log('\n📊 === 예약 결과 요약 ===');
          let successCount = 0;
          let failureCount = 0;
          
          results.forEach(result => {
            if (result.success) {
              console.log(`✅ ${result.direction}: ${result.message} (${result.processingTime}ms)`);
              successCount++;
            } else {
              console.log(`❌ ${result.direction}: ${result.message} (${result.processingTime}ms)`);
              failureCount++;
            }
          });
          
          console.log(`\n📈 성공: ${successCount}개, 실패: ${failureCount}개`);
          console.log(`⏱️  전체 처리 시간: ${overallEndTime - overallStartTime}ms`);
          console.log(`🔄 최대 개별 처리 시간: ${Math.max(...results.map(r => r.processingTime))}ms`);
          
        } catch (error) {
          const overallEndTime = Date.now();
          console.error('❌ 동시 예약 처리 중 오류 발생:', error.message);
          console.log(`⏱️  전체 처리 시간: ${overallEndTime - overallStartTime}ms`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ 테스트 준비 중 오류 발생:', error.message);
  }
}

// 테스트 실행
testDualReservation().catch(error => {
  console.error('❌ 테스트 실패:', error);
}); 