/**
 * 빠른 데이터 수집 테스트 - 첫 번째 노선만 수집하여 구조 확인
 */
require('dotenv').config();
const AuthService = require('../services/auth');
const ReservationService = require('../services/reservation');

/**
 * 빠른 데이터 테스트
 */
async function quickDataTest() {
  console.log('🚌 빠른 데이터 수집 테스트 시작...\n');
  
  // 환경변수에서 로그인 정보 가져오기
  const id = process.env.TEST_ID;
  const password = process.env.TEST_PASSWORD;
  
  if (!id || !password) {
    console.error('❌ 로그인 정보가 없습니다. .env 파일에 TEST_ID와 TEST_PASSWORD를 설정하세요.');
    return;
  }
  
  // 서비스 객체 생성
  const authService = new AuthService('quick-test');
  const reservationService = new ReservationService('quick-test', authService);
  
  try {
    // 1. 로그인
    console.log('🔐 로그인 시도 중...');
    const loginResult = await authService.login(id, password);
    
    if (!loginResult.success) {
      console.error('❌ 로그인 실패:', loginResult.message);
      return;
    }
    
    console.log('✅ 로그인 성공!\n');
    
    // 2. 등교 노선 정보 조회 (첫 번째만)
    console.log('📋 등교 노선 정보 조회 중...');
    const upRoutesResult = await reservationService.getToSchoolRoutes();
    
    if (upRoutesResult.success && upRoutesResult.routes.length > 0) {
      console.log(`✅ 등교 노선 ${upRoutesResult.routes.length}개 발견`);
      
      // 첫 번째 노선만 테스트
      const firstRoute = upRoutesResult.routes[0];
      console.log(`\n🔍 테스트 노선: "${firstRoute.lineName}" (seq: ${firstRoute.seq})`);
      
      // 시간표 조회
      console.log('📅 시간표 조회 중...');
      const timetableResult = await reservationService.getBusTimetable(firstRoute.seq, 'UP');
      
      if (timetableResult.success) {
        console.log(`✅ 시간표 ${timetableResult.timetable.length}개 조회됨:`);
        timetableResult.timetable.forEach(bus => {
          console.log(`  - ${bus.operateTime} (busSeq: ${bus.busSeq}), 좌석: ${bus.appCount}/${bus.seatCount}`);
        });
        
        // 정류장 정보
        if (timetableResult.stopList && timetableResult.stopList.length > 0) {
          console.log(`\n🚏 정류장 ${timetableResult.stopList.length}개 조회됨:`);
          timetableResult.stopList.forEach(stop => {
            console.log(`  - ${stop.stopName} (seq: ${stop.seq}) - ${stop.cost}원`);
          });
        }
        
        // 첫 번째 버스의 좌석 정보
        if (timetableResult.timetable.length > 0) {
          const firstBus = timetableResult.timetable[0];
          console.log(`\n💺 좌석 정보 조회 중... (${firstBus.operateTime} 버스)`);
          
          try {
            const seatsResult = await reservationService.getBusSeats(firstBus.busSeq);
            if (seatsResult.success) {
              console.log(`✅ 좌석 정보 조회 성공:`);
              console.log(`  - 전체 좌석: ${seatsResult.seats.seatCount}개`);
              console.log(`  - 가용 좌석: ${seatsResult.seats.availCnt}개`);
              console.log(`  - 좌석 배치: ${seatsResult.seats.seatNumbering}`);
              
              // 좌석 상태 샘플 출력 (처음 10개만)
              if (seatsResult.seats.seatList) {
                console.log(`  - 좌석 상태 (처음 10개):`);
                const seatEntries = Object.entries(seatsResult.seats.seatList).slice(0, 10);
                seatEntries.forEach(([seatNo, status]) => {
                  const statusText = status === '0' ? '빈좌석' : '예약됨';
                  console.log(`    ${seatNo}번: ${statusText}`);
                });
              }
            }
          } catch (seatError) {
            console.log(`⚠️ 좌석 정보 조회 실패: ${seatError.message}`);
          }
        }
        
      } else {
        console.log(`❌ 시간표 조회 실패: ${timetableResult.message}`);
      }
      
    } else {
      console.log('❌ 등교 노선 정보 조회 실패');
    }
    
    // 3. 하교 노선 정보 조회 (첫 번째만)
    console.log('\n📋 하교 노선 정보 조회 중...');
    const downRoutesResult = await reservationService.getFromSchoolRoutes();
    
    if (downRoutesResult.success && downRoutesResult.routes.length > 0) {
      console.log(`✅ 하교 노선 ${downRoutesResult.routes.length}개 발견`);
      
      // 첫 번째 노선만 테스트
      const firstRoute = downRoutesResult.routes[0];
      console.log(`\n🔍 테스트 노선: "${firstRoute.lineName}" (seq: ${firstRoute.seq})`);
      
      // 시간표 조회
      console.log('📅 시간표 조회 중...');
      const timetableResult = await reservationService.getBusTimetable(firstRoute.seq, 'DOWN');
      
      if (timetableResult.success) {
        console.log(`✅ 시간표 ${timetableResult.timetable.length}개 조회됨:`);
        timetableResult.timetable.forEach(bus => {
          console.log(`  - ${bus.operateTime} (busSeq: ${bus.busSeq}), 좌석: ${bus.appCount}/${bus.seatCount}`);
        });
        
        // 정류장 정보
        if (timetableResult.stopList && timetableResult.stopList.length > 0) {
          console.log(`\n🚏 정류장 ${timetableResult.stopList.length}개 조회됨:`);
          timetableResult.stopList.forEach(stop => {
            console.log(`  - ${stop.stopName} (seq: ${stop.seq}) - ${stop.cost}원`);
          });
        }
        
      } else {
        console.log(`❌ 시간표 조회 실패: ${timetableResult.message}`);
      }
      
    } else {
      console.log('❌ 하교 노선 정보 조회 실패');
    }
    
    console.log('\n🎉 빠른 테스트 완료!');
    console.log('💡 전체 데이터 수집을 원한다면: npm run collect:data');
    
  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error.message);
  }
}

// 스크립트 실행
if (require.main === module) {
  quickDataTest().catch(error => {
    console.error('❌ 테스트 실패:', error);
    process.exit(1);
  });
}

module.exports = { quickDataTest }; 