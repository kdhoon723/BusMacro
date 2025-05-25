/**
 * 버스 예약 API - 예약 테스트 (등교/하교 지원)
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
    day: null,
    // 등교 설정
    upRoute: process.env.UP_ROUTE || process.env.CUSTOM_ROUTE || '장기/대화',
    upTime: process.env.UP_TIME || process.env.CUSTOM_TO_SCHOOL_TIME || '07:50',
    upStation: process.env.UP_STATION || process.env.CUSTOM_STATION,
    upSeatNo: process.env.UP_SEAT_NO || process.env.CUSTOM_SEAT_NO || '11',
    // 하교 설정
    downRoute: process.env.DOWN_ROUTE || process.env.CUSTOM_ROUTE || '대화',
    downTime: process.env.DOWN_TIME || process.env.CUSTOM_FROM_SCHOOL_TIME || '15:30',
    downStation: process.env.DOWN_STATION || process.env.CUSTOM_STATION,
    downSeatNo: process.env.DOWN_SEAT_NO || process.env.CUSTOM_SEAT_NO || '11',
    enableUp: !args.includes('--no-up'),      // 등교 활성화 (기본: true)
    enableDown: !args.includes('--no-down')   // 하교 활성화 (기본: true)
  };
  
  // 요일 확인
  const dayArg = args.find(arg => arg.startsWith('--day='));
  if (dayArg) {
    options.day = dayArg.split('=')[1];
  }
  
  // 등교 노선 확인
  const upRouteArg = args.find(arg => arg.startsWith('--up-route='));
  if (upRouteArg) {
    options.upRoute = upRouteArg.split('=')[1];
  }
  
  // 등교 시간 확인
  const upTimeArg = args.find(arg => arg.startsWith('--up-time='));
  if (upTimeArg) {
    options.upTime = upTimeArg.split('=')[1];
  }
  
  // 등교 정류장 확인
  const upStationArg = args.find(arg => arg.startsWith('--up-station='));
  if (upStationArg) {
    options.upStation = upStationArg.split('=')[1];
  }
  
  // 등교 좌석 확인
  const upSeatArg = args.find(arg => arg.startsWith('--up-seat='));
  if (upSeatArg) {
    options.upSeatNo = upSeatArg.split('=')[1];
  }
  
  // 하교 노선 확인
  const downRouteArg = args.find(arg => arg.startsWith('--down-route='));
  if (downRouteArg) {
    options.downRoute = downRouteArg.split('=')[1];
  }
  
  // 하교 시간 확인
  const downTimeArg = args.find(arg => arg.startsWith('--down-time='));
  if (downTimeArg) {
    options.downTime = downTimeArg.split('=')[1];
  }
  
  // 하교 정류장 확인
  const downStationArg = args.find(arg => arg.startsWith('--down-station='));
  if (downStationArg) {
    options.downStation = downStationArg.split('=')[1];
  }
  
  // 하교 좌석 확인
  const downSeatArg = args.find(arg => arg.startsWith('--down-seat='));
  if (downSeatArg) {
    options.downSeatNo = downSeatArg.split('=')[1];
  }
  
  return options;
}

/**
 * 버스 예약 테스트
 */
async function testBusReservation() {
  // 테스트 설정
  const options = parseArgs();
  console.log('버스 예약 테스트 설정:', options);
  
  // 환경변수에서 로그인 정보 가져오기
  const id = process.env.TEST_ID;
  const password = process.env.TEST_PASSWORD;
  
  if (!id || !password) {
    console.error('로그인 정보가 없습니다. .env 파일에 TEST_ID와 TEST_PASSWORD를 설정하세요.');
    return;
  }
  
  // 서비스 객체 생성
  const authService = new AuthService('reserve-test');
  const reservationService = new ReservationService('reserve-test', authService);
  
  try {
    // 1. 로그인
    console.log('\n로그인 시도 중...');
    const loginResult = await authService.login(id, password);
    
    if (!loginResult.success) {
      console.error('로그인 실패:', loginResult.message);
      return;
    }
    
    console.log('로그인 성공!');
    
    const results = [];
    
    // === 하교 예약 처리 ===
    if (options.enableDown) {
      console.log('\n=== 하교 예약 처리 시작 ===');
      
      try {
        // 2. 하교 노선 정보 조회
        console.log('\n하교 노선 정보 조회 중...');
        const fromSchoolRoutes = await reservationService.getFromSchoolRoutes();
        
        if (!fromSchoolRoutes.success || !fromSchoolRoutes.routes.length) {
          console.error('하교 노선 정보 조회 실패');
          results.push({ direction: '하교', success: false, message: '노선 정보 조회 실패' });
        } else {
          console.log(`하교 노선 ${fromSchoolRoutes.routes.length}개 조회됨:`);
          fromSchoolRoutes.routes.forEach(route => {
            console.log(`- ${route.lineName} (lineSeq: ${route.seq})`);
          });
          
          // 3. 지정된 노선 찾기 (하교)
          const targetRoute = options.downRoute ? 
            fromSchoolRoutes.routes.find(route => route.lineName.includes(options.downRoute)) : 
            fromSchoolRoutes.routes[0];
          
          if (!targetRoute) {
            console.error(`지정한 하교 노선(${options.downRoute})을 찾을 수 없습니다.`);
            results.push({ direction: '하교', success: false, message: '지정한 노선을 찾을 수 없음' });
          } else {
            console.log(`\n선택된 하교 노선: ${targetRoute.lineName} (lineSeq: ${targetRoute.seq})`);
            
            // 4. 버스 시간표 조회
            console.log('\n하교 버스 시간표 조회 중...');
            const timetableResult = await reservationService.getBusTimetable(targetRoute.seq, 'DOWN');
            
            if (!timetableResult.success || !timetableResult.timetable.length) {
              console.error('하교 버스 시간표 조회 실패');
              results.push({ direction: '하교', success: false, message: '시간표 조회 실패' });
            } else {
              console.log(`하교 버스 시간표 ${timetableResult.timetable.length}개 조회됨:`);
              timetableResult.timetable.forEach(bus => {
                console.log(`- ${bus.operateTime} (busSeq: ${bus.busSeq}), 예약: ${bus.appCount}/${bus.seatCount}석`);
              });
              
              // 정류장 정보 출력
              if (timetableResult.stopList && timetableResult.stopList.length > 0) {
                console.log(`\n하교 정류장 ${timetableResult.stopList.length}개 조회됨:`);
                timetableResult.stopList.forEach(stop => {
                  console.log(`- ${stop.stopName} (stopSeq: ${stop.seq})`);
                });
              }
              
              // 5. 지정된 시간 찾기 (유연한 매칭)
              let targetBus;
              
              if (options.downTime) {
                // 정확히 일치하는 시간 먼저 찾기
                targetBus = timetableResult.timetable.find(bus => bus.operateTime.includes(options.downTime));
                
                // 정확히 일치하지 않으면 가장 가까운 시간 찾기
                if (!targetBus) {
                  console.log(`정확히 일치하는 하교 시간(${options.downTime})을 찾을 수 없습니다. 가장 가까운 시간을 찾습니다...`);
                  
                  // 시간을 분 단위로 변환하여 비교
                  const targetMinutes = timeToMinutes(options.downTime);
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
                    console.log(`가장 가까운 하교 시간: ${targetBus.operateTime} (${minDiff}분 차이)`);
                  }
                }
              } else {
                targetBus = timetableResult.timetable[0];
              }
              
              if (!targetBus) {
                console.error(`사용 가능한 하교 버스를 찾을 수 없습니다.`);
                results.push({ direction: '하교', success: false, message: '사용 가능한 버스 없음' });
              } else {
                console.log(`\n선택된 하교 버스 시간: ${targetBus.operateTime} (busSeq: ${targetBus.busSeq})`);
                
                // 6. 버스 좌석 정보 조회
                console.log('\n하교 좌석 정보 조회 중...');
                const seatsResult = await reservationService.getBusSeats(targetBus.busSeq);
                
                if (!seatsResult.success) {
                  console.error('하교 좌석 정보 조회 실패');
                  results.push({ direction: '하교', success: false, message: '좌석 정보 조회 실패' });
                } else {
                  const seatInfo = seatsResult.seats;
                  console.log(`하교 좌석 정보 조회 성공 (가용 좌석: ${seatInfo.availCnt}개)`);
                  
                  // 7. 좌석 번호 선택
                  let seatNo = parseInt(options.downSeatNo, 10);
                  
                  // 선택한 좌석이 이미 예약된 경우 다른 좌석 선택
                  if (seatInfo.seatList[seatNo] === '1') {
                    console.log(`선택한 하교 좌석 ${seatNo}번이 이미 예약되었습니다. 다른 좌석을 찾습니다...`);
                    
                    // 가용 좌석 찾기
                    let found = false;
                    // seatList가 객체인 경우
                    if (typeof seatInfo.seatList === 'object' && !Array.isArray(seatInfo.seatList)) {
                      for (let i = 1; i <= Object.keys(seatInfo.seatList).length; i++) {
                        if (seatInfo.seatList[i] === '0') {
                          seatNo = i;
                          found = true;
                          break;
                        }
                      }
                    } 
                    // originalSeatList가 있는 경우 (새로운 API 구조)
                    else if (Array.isArray(seatInfo.originalSeatList)) {
                      const availableSeat = seatInfo.originalSeatList.find(seat => seat.isReserved === 'NO');
                      if (availableSeat) {
                        seatNo = availableSeat.seatNo;
                        found = true;
                      }
                    }
                    
                    if (!found) {
                      console.error('하교 가용 좌석이 없습니다.');
                      results.push({ direction: '하교', success: false, message: '가용 좌석 없음' });
                      seatNo = null;
                    }
                  }
                  
                  if (seatNo !== null) {
                    console.log(`선택된 하교 좌석: ${seatNo}번`);
                    
                    // 8. 정류장 선택
                    let targetStopSeq;
                    
                    // API에서 제공한 정류장 목록이 있는 경우
                    if (timetableResult.stopList && timetableResult.stopList.length > 0) {
                      // 사용자가 지정한 정류장 이름이 있는 경우 해당 정류장 찾기
                      if (options.downStation) {
                        const matchedStop = timetableResult.stopList.find(stop => 
                          stop.stopName.includes(options.downStation)
                        );
                        
                        if (matchedStop) {
                          targetStopSeq = matchedStop.seq;
                          console.log(`하교 정류장: ${matchedStop.stopName} (stopSeq: ${targetStopSeq})`);
                        } else {
                          // 일치하는 정류장이 없으면 첫 번째 정류장 사용
                          targetStopSeq = timetableResult.stopList[0].seq;
                          console.log(`지정한 하교 정류장(${options.downStation})을 찾을 수 없어 첫 번째 정류장 사용: ${timetableResult.stopList[0].stopName} (stopSeq: ${targetStopSeq})`);
                        }
                      } else {
                        // 정류장을 지정하지 않은 경우 첫 번째 정류장 사용
                        targetStopSeq = timetableResult.stopList[0].seq;
                        console.log(`하교 정류장: ${timetableResult.stopList[0].stopName} (stopSeq: ${targetStopSeq})`);
                      }
                    } else {
                      // 예전 방식 (노선 객체에서 정류장 정보 사용)
                      targetStopSeq = targetRoute.stopList ? targetRoute.stopList[0].seq : '1';
                      console.log(`하교 정류장: ${targetRoute.stopList ? (targetRoute.stopList[0].dispatchName || targetRoute.stopList[0].stopName) : '기본 정류장'} (stopSeq: ${targetStopSeq})`);
                    }
                    
                    // 9. 실제로 예약을 수행할지 확인
                    const isTest = options.isTest || process.env.TEST_MODE === 'true';
                    
                    // 예약하지 않고 테스트만 수행
                    if (isTest) {
                      console.log('\n하교 테스트 모드로 실행 중이므로 실제 예약은 수행하지 않습니다.');
                      console.log('하교 예약 정보:', {
                        busSeq: targetBus.busSeq,
                        lineSeq: targetRoute.seq,
                        stopSeq: targetStopSeq,
                        seatNo: seatNo
                      });
                      results.push({ direction: '하교', success: true, message: '테스트 완료 (실제 예약 안함)' });
                    } else {
                      // 실제 예약 수행
                      console.log('\n하교 예약을 진행합니다...');
                      
                      const reservationResult = await reservationService.reserveBus({
                        busSeq: targetBus.busSeq,
                        lineSeq: targetRoute.seq,
                        stopSeq: targetStopSeq,
                        seatNo: seatNo
                      });
                      
                      if (reservationResult.success) {
                        console.log(`하교 예약 성공! 예약번호: ${reservationResult.reservationNumber}`);
                        results.push({ direction: '하교', success: true, message: `예약 성공! 예약번호: ${reservationResult.reservationNumber}` });
                      } else {
                        console.error('하교 예약 실패:', reservationResult.message);
                        results.push({ direction: '하교', success: false, message: `예약 실패: ${reservationResult.message}` });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('하교 예약 처리 중 오류 발생:', error.message);
        results.push({ direction: '하교', success: false, message: `오류 발생: ${error.message}` });
      }
    }
    
    // === 등교 예약 처리 ===
    if (options.enableUp) {
      console.log('\n=== 등교 예약 처리 시작 ===');
      
      try {
        // 2. 등교 노선 정보 조회
        console.log('\n등교 노선 정보 조회 중...');
        const toSchoolRoutes = await reservationService.getToSchoolRoutes();
        
        if (!toSchoolRoutes.success || !toSchoolRoutes.routes.length) {
          console.error('등교 노선 정보 조회 실패');
          results.push({ direction: '등교', success: false, message: '노선 정보 조회 실패' });
        } else {
          console.log(`등교 노선 ${toSchoolRoutes.routes.length}개 조회됨:`);
          toSchoolRoutes.routes.forEach(route => {
            console.log(`- ${route.lineName} (lineSeq: ${route.seq})`);
          });
          
          // 3. 지정된 노선 찾기 (등교)
          const targetRoute = options.upRoute ? 
            toSchoolRoutes.routes.find(route => route.lineName.includes(options.upRoute)) : 
            toSchoolRoutes.routes[0];
          
          if (!targetRoute) {
            console.error(`지정한 등교 노선(${options.upRoute})을 찾을 수 없습니다.`);
            results.push({ direction: '등교', success: false, message: '지정한 노선을 찾을 수 없음' });
          } else {
            console.log(`\n선택된 등교 노선: ${targetRoute.lineName} (lineSeq: ${targetRoute.seq})`);
            
            // 4. 버스 시간표 조회
            console.log('\n등교 버스 시간표 조회 중...');
            const timetableResult = await reservationService.getBusTimetable(targetRoute.seq, 'UP');
            
            if (!timetableResult.success || !timetableResult.timetable.length) {
              console.error('등교 버스 시간표 조회 실패');
              results.push({ direction: '등교', success: false, message: '시간표 조회 실패' });
            } else {
              console.log(`등교 버스 시간표 ${timetableResult.timetable.length}개 조회됨:`);
              timetableResult.timetable.forEach(bus => {
                console.log(`- ${bus.operateTime} (busSeq: ${bus.busSeq}), 예약: ${bus.appCount}/${bus.seatCount}석`);
              });
              
              // 정류장 정보 출력
              if (timetableResult.stopList && timetableResult.stopList.length > 0) {
                console.log(`\n등교 정류장 ${timetableResult.stopList.length}개 조회됨:`);
                timetableResult.stopList.forEach(stop => {
                  console.log(`- ${stop.stopName} (stopSeq: ${stop.seq})`);
                });
              }
              
              // 5. 지정된 시간 찾기 (유연한 매칭)
              let targetBus;
              
              if (options.upTime) {
                // 정확히 일치하는 시간 먼저 찾기
                targetBus = timetableResult.timetable.find(bus => bus.operateTime.includes(options.upTime));
                
                // 정확히 일치하지 않으면 가장 가까운 시간 찾기
                if (!targetBus) {
                  console.log(`정확히 일치하는 등교 시간(${options.upTime})을 찾을 수 없습니다. 가장 가까운 시간을 찾습니다...`);
                  
                  // 시간을 분 단위로 변환하여 비교
                  const targetMinutes = timeToMinutes(options.upTime);
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
                    console.log(`가장 가까운 등교 시간: ${targetBus.operateTime} (${minDiff}분 차이)`);
                  }
                }
              } else {
                targetBus = timetableResult.timetable[0];
              }
              
              if (!targetBus) {
                console.error(`사용 가능한 등교 버스를 찾을 수 없습니다.`);
                results.push({ direction: '등교', success: false, message: '사용 가능한 버스 없음' });
              } else {
                console.log(`\n선택된 등교 버스 시간: ${targetBus.operateTime} (busSeq: ${targetBus.busSeq})`);
                
                // 6. 버스 좌석 정보 조회
                console.log('\n등교 좌석 정보 조회 중...');
                const seatsResult = await reservationService.getBusSeats(targetBus.busSeq);
                
                if (!seatsResult.success) {
                  console.error('등교 좌석 정보 조회 실패');
                  results.push({ direction: '등교', success: false, message: '좌석 정보 조회 실패' });
                } else {
                  const seatInfo = seatsResult.seats;
                  console.log(`등교 좌석 정보 조회 성공 (가용 좌석: ${seatInfo.availCnt}개)`);
                  
                  // 7. 좌석 번호 선택
                  let seatNo = parseInt(options.upSeatNo, 10);
                  
                  // 선택한 좌석이 이미 예약된 경우 다른 좌석 선택
                  if (seatInfo.seatList[seatNo] === '1') {
                    console.log(`선택한 등교 좌석 ${seatNo}번이 이미 예약되었습니다. 다른 좌석을 찾습니다...`);
                    
                    // 가용 좌석 찾기
                    let found = false;
                    // seatList가 객체인 경우
                    if (typeof seatInfo.seatList === 'object' && !Array.isArray(seatInfo.seatList)) {
                      for (let i = 1; i <= Object.keys(seatInfo.seatList).length; i++) {
                        if (seatInfo.seatList[i] === '0') {
                          seatNo = i;
                          found = true;
                          break;
                        }
                      }
                    } 
                    // originalSeatList가 있는 경우 (새로운 API 구조)
                    else if (Array.isArray(seatInfo.originalSeatList)) {
                      const availableSeat = seatInfo.originalSeatList.find(seat => seat.isReserved === 'NO');
                      if (availableSeat) {
                        seatNo = availableSeat.seatNo;
                        found = true;
                      }
                    }
                    
                    if (!found) {
                      console.error('등교 가용 좌석이 없습니다.');
                      results.push({ direction: '등교', success: false, message: '가용 좌석 없음' });
                      seatNo = null;
                    }
                  }
                  
                  if (seatNo !== null) {
                    console.log(`선택된 등교 좌석: ${seatNo}번`);
                    
                    // 8. 정류장 선택
                    let targetStopSeq;
                    
                    // API에서 제공한 정류장 목록이 있는 경우
                    if (timetableResult.stopList && timetableResult.stopList.length > 0) {
                      // 사용자가 지정한 정류장 이름이 있는 경우 해당 정류장 찾기
                      if (options.upStation) {
                        const matchedStop = timetableResult.stopList.find(stop => 
                          stop.stopName.includes(options.upStation)
                        );
                        
                        if (matchedStop) {
                          targetStopSeq = matchedStop.seq;
                          console.log(`등교 정류장: ${matchedStop.stopName} (stopSeq: ${targetStopSeq})`);
                        } else {
                          // 일치하는 정류장이 없으면 첫 번째 정류장 사용
                          targetStopSeq = timetableResult.stopList[0].seq;
                          console.log(`지정한 등교 정류장(${options.upStation})을 찾을 수 없어 첫 번째 정류장 사용: ${timetableResult.stopList[0].stopName} (stopSeq: ${targetStopSeq})`);
                        }
                      } else {
                        // 정류장을 지정하지 않은 경우 첫 번째 정류장 사용
                        targetStopSeq = timetableResult.stopList[0].seq;
                        console.log(`등교 정류장: ${timetableResult.stopList[0].stopName} (stopSeq: ${targetStopSeq})`);
                      }
                    } else {
                      // 예전 방식 (노선 객체에서 정류장 정보 사용)
                      targetStopSeq = targetRoute.stopList ? targetRoute.stopList[0].seq : '1';
                      console.log(`등교 정류장: ${targetRoute.stopList ? (targetRoute.stopList[0].dispatchName || targetRoute.stopList[0].stopName) : '기본 정류장'} (stopSeq: ${targetStopSeq})`);
                    }
                    
                    // 9. 실제로 예약을 수행할지 확인
                    const isTest = options.isTest || process.env.TEST_MODE === 'true';
                    
                    // 예약하지 않고 테스트만 수행
                    if (isTest) {
                      console.log('\n등교 테스트 모드로 실행 중이므로 실제 예약은 수행하지 않습니다.');
                      console.log('등교 예약 정보:', {
                        busSeq: targetBus.busSeq,
                        lineSeq: targetRoute.seq,
                        stopSeq: targetStopSeq,
                        seatNo: seatNo
                      });
                      results.push({ direction: '등교', success: true, message: '테스트 완료 (실제 예약 안함)' });
                    } else {
                      // 실제 예약 수행
                      console.log('\n등교 예약을 진행합니다...');
                      
                      const reservationResult = await reservationService.reserveBus({
                        busSeq: targetBus.busSeq,
                        lineSeq: targetRoute.seq,
                        stopSeq: targetStopSeq,
                        seatNo: seatNo
                      });
                      
                      if (reservationResult.success) {
                        console.log(`등교 예약 성공! 예약번호: ${reservationResult.reservationNumber}`);
                        results.push({ direction: '등교', success: true, message: `예약 성공! 예약번호: ${reservationResult.reservationNumber}` });
                      } else {
                        console.error('등교 예약 실패:', reservationResult.message);
                        results.push({ direction: '등교', success: false, message: `예약 실패: ${reservationResult.message}` });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('등교 예약 처리 중 오류 발생:', error.message);
        results.push({ direction: '등교', success: false, message: `오류 발생: ${error.message}` });
      }
    }
    
    // 최종 결과 출력
    console.log('\n=== 최종 예약 결과 ===');
    let successCount = 0;
    let failureCount = 0;
    
    results.forEach(result => {
      if (result.success) {
        console.log(`✅ ${result.direction}: ${result.message}`);
        successCount++;
      } else {
        console.log(`❌ ${result.direction}: ${result.message}`);
        failureCount++;
      }
    });
    
    console.log(`\n📊 성공: ${successCount}개, 실패: ${failureCount}개`);
    
    // 테스트 모드가 아니고 성공한 예약이 있는 경우 예약 목록 조회
    if (!options.isTest && successCount > 0) {
      console.log('\n예약 목록 조회 중...');
      try {
        const reservations = await reservationService.getReservations();
        
        if (reservations.success) {
          if (reservations.reservations.length > 0) {
            console.log('현재 예약 목록:');
            reservations.reservations.forEach((r, i) => {
              console.log(`${i+1}. ${r.lineName || r.groupName || '(노선명 없음)'} - ${r.operateTime || '(시간 없음)'} - 좌석: ${r.seatNo || '(정보 없음)'}번`);
            });
          } else {
            console.log('현재 예약이 없거나 API에 반영되지 않았습니다.');
          }
        } else {
          console.error('예약 목록 조회 실패:', reservations.message);
        }
      } catch (error) {
        console.error('예약 목록 조회 중 오류 발생:', error.message);
      }
    }
    
  } catch (error) {
    console.error('테스트 중 오류 발생:', error.message);
  }
}

// 테스트 실행
testBusReservation().catch(error => {
  console.error('테스트 실패:', error);
}); 