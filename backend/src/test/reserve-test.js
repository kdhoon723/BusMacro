/**
 * 전체 예약 프로세스 테스트 스크립트
 */
require('dotenv').config();
const admin = require('firebase-admin');
const { db } = require('../firebase/init');
const busReservation = require('../services/busReservation');

// 명령줄 인수 파싱
const args = process.argv.slice(2);
const TEST_DAY = args.find(arg => arg.startsWith('--day='))?.split('=')[1] || 'sunday';
const CUSTOM_ROUTE = args.find(arg => arg.startsWith('--route='))?.split('=')[1] || process.env.CUSTOM_ROUTE || '노원';
const CUSTOM_TO_SCHOOL_TIME = args.find(arg => arg.startsWith('--toSchoolTime='))?.split('=')[1] || process.env.CUSTOM_TO_SCHOOL_TIME || '11:00';
const CUSTOM_FROM_SCHOOL_TIME = args.find(arg => arg.startsWith('--fromSchoolTime='))?.split('=')[1] || process.env.CUSTOM_FROM_SCHOOL_TIME || '13:15';
const CUSTOM_STATION = args.find(arg => arg.startsWith('--station='))?.split('=')[1] || process.env.CUSTOM_STATION || '노원역';

/**
 * 예약 설정 데이터 직접 지정
 */
const TEST_RESERVATION_DATA = {
  dayOfWeek: TEST_DAY, // 테스트 요일 (기본값: 일요일)
  toSchool: {
    enabled: true,
    route: CUSTOM_ROUTE,
    time: CUSTOM_TO_SCHOOL_TIME,
    station: CUSTOM_STATION,
    seatNumber: 11
  },
  fromSchool: {
    enabled: true,
    route: CUSTOM_ROUTE,
    time: CUSTOM_FROM_SCHOOL_TIME,
    station: CUSTOM_STATION,
    seatNumber: 11
  }
};

/**
 * 테스트 데이터를 Firestore에 저장
 */
async function saveTestDataToFirestore() {
  try {
    // Firestore에 테스트 데이터 저장
    await db.collection('schedules').doc(TEST_DAY).set({
      toSchool: TEST_RESERVATION_DATA.toSchool,
      fromSchool: TEST_RESERVATION_DATA.fromSchool
    });
    
    console.log(`테스트 데이터가 Firestore에 저장됨 (${TEST_DAY})`);
    return TEST_RESERVATION_DATA;
  } catch (error) {
    console.error('테스트 데이터 저장 오류:', error);
    throw error;
  }
}

/**
 * 예약 테스트 함수
 */
async function testReservation() {
  console.log('---------- 예약 프로세스 테스트 시작 ----------');
  console.log('테스트 설정:');
  console.log(`- 요일: ${TEST_RESERVATION_DATA.dayOfWeek}`);
  console.log(`- 노선: ${TEST_RESERVATION_DATA.toSchool.route}(등교), ${TEST_RESERVATION_DATA.fromSchool.route}(하교)`);
  console.log(`- 시간: ${TEST_RESERVATION_DATA.toSchool.time}(등교), ${TEST_RESERVATION_DATA.fromSchool.time}(하교)`);
  console.log(`- 정류장: ${TEST_RESERVATION_DATA.toSchool.station}`);
  
  // 전체 테스트 과정 시간 측정 시작
  busReservation.startTimer('전체 테스트 과정');
  
  try {
    // 0. 테스트 데이터 Firestore에 저장
    await saveTestDataToFirestore();
    
    // 1. 로그인 테스트
    console.log('\n[1단계] 로그인 테스트');
    busReservation.startTimer('로그인 테스트');
    await busReservation.login();
    busReservation.endTimer('로그인 테스트');
    console.log('로그인 테스트 성공!\n');
    
    // 2. 예약 프로세스 테스트
    console.log('[2단계] 예약 프로세스 테스트');
    
    // 테스트 모드로 예약 프로세스 실행 (요일 제한 무시)
    busReservation.startTimer('예약 프로세스 실행');
    const result = await busReservation.startReservation(true);
    busReservation.endTimer('예약 프로세스 실행');
    
    console.log('\n예약 프로세스 테스트 결과:', result);
    console.log('예약 테스트 성공!');
    
  } catch (error) {
    console.error('테스트 실패:', error);
  } finally {
    busReservation.endTimer('전체 테스트 과정');
    
    // 모든 타이머 결과 출력
    busReservation.reportTimers();
    
    console.log('\n---------- 예약 프로세스 테스트 종료 ----------');
    
    // 브라우저 종료를 위해 2초 대기 후 프로세스 종료
    console.log('2초 후 프로세스가 종료됩니다...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    process.exit(0);
  }
}

// 테스트 실행
testReservation().catch(error => {
  console.error('테스트 실행 오류:', error);
  process.exit(1);
}); 