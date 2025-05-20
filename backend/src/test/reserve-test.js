/**
 * 전체 예약 프로세스 테스트 스크립트
 */
require('dotenv').config();
const admin = require('firebase-admin');
const { db } = require('../firebase/init');
const busReservation = require('../services/busReservation');

/**
 * 예약 설정 데이터 직접 지정
 */
const TEST_RESERVATION_DATA = {
  dayOfWeek: 'sunday', // 일요일 예약 테스트 (실행하는 요일에 맞게 변경 필요)
  toSchool: {
    enabled: true,
    route: '장기/대화',
    time: '07:40',
    station: '대화역',
    seatNumber: 11
  },
  fromSchool: {
    enabled: true,
    route: '대화A',
    time: '15:45',
    station: '대화역',
    seatNumber: 11
  }
};

/**
 * 예약 테스트 함수
 */
async function testReservation() {
  console.log('---------- 예약 프로세스 테스트 시작 ----------');
  
  // 전체 테스트 과정 시간 측정 시작
  busReservation.startTimer('전체 테스트 과정');
  
  try {
    // 1. 로그인 테스트
    console.log('\n[1단계] 로그인 테스트');
    busReservation.startTimer('로그인 테스트');
    await busReservation.login();
    busReservation.endTimer('로그인 테스트');
    console.log('로그인 테스트 성공!\n');
    
    // 2. 예약 프로세스 테스트 (Firebase 데이터 대신 테스트 데이터 직접 사용)
    console.log('[2단계] 예약 프로세스 테스트');
    
    // 원본 함수 백업
    const originalGetReservationData = busReservation.getReservationData;
    
    // getReservationData 함수 모킹 (테스트 데이터 반환)
    busReservation.getReservationData = async () => {
      console.log('테스트 예약 데이터 사용:', TEST_RESERVATION_DATA);
      return TEST_RESERVATION_DATA;
    };
    
    try {
      // 전체 예약 프로세스 실행
      busReservation.startTimer('예약 프로세스 실행');
      const result = await busReservation.startReservation();
      busReservation.endTimer('예약 프로세스 실행');
      
      console.log('\n예약 프로세스 테스트 결과:', result);
      console.log('예약 테스트 성공!');
    } finally {
      // 원본 함수 복원
      busReservation.getReservationData = originalGetReservationData;
    }
    
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