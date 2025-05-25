/**
 * 버스 데이터 수집기 - 모든 노선, 시간표, 정류장 정보 수집
 */
require('dotenv').config();
const AuthService = require('../services/auth');
const ReservationService = require('../services/reservation');
const fs = require('fs').promises;
const path = require('path');

/**
 * 데이터 수집 및 저장
 */
async function collectBusData() {
  console.log('🚌 버스 데이터 수집 시작...\n');
  
  // 환경변수에서 로그인 정보 가져오기
  const id = process.env.TEST_ID;
  const password = process.env.TEST_PASSWORD;
  
  if (!id || !password) {
    console.error('❌ 로그인 정보가 없습니다. .env 파일에 TEST_ID와 TEST_PASSWORD를 설정하세요.');
    return;
  }
  
  // 서비스 객체 생성
  const authService = new AuthService('data-collector');
  const reservationService = new ReservationService('data-collector', authService);
  
  try {
    // 1. 로그인
    console.log('🔐 로그인 시도 중...');
    const loginResult = await authService.login(id, password);
    
    if (!loginResult.success) {
      console.error('❌ 로그인 실패:', loginResult.message);
      return;
    }
    
    console.log('✅ 로그인 성공!\n');
    
    const collectedData = {
      collectedAt: new Date().toISOString(),
      upRoutes: [],
      downRoutes: []
    };
    
    // 2. 등교 노선 정보 수집
    console.log('📋 등교 노선 정보 수집 중...');
    const upRoutesResult = await reservationService.getToSchoolRoutes();
    
    if (upRoutesResult.success && upRoutesResult.routes.length > 0) {
      console.log(`✅ 등교 노선 ${upRoutesResult.routes.length}개 발견`);
      
      for (const route of upRoutesResult.routes) {
        console.log(`\n🔍 등교 노선 "${route.lineName}" 상세 정보 수집 중...`);
        
        const routeData = {
          seq: route.seq,
          lineName: route.lineName,
          busCnt: route.busCnt,
          direction: 'UP',
          timetables: [],
          stops: []
        };
        
        try {
          // 시간표 조회
          const timetableResult = await reservationService.getBusTimetable(route.seq, 'UP');
          
          if (timetableResult.success) {
            console.log(`  📅 시간표 ${timetableResult.timetable.length}개 수집`);
            
            routeData.timetables = timetableResult.timetable.map(bus => ({
              busSeq: bus.busSeq,
              carNum: bus.carNum,
              operateDate: bus.operateDate,
              operateWeek: bus.operateWeek,
              operateTime: bus.operateTime,
              fullOperateTime: bus.fullOperateTime,
              seatCount: bus.seatCount,
              seatNumbering: bus.seatNumbering,
              appCount: bus.appCount,
              readyCount: bus.readyCount
            }));
            
            // 정류장 정보
            if (timetableResult.stopList && timetableResult.stopList.length > 0) {
              console.log(`  🚏 정류장 ${timetableResult.stopList.length}개 수집`);
              
              routeData.stops = timetableResult.stopList.map(stop => ({
                seq: stop.seq,
                stopName: stop.stopName,
                memo: stop.memo,
                cost: stop.cost
              }));
            }
            
            // 각 버스의 좌석 정보도 수집 (첫 번째 버스만)
            if (timetableResult.timetable.length > 0) {
              const firstBus = timetableResult.timetable[0];
              console.log(`  💺 좌석 정보 수집 중... (버스: ${firstBus.operateTime})`);
              
              try {
                const seatsResult = await reservationService.getBusSeats(firstBus.busSeq);
                if (seatsResult.success) {
                  routeData.seatInfo = {
                    availCnt: seatsResult.seats.availCnt,
                    seatCount: seatsResult.seats.seatCount,
                    seatNumbering: seatsResult.seats.seatNumbering,
                    sampleSeatList: seatsResult.seats.seatList
                  };
                  console.log(`  ✅ 좌석 정보 수집 완료 (가용: ${seatsResult.seats.availCnt}/${seatsResult.seats.seatCount})`);
                }
              } catch (seatError) {
                console.log(`  ⚠️ 좌석 정보 수집 실패: ${seatError.message}`);
              }
            }
            
          } else {
            console.log(`  ❌ 시간표 조회 실패: ${timetableResult.message}`);
          }
          
        } catch (routeError) {
          console.log(`  ❌ 노선 상세 정보 수집 실패: ${routeError.message}`);
        }
        
        collectedData.upRoutes.push(routeData);
        
        // API 호출 간격 조절 (너무 빠르게 호출하지 않도록)
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } else {
      console.log('❌ 등교 노선 정보 조회 실패');
    }
    
    // 3. 하교 노선 정보 수집
    console.log('\n📋 하교 노선 정보 수집 중...');
    const downRoutesResult = await reservationService.getFromSchoolRoutes();
    
    if (downRoutesResult.success && downRoutesResult.routes.length > 0) {
      console.log(`✅ 하교 노선 ${downRoutesResult.routes.length}개 발견`);
      
      for (const route of downRoutesResult.routes) {
        console.log(`\n🔍 하교 노선 "${route.lineName}" 상세 정보 수집 중...`);
        
        const routeData = {
          seq: route.seq,
          lineName: route.lineName,
          busCnt: route.busCnt,
          direction: 'DOWN',
          timetables: [],
          stops: []
        };
        
        try {
          // 시간표 조회
          const timetableResult = await reservationService.getBusTimetable(route.seq, 'DOWN');
          
          if (timetableResult.success) {
            console.log(`  📅 시간표 ${timetableResult.timetable.length}개 수집`);
            
            routeData.timetables = timetableResult.timetable.map(bus => ({
              busSeq: bus.busSeq,
              carNum: bus.carNum,
              operateDate: bus.operateDate,
              operateWeek: bus.operateWeek,
              operateTime: bus.operateTime,
              fullOperateTime: bus.fullOperateTime,
              seatCount: bus.seatCount,
              seatNumbering: bus.seatNumbering,
              appCount: bus.appCount,
              readyCount: bus.readyCount
            }));
            
            // 정류장 정보
            if (timetableResult.stopList && timetableResult.stopList.length > 0) {
              console.log(`  🚏 정류장 ${timetableResult.stopList.length}개 수집`);
              
              routeData.stops = timetableResult.stopList.map(stop => ({
                seq: stop.seq,
                stopName: stop.stopName,
                memo: stop.memo,
                cost: stop.cost
              }));
            }
            
            // 각 버스의 좌석 정보도 수집 (첫 번째 버스만)
            if (timetableResult.timetable.length > 0) {
              const firstBus = timetableResult.timetable[0];
              console.log(`  💺 좌석 정보 수집 중... (버스: ${firstBus.operateTime})`);
              
              try {
                const seatsResult = await reservationService.getBusSeats(firstBus.busSeq);
                if (seatsResult.success) {
                  routeData.seatInfo = {
                    availCnt: seatsResult.seats.availCnt,
                    seatCount: seatsResult.seats.seatCount,
                    seatNumbering: seatsResult.seats.seatNumbering,
                    sampleSeatList: seatsResult.seats.seatList
                  };
                  console.log(`  ✅ 좌석 정보 수집 완료 (가용: ${seatsResult.seats.availCnt}/${seatsResult.seats.seatCount})`);
                }
              } catch (seatError) {
                console.log(`  ⚠️ 좌석 정보 수집 실패: ${seatError.message}`);
              }
            }
            
          } else {
            console.log(`  ❌ 시간표 조회 실패: ${timetableResult.message}`);
          }
          
        } catch (routeError) {
          console.log(`  ❌ 노선 상세 정보 수집 실패: ${routeError.message}`);
        }
        
        collectedData.downRoutes.push(routeData);
        
        // API 호출 간격 조절
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } else {
      console.log('❌ 하교 노선 정보 조회 실패');
    }
    
    // 4. 데이터 저장
    console.log('\n💾 수집된 데이터 저장 중...');
    
    // JSON 파일로 저장
    const dataDir = path.join(__dirname, '../../data');
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      // 디렉토리가 이미 존재하는 경우 무시
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonFilePath = path.join(dataDir, `bus-data-${timestamp}.json`);
    
    await fs.writeFile(jsonFilePath, JSON.stringify(collectedData, null, 2), 'utf8');
    console.log(`✅ JSON 파일 저장 완료: ${jsonFilePath}`);
    
    // Firebase 형식으로 변환된 데이터도 저장
    const firebaseData = convertToFirebaseFormat(collectedData);
    const firebaseFilePath = path.join(dataDir, `firebase-data-${timestamp}.json`);
    
    await fs.writeFile(firebaseFilePath, JSON.stringify(firebaseData, null, 2), 'utf8');
    console.log(`✅ Firebase 형식 파일 저장 완료: ${firebaseFilePath}`);
    
    // 5. 요약 정보 출력
    console.log('\n📊 수집 완료 요약:');
    console.log(`- 등교 노선: ${collectedData.upRoutes.length}개`);
    console.log(`- 하교 노선: ${collectedData.downRoutes.length}개`);
    
    const totalUpTimetables = collectedData.upRoutes.reduce((sum, route) => sum + route.timetables.length, 0);
    const totalDownTimetables = collectedData.downRoutes.reduce((sum, route) => sum + route.timetables.length, 0);
    
    console.log(`- 등교 시간표: ${totalUpTimetables}개`);
    console.log(`- 하교 시간표: ${totalDownTimetables}개`);
    
    const totalUpStops = collectedData.upRoutes.reduce((sum, route) => sum + route.stops.length, 0);
    const totalDownStops = collectedData.downRoutes.reduce((sum, route) => sum + route.stops.length, 0);
    
    console.log(`- 등교 정류장: ${totalUpStops}개`);
    console.log(`- 하교 정류장: ${totalDownStops}개`);
    
    console.log('\n🎉 데이터 수집이 완료되었습니다!');
    
    return collectedData;
    
  } catch (error) {
    console.error('❌ 데이터 수집 중 오류 발생:', error.message);
    return null;
  }
}

/**
 * Firebase 형식으로 데이터 변환
 */
function convertToFirebaseFormat(data) {
  const firebaseData = {
    metadata: {
      lastUpdated: data.collectedAt,
      version: '1.0.0'
    },
    routes: {},
    timetables: {},
    stops: {}
  };
  
  // 등교 노선 처리
  data.upRoutes.forEach(route => {
    const routeKey = `up_${route.seq}`;
    
    firebaseData.routes[routeKey] = {
      seq: route.seq,
      lineName: route.lineName,
      busCnt: route.busCnt,
      direction: 'UP',
      stopSeqs: route.stops.map(stop => stop.seq)
    };
    
    // 시간표 데이터
    route.timetables.forEach(timetable => {
      firebaseData.timetables[timetable.busSeq] = {
        ...timetable,
        routeSeq: route.seq,
        direction: 'UP'
      };
    });
    
    // 정류장 데이터
    route.stops.forEach(stop => {
      firebaseData.stops[stop.seq] = stop;
    });
  });
  
  // 하교 노선 처리
  data.downRoutes.forEach(route => {
    const routeKey = `down_${route.seq}`;
    
    firebaseData.routes[routeKey] = {
      seq: route.seq,
      lineName: route.lineName,
      busCnt: route.busCnt,
      direction: 'DOWN',
      stopSeqs: route.stops.map(stop => stop.seq)
    };
    
    // 시간표 데이터
    route.timetables.forEach(timetable => {
      firebaseData.timetables[timetable.busSeq] = {
        ...timetable,
        routeSeq: route.seq,
        direction: 'DOWN'
      };
    });
    
    // 정류장 데이터
    route.stops.forEach(stop => {
      firebaseData.stops[stop.seq] = stop;
    });
  });
  
  return firebaseData;
}

// 스크립트 실행
if (require.main === module) {
  collectBusData().catch(error => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });
}

module.exports = { collectBusData, convertToFirebaseFormat }; 