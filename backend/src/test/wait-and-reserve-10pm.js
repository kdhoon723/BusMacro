/**
 * 로그인 후 22시 정각까지 대기하다가 자동으로 예약 진행하는 스크립트
 * 정확한 22시 00분 00초 000밀리초에 예약 실행을 위한 정밀 타이머 적용
 * 테스트용 노선 및 시간 설정: 노원 하교 15:30, 등교 08:10
 */
require('dotenv').config();
const admin = require('firebase-admin');
const { db } = require('../firebase/init');
const busReservation = require('../services/busReservation');

// 명령줄 인수 파싱
const args = process.argv.slice(2);
const TEST_MODE = args.includes('--test') || process.env.TEST_MODE === 'true';
const CUSTOM_ROUTE = process.env.CUSTOM_ROUTE;
const CUSTOM_TO_SCHOOL_TIME = process.env.CUSTOM_TO_SCHOOL_TIME;
const CUSTOM_FROM_SCHOOL_TIME = process.env.CUSTOM_FROM_SCHOOL_TIME;
const CUSTOM_STATION = process.env.CUSTOM_STATION;

/**
 * 요일 확인 함수 (직접 구현)
 */
function getDayOfWeek() {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = new Date().getDay();
  return days[dayIndex];
}

/**
 * 테스트용 예약 데이터 생성
 */
function createTestReservationData() {
  // 현재 요일에 맞춰 예약 정보 생성
  const dayOfWeek = getDayOfWeek();
  
  console.log(`테스트 예약 데이터 생성 - 요일: ${dayOfWeek}`);
  
  return {
    dayOfWeek,
    // 등교 정보
    toSchool: {
      enabled: true,
      route: CUSTOM_ROUTE || '노원', // 커스텀 노선 또는 기본값 노원
      time: CUSTOM_TO_SCHOOL_TIME || '08:10',  // 커스텀 등교 시간 또는 기본값 08:10
      station: CUSTOM_STATION || '노원역',  // 커스텀 정류장 또는 기본값 노원역
      seatNumber: 1  // 선호 좌석
    },
    // 하교 정보
    fromSchool: {
      enabled: true,
      route: CUSTOM_ROUTE || '노원', // 커스텀 노선 또는 기본값 노원
      time: CUSTOM_FROM_SCHOOL_TIME || '15:30',  // 커스텀 하교 시간 또는 기본값 15:30
      station: CUSTOM_STATION || '노원역',  // 커스텀 정류장 또는 기본값 노원역
      seatNumber: 1  // 선호 좌석
    }
  };
}

/**
 * 테스트 예약 데이터를 파이어스토어에 저장
 */
async function saveTestDataToFirestore() {
  try {
    const dayOfWeek = getDayOfWeek();
    console.log(`현재 요일: ${dayOfWeek}`);
    
    // 테스트 모드이면 현재 요일 그대로 사용, 아니면 일/월/화만 허용
    const targetDay = TEST_MODE 
      ? dayOfWeek
      : ['sunday', 'monday', 'tuesday'].includes(dayOfWeek) 
        ? dayOfWeek 
        : 'sunday'; // 테스트 모드가 아니고 지원되지 않는 요일이면 일요일로 설정
    
    const testData = createTestReservationData();
    
    // 파이어스토어에 테스트 데이터 저장
    await db.collection('schedules').doc(targetDay).set({
      toSchool: testData.toSchool,
      fromSchool: testData.fromSchool
    });
    
    console.log(`테스트 데이터가 Firestore에 저장됨 (${targetDay})`);
    return testData;
  } catch (error) {
    console.error('테스트 데이터 저장 오류:', error);
    throw error;
  }
}

/**
 * 정각까지 대기 후 예약 실행 함수
 */
async function waitUntil10pmAndReserve() {
  // 테스트 모드 및 설정 정보 표시
  const testModeStr = TEST_MODE ? '활성화' : '비활성화';
  console.log('---------- 정밀 예약 대기 스크립트 시작 (22시 예약) ----------');
  console.log(`테스트 모드: ${testModeStr}`);
  
  if (TEST_MODE) {
    console.log('커스텀 설정:');
    console.log(`- 노선: ${CUSTOM_ROUTE || '기본값(노원)'}`);
    console.log(`- 등교 시간: ${CUSTOM_TO_SCHOOL_TIME || '기본값(08:10)'}`);
    console.log(`- 하교 시간: ${CUSTOM_FROM_SCHOOL_TIME || '기본값(15:30)'}`);
    console.log(`- 정류장: ${CUSTOM_STATION || '기본값(노원역)'}`);
  } else {
    console.log('테스트 노선: 노원, 하교 15:30, 등교 08:10');
  }
  
  // 전체 프로세스 시간 측정 시작
  busReservation.startTimer('전체 예약 대기 프로세스');
  
  try {
    // 0. 테스트 데이터 저장
    console.log('\n[0단계] 테스트 데이터 준비');
    await saveTestDataToFirestore();
    console.log('테스트 데이터 준비 완료!\n');
    
    // 1. 로그인 진행
    console.log('\n[1단계] 로그인 시작');
    busReservation.startTimer('로그인 단계');
    await busReservation.login();
    busReservation.endTimer('로그인 단계');
    console.log('로그인 성공!\n');
    
    // 2. 22시 정각까지 대기
    console.log('[2단계] 22시(10:00 PM) 정각까지 대기 시작');
    busReservation.startTimer('대기 단계');
    
    const waitUntilExactTime = () => {
      return new Promise(resolve => {
        // 최초 시간 계산
        const calculateTimeRemaining = () => {
          const now = new Date();
          const target = new Date();
          
          // 오늘 22시로 설정
          target.setHours(22, 0, 0, 0);
          
          // 이미 22시가 지난 경우
          if (now >= target) {
            console.log('이미 22시가 지났습니다. 바로 예약을 진행합니다.');
            if (intervalId) clearInterval(intervalId);
            resolve();
            return 0;
          }
          
          // 남은 시간 계산 (밀리초 단위)
          return target - now;
        };
        
        // 남은 시간 출력 함수
        const printRemainingTime = (showMilliseconds = false) => {
          const timeRemaining = calculateTimeRemaining();
          if (timeRemaining === 0) return; // 이미 종료된 경우
          
          const hours = Math.floor(timeRemaining / 1000 / 60 / 60);
          const minutes = Math.floor((timeRemaining / 1000 / 60) % 60);
          const seconds = Math.floor((timeRemaining / 1000) % 60);
          const milliseconds = timeRemaining % 1000;
          
          if (hours > 0) {
            console.log(`22시까지 남은 시간: ${hours}시간 ${minutes}분 ${seconds}초`);
          } else if (minutes > 0) {
            console.log(`22시까지 남은 시간: ${minutes}분 ${seconds}초`);
          } else if (showMilliseconds) {
            console.log(`22시까지 남은 시간: ${seconds}.${milliseconds.toString().padStart(3, '0')}초`);
          } else {
            console.log(`22시까지 남은 시간: ${seconds}초`);
          }
          
          // 남은 시간이 거의 없으면 정각에 정확히 실행하도록 설정
          if (timeRemaining <= 100) {
            if (intervalId) clearInterval(intervalId);
            setTimeout(resolve, timeRemaining);
          }
        };
        
        // 초기 남은 시간 출력
        printRemainingTime();
        
        // 주기적으로 남은 시간 업데이트
        let updateInterval;
        let intervalId = null;
        
        const startChecking = (interval, showMs = false) => {
          if (intervalId) clearInterval(intervalId);
          updateInterval = interval;
          intervalId = setInterval(() => {
            const timeRemaining = calculateTimeRemaining();
            if (timeRemaining === 0) return; // 이미 종료된 경우
            
            printRemainingTime(showMs);
            
            // 남은 시간에 따라 업데이트 주기 변경
            if (timeRemaining <= 3000 && updateInterval !== 100) {
              // 3초 이하면 100ms 단위로 극도로 정밀하게 체크
              startChecking(100, true);
            } else if (timeRemaining <= 10000 && updateInterval !== 500) {
              // 10초 이하면 500ms 단위로 정밀하게 체크
              startChecking(500, true);
            } else if (timeRemaining <= 60000 && updateInterval !== 1000) {
              // 1분 이하면 1초 단위로 체크
              startChecking(1000);
            } else if (timeRemaining <= 300000 && updateInterval !== 5000) {
              // 5분 이하면 5초 단위로 체크
              startChecking(5000);
            } else if (timeRemaining <= 600000 && updateInterval !== 10000) {
              // 10분 이하면 10초 단위로 체크
              startChecking(10000);
            }
          }, interval);
        };
        
        // 남은 시간을 체크하고 적절한 간격 설정
        const timeRemaining = calculateTimeRemaining();
        if (timeRemaining <= 3000) {
          startChecking(100, true); // 3초 이하면 100ms마다 체크
        } else if (timeRemaining <= 10000) {
          startChecking(500, true); // 10초 이하면 500ms마다 체크
        } else if (timeRemaining <= 60000) {
          startChecking(1000); // 1분 이하면 1초마다 체크
        } else if (timeRemaining <= 300000) {
          startChecking(5000); // 5분 이하면 5초마다 체크
        } else if (timeRemaining <= 600000) {
          startChecking(10000); // 10분 이하면 10초마다 체크
        } else {
          startChecking(30000); // 10분 이상이면 30초마다 체크
        }
      });
    };
    
    await waitUntilExactTime();
    busReservation.endTimer('대기 단계');
    console.log('22시 정각이 되었습니다. 예약을 시작합니다.\n');
    
    // 3. 예약 프로세스 시작 (테스트 데이터 이미 설정됨)
    console.log('[3단계] 예약 프로세스 시작 - ' + new Date().toISOString());
    busReservation.startTimer('예약 실행 단계');
    const result = await busReservation.startReservation(TEST_MODE); // 테스트 모드 전달
    busReservation.endTimer('예약 실행 단계');
    
    console.log('\n예약 프로세스 결과:', result);
    console.log('예약 처리 완료!');
    
  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    busReservation.endTimer('전체 예약 대기 프로세스');
    
    // 모든 타이머 결과 출력
    busReservation.reportTimers();
    
    console.log('\n---------- 예약 대기 스크립트 종료 ----------');
    
    // 브라우저 종료를 위해 2초 대기 후 프로세스 종료
    console.log('2초 후 프로세스가 종료됩니다...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    process.exit(0);
  }
}

// 스크립트 실행
waitUntil10pmAndReserve().catch(error => {
  console.error('스크립트 실행 오류:', error);
  process.exit(1);
}); 