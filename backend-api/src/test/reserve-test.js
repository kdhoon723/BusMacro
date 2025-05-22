/**
 * 버스 예약 API - 예약 테스트
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
    day: null,
    route: process.env.CUSTOM_ROUTE,
    toSchoolTime: process.env.CUSTOM_TO_SCHOOL_TIME,
    fromSchoolTime: process.env.CUSTOM_FROM_SCHOOL_TIME,
    station: process.env.CUSTOM_STATION,
    seatNo: process.env.CUSTOM_SEAT_NO || '11'
  };
  
  // 요일 확인
  const dayArg = args.find(arg => arg.startsWith('--day='));
  if (dayArg) {
    options.day = dayArg.split('=')[1];
  }
  
  // 노선 확인
  const routeArg = args.find(arg => arg.startsWith('--route='));
  if (routeArg) {
    options.route = routeArg.split('=')[1];
  }
  
  // 등교 시간 확인
  const toSchoolTimeArg = args.find(arg => arg.startsWith('--toSchoolTime='));
  if (toSchoolTimeArg) {
    options.toSchoolTime = toSchoolTimeArg.split('=')[1];
  }
  
  // 하교 시간 확인
  const fromSchoolTimeArg = args.find(arg => arg.startsWith('--fromSchoolTime='));
  if (fromSchoolTimeArg) {
    options.fromSchoolTime = fromSchoolTimeArg.split('=')[1];
  }
  
  // 정류장 확인
  const stationArg = args.find(arg => arg.startsWith('--station='));
  if (stationArg) {
    options.station = stationArg.split('=')[1];
  }
  
  // 좌석 번호 확인
  const seatArg = args.find(arg => arg.startsWith('--seat='));
  if (seatArg) {
    options.seatNo = seatArg.split('=')[1];
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
    
    // 2. 하교 노선 정보 조회
    console.log('\n하교 노선 정보 조회 중...');
    const fromSchoolRoutes = await reservationService.getFromSchoolRoutes();
    
    if (!fromSchoolRoutes.success || !fromSchoolRoutes.routes.length) {
      console.error('하교 노선 정보 조회 실패');
      return;
    }
    
    console.log(`하교 노선 ${fromSchoolRoutes.routes.length}개 조회됨:`);
    fromSchoolRoutes.routes.forEach(route => {
      console.log(`- ${route.lineName} (lineSeq: ${route.seq})`);
    });
    
    // 3. 등교 노선 정보 조회
    console.log('\n등교 노선 정보 조회 중...');
    const toSchoolRoutes = await reservationService.getToSchoolRoutes();
    
    if (!toSchoolRoutes.success) {
      console.warn('등교 노선 정보 조회 실패 - 하교 노선만 사용하여 진행합니다.');
    } else {
      if (toSchoolRoutes.routes.length > 0) {
        console.log(`등교 노선 ${toSchoolRoutes.routes.length}개 조회됨:`);
        toSchoolRoutes.routes.forEach(route => {
          console.log(`- ${route.lineName} (lineSeq: ${route.seq})`);
        });
      } else {
        console.log('등교 노선 정보가 없습니다.');
      }
    }
    
    // 4. 지정된 노선 찾기 (하교)
    const targetRoute = options.route ? 
      fromSchoolRoutes.routes.find(route => route.lineName.includes(options.route)) : 
      fromSchoolRoutes.routes[0];
    
    if (!targetRoute) {
      console.error(`지정한 노선(${options.route})을 찾을 수 없습니다.`);
      return;
    }
    
    console.log(`\n선택된 노선: ${targetRoute.lineName} (lineSeq: ${targetRoute.seq})`);
    
    // 5. 버스 시간표 조회
    console.log('\n버스 시간표 조회 중...');
    const timetableResult = await reservationService.getBusTimetable(targetRoute.seq, 'DOWN'); // 하교 (DOWN)
    
    if (!timetableResult.success || !timetableResult.timetable.length) {
      console.error('버스 시간표 조회 실패');
      return;
    }
    
    console.log(`버스 시간표 ${timetableResult.timetable.length}개 조회됨:`);
    timetableResult.timetable.forEach(bus => {
      console.log(`- ${bus.operateTime} (busSeq: ${bus.busSeq}), 예약: ${bus.appCount}/${bus.seatCount}석`);
    });
    
    // 정류장 정보 출력
    if (timetableResult.stopList && timetableResult.stopList.length > 0) {
      console.log(`\n정류장 ${timetableResult.stopList.length}개 조회됨:`);
      timetableResult.stopList.forEach(stop => {
        console.log(`- ${stop.stopName} (stopSeq: ${stop.seq})`);
      });
    }
    
    // 6. 지정된 시간 찾기
    const targetBus = options.fromSchoolTime ? 
      timetableResult.timetable.find(bus => bus.operateTime.includes(options.fromSchoolTime)) : 
      timetableResult.timetable[0];
    
    if (!targetBus) {
      console.error(`지정한 시간(${options.fromSchoolTime})의 버스를 찾을 수 없습니다.`);
      return;
    }
    
    console.log(`\n선택된 버스 시간: ${targetBus.operateTime} (busSeq: ${targetBus.busSeq})`);
    
    // 7. 버스 좌석 정보 조회
    console.log('\n좌석 정보 조회 중...');
    const seatsResult = await reservationService.getBusSeats(targetBus.busSeq);
    
    if (!seatsResult.success) {
      console.error('좌석 정보 조회 실패');
      return;
    }
    
    const seatInfo = seatsResult.seats;
    console.log(`좌석 정보 조회 성공 (가용 좌석: ${seatInfo.availCnt}개)`);
    
    // 8. 좌석 번호 선택 (기본값: 11번)
    let seatNo = parseInt(options.seatNo, 10);
    
    // 선택한 좌석이 이미 예약된 경우 다른 좌석 선택
    if (seatInfo.seatList[seatNo] === '1') {
      console.log(`선택한 좌석 ${seatNo}번이 이미 예약되었습니다. 다른 좌석을 찾습니다...`);
      
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
        console.error('가용 좌석이 없습니다.');
        return;
      }
    }
    
    console.log(`선택된 좌석: ${seatNo}번`);
    
    // 9. 정류장 선택
    let targetStopSeq;
    
    // API에서 제공한 정류장 목록이 있는 경우
    if (timetableResult.stopList && timetableResult.stopList.length > 0) {
      // 사용자가 지정한 정류장 이름이 있는 경우 해당 정류장 찾기
      if (options.station) {
        const matchedStop = timetableResult.stopList.find(stop => 
          stop.stopName.includes(options.station)
        );
        
        if (matchedStop) {
          targetStopSeq = matchedStop.seq;
          console.log(`정류장: ${matchedStop.stopName} (stopSeq: ${targetStopSeq})`);
        } else {
          // 일치하는 정류장이 없으면 첫 번째 정류장 사용
          targetStopSeq = timetableResult.stopList[0].seq;
          console.log(`지정한 정류장(${options.station})을 찾을 수 없어 첫 번째 정류장 사용: ${timetableResult.stopList[0].stopName} (stopSeq: ${targetStopSeq})`);
        }
      } else {
        // 정류장을 지정하지 않은 경우 첫 번째 정류장 사용
        targetStopSeq = timetableResult.stopList[0].seq;
        console.log(`정류장: ${timetableResult.stopList[0].stopName} (stopSeq: ${targetStopSeq})`);
      }
    } else {
      // 예전 방식 (노선 객체에서 정류장 정보 사용)
      targetStopSeq = targetRoute.stopList ? targetRoute.stopList[0].seq : '1';
      console.log(`정류장: ${targetRoute.stopList ? (targetRoute.stopList[0].dispatchName || targetRoute.stopList[0].stopName) : '기본 정류장'} (stopSeq: ${targetStopSeq})`);
    }
    
    // 10. 실제로 예약을 수행할지 확인
    const isTest = options.isTest || process.env.TEST_MODE === 'true';
    
    // 예약하지 않고 테스트만 수행
    if (isTest) {
      console.log('\n테스트 모드로 실행 중이므로 실제 예약은 수행하지 않습니다.');
      console.log('예약 정보:', {
        busSeq: targetBus.busSeq,
        lineSeq: targetRoute.seq,
        stopSeq: targetStopSeq,
        seatNo: seatNo
      });
      
      // 예약 상세 정보 조회 테스트
      console.log('\n예약 상세 정보 조회 테스트 중...');
      try {
        const detailResult = await reservationService.getReservationDetail(targetBus.busSeq, seatNo);
        if (detailResult.success) {
          console.log('예약 상세 정보 조회 성공:');
          console.log(JSON.stringify(detailResult.details, null, 2));
        } else {
          console.log('예약 상세 정보 조회 실패:', detailResult.message);
        }
      } catch (error) {
        console.error('예약 상세 정보 조회 중 오류 발생:', error.message);
      }
      
      // 현재 예약 목록 조회 테스트
      console.log('\n현재 예약 목록 조회 테스트 중...');
      try {
        const reservations = await reservationService.getReservations();
        if (reservations.success) {
          console.log(`현재 예약 ${reservations.reservations.length}개 조회됨:`);
          reservations.reservations.forEach((r, i) => {
            console.log(`${i+1}. ${r.lineName || r.groupName} - ${r.operateTime} - 좌석: ${r.seatNo}번`);
          });
        } else {
          console.log('예약 목록 조회 실패:', reservations.message);
        }
      } catch (error) {
        console.error('예약 목록 조회 중 오류 발생:', error.message);
      }
    } else {
      // 실제 예약 수행
      console.log('\n예약을 진행합니다...');
      
      const reservationResult = await reservationService.reserveBus({
        busSeq: targetBus.busSeq,
        lineSeq: targetRoute.seq,
        stopSeq: targetStopSeq,
        seatNo: seatNo
      });
      
      if (reservationResult.success) {
        console.log(`예약 성공! 예약번호: ${reservationResult.reservationNumber}`);
        console.log('예약 정보:', reservationResult.reservationInfo);
        
        // 3초 대기 후 예약 목록 조회 (API 서버 반영 시간 고려)
        console.log('\n예약 정보 반영을 위해 3초 대기 중...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 예약 목록 조회
        console.log('\n예약 목록 조회 중...');
        const reservations = await reservationService.getReservations();
        
        if (reservations.success) {
          if (reservations.reservations.length > 0) {
            console.log('현재 예약 목록:');
            reservations.reservations.forEach((r, i) => {
              console.log(`${i+1}. ${r.lineName || r.groupName || '(노선명 없음)'} - ${r.operateTime || '(시간 없음)'} - 좌석: ${r.seatNo || '(정보 없음)'}번`);
            });
          } else {
            console.log('현재 예약이 없거나 API에 반영되지 않았습니다.');
            console.log('예약은 성공했으나 목록에 즉시 반영되지 않을 수 있습니다.');
          }
          
          // 예약 상세 정보 조회 시도
          console.log('\n예약 상세 정보 조회 중...');
          try {
            const detailResult = await reservationService.getReservationDetail(
              reservationResult.reservationInfo.busSeq, 
              reservationResult.reservationInfo.seatNo
            );
            
            if (detailResult.success) {
              console.log('예약 상세 정보:');
              console.log(JSON.stringify(detailResult.details, null, 2));
            } else {
              console.log('예약 상세 정보 조회 실패:', detailResult.message);
            }
          } catch (error) {
            console.error('예약 상세 정보 조회 중 오류 발생:', error.message);
          }
        } else {
          console.error('예약 목록 조회 실패:', reservations.message);
        }
      } else {
        console.error('예약 실패:', reservationResult.message);
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