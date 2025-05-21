/**
 * 로그인 후 지정된 시간까지 대기했다가 자동으로 예약 진행하는 스크립트
 * 정확한 시간에 예약을 시작하도록 500ms 간격으로 시간 체크
 */
require('dotenv').config();
const admin = require('firebase-admin');
const { db } = require('../firebase/init');
const busReservation = require('../services/busReservation');

// 명령줄 인수 파싱
const args = process.argv.slice(2);
const TEST_MODE = args.includes('--test') || process.env.TEST_MODE === 'true';
const CUSTOM_ROUTE = args.find(arg => arg.startsWith('--route='))?.split('=')[1] || process.env.CUSTOM_ROUTE || '노원';
const CUSTOM_TO_SCHOOL_TIME = args.find(arg => arg.startsWith('--toSchoolTime='))?.split('=')[1] || process.env.CUSTOM_TO_SCHOOL_TIME || '11:00';
const CUSTOM_FROM_SCHOOL_TIME = args.find(arg => arg.startsWith('--fromSchoolTime='))?.split('=')[1] || process.env.CUSTOM_FROM_SCHOOL_TIME || '15:45';
const CUSTOM_STATION = args.find(arg => arg.startsWith('--station='))?.split('=')[1] || process.env.CUSTOM_STATION || '노원역';
const TEST_DAY = args.find(arg => arg.startsWith('--day='))?.split('=')[1] || 'sunday';

// 시작 시간 설정 (기본값: 현재 시간 + 1분)
let startTimeArg = args.find(arg => arg.startsWith('--start-time='))?.split('=')[1];
let targetHour, targetMinute, targetSecond = 0;

if (startTimeArg) {
  // HH:MM[:SS] 형식 파싱
  const timeParts = startTimeArg.split(':');
  targetHour = parseInt(timeParts[0], 10);
  targetMinute = parseInt(timeParts[1], 10);
  if (timeParts.length > 2) {
    targetSecond = parseInt(timeParts[2], 10);
  }
} else {
  // 기본값: 현재 시간 + 1분
  const now = new Date();
  targetHour = now.getHours();
  targetMinute = now.getMinutes() + 1;
  if (targetMinute >= 60) {
    targetHour = (targetHour + 1) % 24;
    targetMinute = targetMinute % 60;
  }
}

/**
 * 테스트용 예약 데이터 생성
 */
function createTestReservationData() {
  console.log(`테스트 예약 데이터 생성 - 요일: ${TEST_DAY}`);
  
  return {
    dayOfWeek: TEST_DAY,
    // 등교 정보
    toSchool: {
      enabled: true,
      route: CUSTOM_ROUTE,
      time: CUSTOM_TO_SCHOOL_TIME,
      station: CUSTOM_STATION,
      seatNumber: 11
    },
    // 하교 정보
    fromSchool: {
      enabled: true,
      route: CUSTOM_ROUTE,
      time: CUSTOM_FROM_SCHOOL_TIME,
      station: CUSTOM_STATION,
      seatNumber: 11
    }
  };
}

/**
 * 테스트 예약 데이터를 파이어스토어에 저장
 */
async function saveTestDataToFirestore() {
  try {
    console.log(`현재 요일: ${TEST_DAY}`);
    
    const testData = createTestReservationData();
    
    // 파이어스토어에 테스트 데이터 저장
    await db.collection('schedules').doc(TEST_DAY).set({
      toSchool: testData.toSchool,
      fromSchool: testData.fromSchool
    });
    
    console.log(`테스트 데이터가 Firestore에 저장됨 (${TEST_DAY})`);
    return testData;
  } catch (error) {
    console.error('테스트 데이터 저장 오류:', error);
    throw error;
  }
}

/**
 * 정확한 시작 시간까지 대기 후 예약 실행 함수
 */
async function waitUntilTimeAndReserve() {
  const targetTimeStr = `${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')}:${String(targetSecond).padStart(2, '0')}`;
  console.log(`---------- 예약 대기 스크립트 시작 (목표 시간: ${targetTimeStr}) ----------`);
  
  // 테스트 모드 및 설정 정보 표시
  const testModeStr = TEST_MODE ? '활성화' : '비활성화';
  console.log(`테스트 모드: ${testModeStr}`);
  console.log(`테스트 설정:`);
  console.log(`- 요일: ${TEST_DAY}`);
  console.log(`- 노선: ${CUSTOM_ROUTE}`);
  console.log(`- 등교 시간: ${CUSTOM_TO_SCHOOL_TIME}`);
  console.log(`- 하교 시간: ${CUSTOM_FROM_SCHOOL_TIME}`);
  console.log(`- 정류장: ${CUSTOM_STATION}`);
  
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
    
    // 2. 지정된 시간까지 대기
    console.log(`[2단계] ${targetTimeStr}까지 대기 시작`);
    busReservation.startTimer('대기 단계');
    
    const waitUntilExactTime = () => {
      return new Promise(resolve => {
        // 남은 시간 계산 함수
        const calculateTimeRemaining = () => {
          const now = new Date();
          const target = new Date();
          
          // 목표 시간 설정
          target.setHours(targetHour, targetMinute, targetSecond, 0);
          
          // 이미 목표 시간이 지난 경우
          if (now >= target) {
            console.log('이미 목표 시간이 지났습니다. 바로 예약을 진행합니다.');
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
          
          const nowTime = new Date();
          const nowTimeStr = `${nowTime.getHours()}:${nowTime.getMinutes()}:${nowTime.getSeconds()}.${nowTime.getMilliseconds().toString().padStart(3, '0')}`;
          
          if (hours > 0) {
            console.log(`현재 시간: ${nowTimeStr} | 목표 시간까지 남은 시간: ${hours}시간 ${minutes}분 ${seconds}초`);
          } else if (minutes > 0) {
            console.log(`현재 시간: ${nowTimeStr} | 목표 시간까지 남은 시간: ${minutes}분 ${seconds}초`);
          } else if (showMilliseconds) {
            console.log(`현재 시간: ${nowTimeStr} | 목표 시간까지 남은 시간: ${seconds}.${milliseconds.toString().padStart(3, '0')}초`);
          } else {
            console.log(`현재 시간: ${nowTimeStr} | 목표 시간까지 남은 시간: ${seconds}초`);
          }
          
          // 남은 시간이 거의 없으면 정확한 시간에 실행하도록 설정
          if (timeRemaining <= 50) {
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
          startChecking(500, true); // 10초 이하면 500ms마다 체크 (요구사항대로 500ms 간격)
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
    
    // 예약 시작 시간 정확히 기록
    const startExactTime = new Date();
    const startTimeStr = `${String(startExactTime.getHours()).padStart(2, '0')}:${String(startExactTime.getMinutes()).padStart(2, '0')}:${String(startExactTime.getSeconds()).padStart(2, '0')}.${String(startExactTime.getMilliseconds()).padStart(3, '0')}`;
    console.log(`\n정확한 예약 시작 시간: ${startTimeStr}`);
    
    // 3. 예약 프로세스 시작 (테스트 데이터 이미 설정됨)
    console.log('[3단계] 예약 프로세스 시작 - ' + startExactTime.toISOString());
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
waitUntilTimeAndReserve().catch(error => {
  console.error('스크립트 실행 오류:', error);
  process.exit(1);
}); 