/**
 * 로그인 후 21시 정각까지 대기하다가 자동으로 예약 진행하는 스크립트
 */
require('dotenv').config();
const admin = require('firebase-admin');
const { db } = require('../firebase/init');
const busReservation = require('../services/busReservation');

/**
 * 정각까지 대기 후 예약 실행 함수
 */
async function waitUntil9pmAndReserve() {
  console.log('---------- 예약 대기 스크립트 시작 ----------');
  
  // 전체 프로세스 시간 측정 시작
  busReservation.startTimer('전체 예약 대기 프로세스');
  
  try {
    // 1. 로그인 진행
    console.log('\n[1단계] 로그인 시작');
    busReservation.startTimer('로그인 단계');
    await busReservation.login();
    busReservation.endTimer('로그인 단계');
    console.log('로그인 성공!\n');
    
    // 2. 21시 정각까지 대기
    console.log('[2단계] 21시(09:00 PM) 정각까지 대기 시작');
    busReservation.startTimer('대기 단계');
    
    const waitUntil9pm = () => {
      return new Promise(resolve => {
        // 최초 시간 계산
        const calculateTimeRemaining = () => {
          const now = new Date();
          const target = new Date();
          
          // 오늘 21시로 설정
          target.setHours(21, 0, 0, 0);
          
          // 이미 21시가 지난 경우
          if (now >= target) {
            console.log('이미 21시가 지났습니다. 바로 예약을 진행합니다.');
            clearInterval(intervalId);
            resolve();
            return 0;
          }
          
          // 남은 시간 계산
          return target - now;
        };
        
        // 남은 시간 출력 함수
        const printRemainingTime = () => {
          const timeRemaining = calculateTimeRemaining();
          if (timeRemaining === 0) return; // 이미 종료된 경우
          
          const hours = Math.floor(timeRemaining / 1000 / 60 / 60);
          const minutes = Math.floor((timeRemaining / 1000 / 60) % 60);
          const seconds = Math.floor((timeRemaining / 1000) % 60);
          
          if (hours > 0) {
            console.log(`21시까지 남은 시간: ${hours}시간 ${minutes}분 ${seconds}초`);
          } else if (minutes > 0) {
            console.log(`21시까지 남은 시간: ${minutes}분 ${seconds}초`);
          } else {
            console.log(`21시까지 남은 시간: ${seconds}초`);
          }
          
          // 남은 시간이 거의 없으면 정각에 실행하도록 설정
          if (timeRemaining <= 1000) {
            clearInterval(intervalId);
            setTimeout(resolve, timeRemaining);
          }
        };
        
        // 초기 남은 시간 출력
        printRemainingTime();
        
        // 주기적으로 남은 시간 업데이트
        let updateInterval = 60000; // 기본 1분마다 업데이트
        const initialTimeRemaining = calculateTimeRemaining();
        
        if (initialTimeRemaining <= 60000) { // 1분 이하면 10초마다
          updateInterval = 10000;
        } else if (initialTimeRemaining <= 600000) { // 10분 이하면 1분마다
          updateInterval = 60000;
        } else { // 그 외에는 5분마다
          updateInterval = 300000;
        }
        
        let intervalId = setInterval(() => {
          const timeRemaining = calculateTimeRemaining();
          if (timeRemaining === 0) return; // 이미 종료된 경우
          
          printRemainingTime();
          
          // 남은 시간에 따라 업데이트 주기 변경
          if (timeRemaining <= 60000 && updateInterval !== 10000) { // 1분 이하면 10초마다
            clearInterval(intervalId);
            intervalId = setInterval(printRemainingTime, 10000);
          } else if (timeRemaining <= 600000 && updateInterval !== 60000) { // 10분 이하면 1분마다
            clearInterval(intervalId);
            intervalId = setInterval(printRemainingTime, 60000);
          }
        }, updateInterval);
      });
    };
    
    await waitUntil9pm();
    busReservation.endTimer('대기 단계');
    console.log('21시 정각이 되었습니다. 예약을 시작합니다.\n');
    
    // 3. 예약 프로세스 시작
    console.log('[3단계] 예약 프로세스 시작');
    busReservation.startTimer('예약 실행 단계');
    const result = await busReservation.startReservation();
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
waitUntil9pmAndReserve().catch(error => {
  console.error('스크립트 실행 오류:', error);
  process.exit(1);
}); 