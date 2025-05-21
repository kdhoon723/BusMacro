/**
 * 버스 예약 자동화 서비스
 */
const puppeteer = require('puppeteer');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const db = getFirestore();

// 브라우저 인스턴스
let browser = null;
let page = null;

// 예약 일정 캐시
let nextSchedule = null;

// 스크린샷 저장 디렉토리 (config에서 가져오기)
const SCREENSHOT_DIR = config.screenshotConfig.dir;

// 타이머 관련 변수
const timers = {};
const processStartTime = {};

/**
 * 타이머 시작 함수
 */
function startTimer(processName) {
  timers[processName] = {
    start: Date.now(),
    end: null,
    duration: null
  };
  console.log(`[TIMER] '${processName}' 프로세스 시작`);
  logger.logProcessStart(processName);
  return timers[processName].start;
}

/**
 * 타이머 종료 함수
 */
function endTimer(processName) {
  if (!timers[processName]) {
    console.warn(`[TIMER] '${processName}' 타이머가 시작되지 않았습니다.`);
    return 0;
  }
  
  timers[processName].end = Date.now();
  timers[processName].duration = timers[processName].end - timers[processName].start;
  
  console.log(`[TIMER] '${processName}' 프로세스 완료: ${timers[processName].duration}ms`);
  logger.logProcessEnd(processName, timers[processName].duration);
  return timers[processName].duration;
}

/**
 * 타이머 보고 함수 - 전체 과정 시간 요약
 */
function reportTimers() {
  console.log("\n==== 프로세스 시간 요약 ====");
  let totalTime = 0;
  const timerSummary = {};
  
  Object.keys(timers).forEach(process => {
    if (timers[process].duration) {
      console.log(`- ${process}: ${timers[process].duration}ms`);
      timerSummary[process] = timers[process].duration;
      totalTime += timers[process].duration;
    } else if (timers[process].start) {
      const current = Date.now();
      const ongoing = current - timers[process].start;
      console.log(`- ${process}: ${ongoing}ms (진행 중)`);
      timerSummary[process] = `${ongoing}ms (진행 중)`;
    }
  });
  
  console.log(`==== 총 소요 시간: ${totalTime}ms ====\n`);
  
  // 타이머 요약 로깅
  logger.saveLogToFirestore('info', '프로세스 타이머 요약', {
    type: 'timer_summary',
    totalTime,
    timers: timerSummary
  });
  
  return {
    totalTime,
    timers: timerSummary
  };
}

/**
 * 지정된 시간(ms) 동안 대기하는 함수
 */
function delay(time) {
  return new Promise(function(resolve) { 
    setTimeout(resolve, time);
  });
}

/**
 * 알림창 확인 버튼 클릭 처리 헬퍼 함수
 * 최대 시도 횟수만큼 확인 버튼을 찾아 클릭 시도
 */
async function handleConfirmDialogs(screenshotPrefix = 'dialog', maxAttempts = 3) {
  const processName = `알림창 처리(${screenshotPrefix})`;
  startTimer(processName);
  
  let attemptCount = 0;
  let dialogFound = false;
  
  while (attemptCount < maxAttempts) {
    try {
      console.log(`알림창 확인 시도 ${attemptCount + 1}/${maxAttempts}`);
      
      // 알림창 확인 버튼 존재 여부 확인
      const hasDialog = await page.evaluate(() => {
        const confirmBtn = document.querySelector('.swal2-confirm');
        return confirmBtn && window.getComputedStyle(confirmBtn).display !== 'none';
      });
      
      if (!hasDialog) {
        console.log('더 이상 처리할 알림창이 없습니다.');
        break;
      }
      
      dialogFound = true;
      
      // 알림창 내용 확인
      const dialogMessage = await page.evaluate(() => {
        const element = document.querySelector('.swal2-html-container');
        return element ? element.textContent.trim() : '';
      });
      
      console.log(`알림창 메시지: ${dialogMessage}`);
      
      // 대화상자 내용 로깅
      logger.saveLogToFirestore('info', `알림창 메시지: ${dialogMessage}`, {
        type: 'dialog',
        dialogType: screenshotPrefix,
        attempt: attemptCount + 1
      });
      
      await takeScreenshot(`${screenshotPrefix}-attempt-${attemptCount + 1}`);
      
      // 다이얼로그 버튼 클릭 시도
      try {
        // 방법 1: 직접 클릭
        await page.click('.swal2-confirm');
        console.log('방법 1: 확인 버튼 직접 클릭 성공');
      } catch (err) {
        console.log('방법 1 실패, 방법 2 시도:', err.message);
        
        try {
          // 방법 2: JavaScript로 클릭
          await page.evaluate(() => {
            const confirmBtn = document.querySelector('.swal2-confirm');
            if (confirmBtn) confirmBtn.click();
          });
          console.log('방법 2: 자바스크립트로 확인 버튼 클릭 성공');
        } catch (err2) {
          console.log('방법 2 실패, 방법 3 시도:', err2.message);
          
          // 방법 3: dispatchEvent 사용
          await page.evaluate(() => {
            const confirmBtn = document.querySelector('.swal2-confirm');
            if (confirmBtn) {
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              confirmBtn.dispatchEvent(clickEvent);
            }
          });
          console.log('방법 3: 이벤트로 확인 버튼 클릭 시도');
        }
      }
      
      attemptCount++;
      
    } catch (error) {
      console.warn(`알림창 처리 오류(무시됨): ${error.message}`);
      attemptCount++;
    }
  }
  
  endTimer(processName);
  return dialogFound;
}

/**
 * 스크린샷 저장 경로 생성
 */
async function ensureScreenshotDir() {
  try {
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    console.log('스크린샷 디렉토리 준비 완료');
  } catch (error) {
    console.error('스크린샷 디렉토리 생성 오류:', error);
  }
}

/**
 * 스크린샷 촬영 함수
 */
async function takeScreenshot(name) {
  // 스크린샷 설정이 비활성화되었거나 페이지가 없으면 무시
  if (!page || !config.screenshotConfig.enabled) return null;
  
  try {
    await ensureScreenshotDir();
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `${timestamp}_${name}.png`;
    const filePath = path.join(SCREENSHOT_DIR, filename);
    
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`스크린샷 저장: ${filename}`);
    
    // 스크린샷 로깅
    logger.logScreenshot(name, filePath);
    
    return filename;
  } catch (error) {
    console.error('스크린샷 촬영 오류:', error);
    return null;
  }
}

/**
 * 브라우저 초기화
 */
async function initBrowser() {
  const processName = "브라우저 초기화";
  startTimer(processName);
  
  if (!browser) {
    console.log('브라우저 초기화');
    // config에서 브라우저 설정 가져오기
    browser = await puppeteer.launch(config.browserConfig);
  }

  if (!page) {
    page = await browser.newPage();
    // 기본 타임아웃 설정
    page.setDefaultTimeout(30000);
    // 모바일 사이트로 인식되도록 설정
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1');
  }

  endTimer(processName);
  return { browser, page };
}

/**
 * 사이트 로그인
 */
async function login() {
  const processName = "로그인";
  startTimer(processName);
  
  try {
    const { page } = await initBrowser();
    
    // 로그인 페이지 접속
    console.log('로그인 페이지 접속');
    await page.goto('https://daejin.unibus.kr/#/', { waitUntil: 'networkidle2' });
    
    // 스크린샷 촬영: 로그인 페이지
    await takeScreenshot('login-page');
    
    // 로그인 정보 입력
    console.log('로그인 정보 입력');
    await page.type('#id', process.env.DJ_ID);
    await page.type('#pass', process.env.DJ_PASSWORD);
    
    // 로그인 버튼 클릭
    console.log('로그인 버튼 클릭');
    await page.click('button.btn.btn-primary.btn-block');
    
    // 로그인 성공 확인 (알림창 등)
    await page.waitForSelector('.swal2-confirm', { visible: true, timeout: 5000 });
    
    // 스크린샷 촬영: 로그인 확인
    await takeScreenshot('login-confirm');
    
    await page.click('.swal2-confirm');
    
    console.log('로그인 완료');
    
    // 메인 페이지가 로드될 때까지 대기
    await page.waitForSelector('a.list-group-item[href="#/busReserve"]', { visible: true });
    
    // 스크린샷 촬영: 메인 페이지
    await takeScreenshot('main-page');
    
    endTimer(processName);
    return true;
  } catch (error) {
    console.error('로그인 오류:', error);
    // 오류 화면 스크린샷
    await takeScreenshot('login-error');
    endTimer(processName);
    throw new Error(`로그인 실패: ${error.message}`);
  }
}

/**
 * 당일 요일 확인
 */
function getDayOfWeek() {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = new Date().getDay();
  return days[dayIndex];
}

/**
 * 예약 정보 가져오기
 * @param {boolean} testMode - 테스트 모드 여부 (요일 제한 무시)
 */
async function getReservationData(testMode = false) {
  const processName = "예약 정보 로드";
  startTimer(processName);
  
  try {
    const dayOfWeek = getDayOfWeek();
    console.log(`오늘 요일: ${dayOfWeek}`);
    
    // 테스트 모드가 아닐 경우에만 요일 제한 체크
    if (!testMode && !['sunday', 'monday', 'tuesday'].includes(dayOfWeek)) {
      endTimer(processName);
      throw new Error('지원하지 않는 요일입니다 (일, 월, 화요일만 예약 가능)');
    }
    
    // Firestore에서 예약 정보 가져오기
    const schedulesDoc = await db.collection('schedules').doc(dayOfWeek).get();
    if (!schedulesDoc.exists) {
      endTimer(processName);
      throw new Error(`${dayOfWeek} 요일 예약 정보가 없습니다`);
    }
    
    const scheduleData = schedulesDoc.data();
    console.log('예약 정보 로드 완료:', scheduleData);
    
    endTimer(processName);
    return {
      dayOfWeek,
      toSchool: scheduleData.toSchool,
      fromSchool: scheduleData.fromSchool
    };
  } catch (error) {
    console.error('예약 정보 로드 오류:', error);
    endTimer(processName);
    throw new Error(`예약 정보 로드 실패: ${error.message}`);
  }
}

/**
 * 버스예약 페이지로 이동
 */
async function navigateToBusReservePage() {
  const processName = "버스예약 페이지 이동";
  startTimer(processName);
  
  try {
    const { page } = await initBrowser();
    
    // 버스예약 링크 클릭
    console.log('버스예약 페이지로 이동');
    await page.click('a.list-group-item[href="#/busReserve"]');
    
    // 페이지 로드 대기 - 더 안정적인 선택자 사용
    // '노선 선택' 라벨이 표시될 때까지 대기
    console.log('버스예약 페이지 로드 대기');
    await page.waitForFunction(
      () => {
        const labels = Array.from(document.querySelectorAll('label'));
        return labels.some(label => label.textContent.includes('노선 선택'));
      },
      { timeout: 10000 }
    );
    
    // 추가 확인을 위해 예약 버튼도 있는지 확인
    await page.waitForSelector('button.btn.btn-primary.btn-lg.btn-block', { visible: true });
    
    console.log('버스예약 페이지 로드 완료');
    endTimer(processName);
    return true;
  } catch (error) {
    console.error('버스예약 페이지 이동 오류:', error);
    endTimer(processName);
    throw new Error(`버스예약 페이지 이동 실패: ${error.message}`);
  }
}

/**
 * 좌석 선택 또는 대기예약 설정 헬퍼 함수
 * 두 예약 함수(등교/하교)에서 공통으로 사용하는 좌석 선택 로직
 */
async function selectSeatOrWaiting(page, seatNumber, routeType) {
  console.log(`${routeType} 좌석 목록 로드 대기`);
  
  // 좌석 로드 대기 (페이지 로딩)
  try {
    // 좌석 버튼 또는 대기예약 메시지가 나타날 때까지 기다림
    await page.waitForFunction(() => {
      return document.querySelectorAll('.seatBtn').length > 0 || 
             (document.querySelector('div[ng-if="isReadyApp==\'YES\'"]') !== null);
    }, { timeout: 10000 });
  } catch (e) {
    console.log('좌석 로딩 타임아웃:', e.message);
    // 에러가 발생해도 계속 진행
  }
  
  // 대기예약 상태 확인
  const isWaitingReservation = await page.evaluate(() => {
    try {
      // Angular 스코프 확인
      const angularScope = angular.element(document.querySelector('[ng-controller="busReserveCtrl"]')).scope();
      
      // 1. 명시적인 대기예약 메시지 확인
      const waitingMsg = document.querySelector('div[ng-if="isReadyApp==\'YES\'"]');
      if (waitingMsg && waitingMsg.textContent.includes('모든 좌석이 예약되어')) {
        // Angular 스코프가 있으면 대기예약 상태 설정
        if (angularScope && angularScope.busAppForm) {
          angularScope.busAppForm.wait = true;
          angularScope.busAppForm.seatNo = null;
          
          // 변경사항 적용
          if (typeof angularScope.$apply === 'function') {
            angularScope.$apply();
          }
        }
        return true;
      }
      
      // 2. 모든 좌석 버튼 확인 - 전부 disabled인지
      const seatButtons = document.querySelectorAll('.seatBtn');
      const allDisabled = Array.from(seatButtons).every(btn => 
        btn.disabled || btn.classList.contains('disableSeatBtn')
      );
      
      if (allDisabled && seatButtons.length > 0) {
        // 모든 좌석이 disabled면 대기예약으로 설정
        if (angularScope && angularScope.busAppForm) {
          angularScope.busAppForm.wait = true;
          angularScope.busAppForm.seatNo = null;
          
          // 변경사항 적용
          if (typeof angularScope.$apply === 'function') {
            angularScope.$apply();
          }
        }
        return true;
      }
      
      // 3. 버튼 텍스트에 "대기" 포함 확인
      const reserveButton = document.querySelector('button.btn.btn-primary.btn-lg.btn-block');
      if (reserveButton && reserveButton.textContent.includes('대기')) {
        // 버튼이 대기예약이면 상태도 일치시킴
        if (angularScope && angularScope.busAppForm) {
          angularScope.busAppForm.wait = true;
          angularScope.busAppForm.seatNo = null;
          
          // 변경사항 적용
          if (typeof angularScope.$apply === 'function') {
            angularScope.$apply();
          }
        }
        return true;
      }
      
      return false;
    } catch (e) {
      console.error("대기예약 상태 확인 중 오류:", e);
      return false;
    }
  });
  
  console.log('좌석 선택 결과:', isWaitingReservation ? '대기예약' : '일반예약');
  
  // 대기예약인 경우
  if (isWaitingReservation) {
    console.log('모든 좌석이 예약되어 있습니다. 대기예약을 진행합니다.');
    
    // 대기예약 상태 설정
    await page.evaluate(() => {
      if (typeof busAppForm !== 'undefined') {
        // Angular 모델에서 좌석 번호 제거하고 대기예약 설정
        busAppForm.seatNo = null;
        busAppForm.wait = true;
        
        // 예약 버튼 텍스트 변경
        const reserveButton = document.querySelector('button.btn.btn-primary.btn-lg.btn-block');
        if (reserveButton && !reserveButton.textContent.includes('대기')) {
          reserveButton.textContent = ' 대기 예약 하기 ';
          console.log('대기예약 버튼 텍스트 변경됨');
        }
      }
    });
    
    return true;
  }
  
  // 일반 예약인 경우 좌석 선택 시도
  // 좌석 버튼을 직접 찾아서 클릭
  const seatSelected = await page.evaluate((seatNumber) => {
    // HTML의 실제 좌석 버튼 구조 분석
    const seatButtons = Array.from(document.querySelectorAll('.seatBtn'))
      .filter(btn => !btn.disabled && !btn.classList.contains('disableSeatBtn'));
    
    console.log(`사용 가능한 좌석 수: ${seatButtons.length}`);
    
    // 선호 좌석 찾기 (정확한 번호 매칭)
    let targetSeat = seatButtons.find(btn => 
      btn.textContent.trim().includes(`${seatNumber}번`));
    
    // 선호 좌석이 없으면 첫 번째 사용 가능한 좌석 선택
    if (!targetSeat && seatButtons.length > 0) {
      console.log(`${seatNumber}번 좌석을 찾을 수 없어 첫 번째 사용 가능한 좌석 선택`);
      targetSeat = seatButtons[0];
    }
    
    if (targetSeat) {
      // Angular의 ng-click 이벤트 처리 방식을 활용
      // 1. 직접 DOM 클릭 이벤트 발생
      targetSeat.click();
      
      // 2. HTML에서 확인된 Angular 모델 직접 설정
      try {
        // 좌석 번호 추출 (텍스트에서 숫자만 추출)
        const seatNum = parseInt(targetSeat.textContent.trim().replace(/[^0-9]/g, ''));
        
        if (typeof busAppForm !== 'undefined') {
          // Angular 모델 직접 업데이트
          busAppForm.seatNo = seatNum;
          busAppForm.wait = false;
          
          // Angular 스코프 갱신 시도
          if (typeof angular !== 'undefined') {
            try {
              // 현재 컨트롤러의 스코프 찾기
              const controller = angular.element(document.querySelector('[ng-controller]'));
              if (controller.scope && typeof controller.scope === 'function') {
                const scope = controller.scope();
                scope.$apply();
              } else {
                // 전역 스코프로 시도
                angular.element(document.body).injector().get('$rootScope').$apply();
              }
            } catch (e) {
              console.log('Angular 스코프 갱신 실패, 무시하고 계속 진행');
            }
          }
        }
        
        return `좌석 ${seatNum}번 선택됨`;
      } catch (e) {
        return `좌석 선택됨, 번호 추출 실패: ${e.message}`;
      }
    }
    
    return false;
  }, seatNumber);
  
  console.log('좌석 선택 결과:', seatSelected || '선택 실패');
  
  // 좌석 선택 실패 시 다른 접근 방식 시도
  if (!seatSelected) {
    console.warn(`좌석 선택에 실패했습니다. 자동 좌석 선택을 시도합니다.`);
    
    // 좌석 선택에 실패한 경우, 사용 가능한 첫 번째 좌석 직접 선택
    const anySeatSelected = await page.evaluate(() => {
      // 사용 가능한 모든 좌석 찾기
      const availableSeats = Array.from(document.querySelectorAll('.seatBtn'))
        .filter(btn => !btn.disabled && !btn.classList.contains('disableSeatBtn'));
      
      if (availableSeats.length > 0) {
        // 첫 번째 사용 가능한 좌석 클릭
        availableSeats[0].click();
        
        // Angular 모델 업데이트
        if (typeof busAppForm !== 'undefined') {
          // 좌석 번호 추출
          const seatNum = parseInt(availableSeats[0].textContent.trim().replace(/[^0-9]/g, ''));
          busAppForm.seatNo = seatNum;
          busAppForm.wait = false;
        }
        
        return availableSeats[0].textContent.trim();
      }
      
      // 마지막 수단: 모든 좌석이 선택 불가능하면 대기예약으로 전환
      if (typeof busAppForm !== 'undefined') {
        busAppForm.seatNo = null;
        busAppForm.wait = true;
        
        // 버튼 텍스트 변경
        const reserveButton = document.querySelector('button.btn.btn-primary.btn-lg.btn-block');
        if (reserveButton) {
          reserveButton.textContent = ' 대기 예약 하기 ';
          return '대기예약으로 전환';
        }
      }
      
      return false;
    });
    
    if (!anySeatSelected) {
      console.log('사용 가능한 좌석이 없습니다. 대기예약으로 전환합니다.');
      
      // 명시적으로 대기예약으로 전환
      const waitResult = await page.evaluate(() => {
        // 1. 체크박스 방식으로 시도
        const waitingCheckbox = document.querySelector('input[type="checkbox"][ng-model="busAppForm.wait"]') || 
                              document.querySelector('input[ng-model="busAppForm.wait"]');
        
        if (waitingCheckbox) {
          waitingCheckbox.checked = true;
          const event = new Event('change', { bubbles: true });
          waitingCheckbox.dispatchEvent(event);
        }
        
        // 2. 직접 busAppForm 객체 값 설정
        if (typeof busAppForm !== 'undefined') {
          busAppForm.seatNo = null;
          busAppForm.wait = true;
          
          // Angular 스코프 업데이트
          if (typeof angular !== 'undefined') {
            try {
              const scope = angular.element(document.querySelector('[ng-controller]')).scope();
              if (scope) {
                scope.$apply();
              }
            } catch (e) {
              console.error('Angular 스코프 업데이트 실패:', e);
            }
          }
        }
        
        // 3. 버튼 텍스트 변경
        const reserveButton = document.querySelector('button.btn.btn-primary.btn-lg.btn-block');
        if (reserveButton) {
          if (!reserveButton.textContent.includes('대기')) {
            reserveButton.textContent = ' 대기 예약 하기 ';
          }
        }
        
        return '대기예약으로 전환 완료';
      });
      
      console.log(waitResult);
      await page.waitForTimeout(500); // 약간의 시간 지연
      return true; // 대기예약 설정 완료
    } else {
      console.log(`대체 좌석 선택됨: ${anySeatSelected}`);
      return true; // 좌석 선택 완료
    }
  }
  
  // 좌석 선택 후 Angular가 업데이트할 시간을 주기
  if (seatSelected || anySeatSelected) {
    // timeout 대신 DOM 요소 변화 감지
    try {
      // seatActiveBtn 클래스가 있거나 대기예약 상태가 될 때까지 기다림
      await page.waitForFunction(() => {
        // 활성화된 좌석 확인
        const activeSeats = document.querySelectorAll('.seatActiveBtn');
        if (activeSeats.length > 0) return true;
        
        // 대기예약 메시지 확인
        const waitingMsg = document.querySelector('div[ng-if="isReadyApp==\'YES\'"]');
        if (waitingMsg && waitingMsg.textContent.includes('모든 좌석이 예약되어')) return true;
        
        // Angular 모델이 업데이트됐는지 확인
        if (typeof busAppForm !== 'undefined' && busAppForm.seatNo) return true;
        
        return false;
      }, { timeout: 3000 }); // 최대 3초 기다림
    } catch (e) {
      console.log('좌석 선택 상태 감지 실패, 계속 진행합니다:', e.message);
    }
    
    // 선택된 좌석을 시각적으로 확인
    const visualCheck = await page.evaluate(() => {
      try {
        // Angular 스코프 확인
        const angularScope = angular.element(document.querySelector('[ng-controller="busReserveCtrl"]')).scope();
        
        // 활성화된 좌석 찾기 (seatActiveBtn 클래스 확인)
        const activeSeats = document.querySelectorAll('.seatActiveBtn');
        if (activeSeats.length > 0) {
          return {
            success: true,
            selectedSeat: activeSeats[0].textContent.trim(),
            angularState: angularScope && angularScope.busAppForm ? angularScope.busAppForm.seatNo : null,
            hasAngularScope: !!angularScope
          };
        }
        
        // Angular 스코프를 통해 busAppForm 확인
        if (angularScope && angularScope.busAppForm && angularScope.busAppForm.seatNo) {
          return {
            success: true,
            selectedSeat: "Angular 모델만 업데이트됨",
            angularState: angularScope.busAppForm.seatNo,
            hasAngularScope: true
          };
        }
        
        // 전역 busAppForm 확인 (가능성 낮음)
        if (typeof window.busAppForm !== 'undefined' && window.busAppForm.seatNo) {
          return {
            success: true,
            selectedSeat: "전역 객체에서 발견",
            angularState: window.busAppForm.seatNo,
            hasGlobalBusAppForm: true
          };
        }
        
        return {
          success: false,
          message: "좌석 선택 실패",
          hasAngularScope: !!angularScope
        };
      } catch (e) {
        return {
          success: false,
          error: e.message,
          stack: e.stack
        };
      }
    });
    
    console.log("좌석 선택 상태 확인:", visualCheck);
    
    if (!visualCheck.success) {
      console.log("좌석 선택이 시각적으로 확인되지 않음. 한 번 더 시도합니다.");
      
      // 한 번 더 단순한 방식으로 시도
      await page.evaluate((seatNumber) => {
        // 클릭 이벤트를 다시 한 번 발생시킴
        const buttons = document.querySelectorAll('.seatBtn');
        for (const btn of buttons) {
          if (btn.textContent.includes(`${seatNumber}번`) && !btn.disabled) {
            btn.click();
            break;
          }
        }
        
        // Angular에게 명시적으로 이벤트 전달
        const event = document.createEvent('HTMLEvents');
        event.initEvent('change', true, false);
        document.dispatchEvent(event);
        
        if (typeof angular !== 'undefined') {
          try {
            angular.element(document.body).injector().get('$rootScope').$apply();
          } catch (e) {
            console.log('Angular 이벤트 전달 실패');
          }
        }
      }, seatNumber);
      
      // DOM 업데이트 대기
      try {
        await page.waitForFunction(() => {
          return document.querySelectorAll('.seatActiveBtn').length > 0 || 
                 (document.querySelector('div[ng-if="isReadyApp==\'YES\'"]') && 
                  document.querySelector('div[ng-if="isReadyApp==\'YES\'"]').textContent.includes('모든 좌석이 예약되어'));
        }, { timeout: 2000 });
      } catch (e) {
        console.log('두 번째 시도 후 좌석 선택 상태 감지 실패:', e.message);
      }
    }
  }
  
  return true; // 좌석 선택 완료
}

/**
 * 하교 버스 예약
 */
async function reserveFromSchool(reservationData) {
  const processName = "하교 예약";
  startTimer(processName);
  
  try {
    const { page } = await initBrowser();
    const { fromSchool } = reservationData;
    
    // 하교 탭으로 명시적 이동 (이미 있어도 문제 없음)
    console.log('하교 탭으로 이동');
    // 하교 탭 선택 버튼 클릭
    const tabButtons = await page.$$('.btn-group button');
    if (tabButtons.length >= 2) {
      await tabButtons[1].click(); // 두 번째 버튼이 하교 탭
      console.log('하교 탭 클릭 완료');
    }
    
    // 잠시 대기하여 탭 전환 완료 확인
    await page.waitForFunction(
      () => {
        const buttons = Array.from(document.querySelectorAll('.btn-group button'));
        return buttons.length >= 2 && buttons[1].classList.contains('btn-primary');
      },
      { timeout: 5000 }
    );
    
    await takeScreenshot('fromSchool-tab');
    console.log('하교 예약 시작');
    
    // 노선 선택 (셀렉트 박스로 구현됨)
    console.log(`노선 선택: ${fromSchool.route}`);
    
    // 셀렉트 박스가 있는지 확인
    await page.waitForSelector('select.form-control', { visible: true });
    
    // 노선 이름이 포함된 옵션 선택
    await page.evaluate((routeName) => {
      const selectElement = document.querySelector('select.form-control');
      const options = Array.from(selectElement.options);
      const targetOption = options.find(option => option.textContent.includes(routeName));
      
      if (targetOption) {
        selectElement.value = targetOption.value;
        
        // Angular에게 변경 이벤트 알림
        const event = new Event('change', { bubbles: true });
        selectElement.dispatchEvent(event);
      }
    }, fromSchool.route);
    
    // 단순 시간 지연 대신 시간 목록이 로드될 때까지 명시적으로 대기
    console.log('시간 목록 로드 대기');
    await page.waitForFunction(
      () => {
        const timeItems = document.querySelectorAll('ul.list-group li');
        return timeItems.length > 0;
      },
      { timeout: 5000 }
    );
    
    // 시간 목록이 로드되었는지 확인
    console.log(`출발시간 선택: ${fromSchool.time}`);
    
    // 출발 시간 선택
    const timeFound = await page.evaluate((targetTime) => {
      const timeItems = Array.from(document.querySelectorAll('ul.list-group li'));
      
      for (const item of timeItems) {
        if (item.textContent.includes(targetTime)) {
          item.click();
          return true;
        }
      }
      return false;
    }, fromSchool.time);
    
    if (!timeFound) {
      throw new Error(`출발 시간을 찾을 수 없음: ${fromSchool.time}`);
    }
    
    // 정류장 목록이 로드될 때까지 대기
    console.log('정류장 목록 로드 대기');
    await page.waitForFunction(
      () => {
        // ng-if="busAppForm.selectBus!=null" 속성을 가진 div가 있는지 확인
        const stopListContainer = document.querySelector('div[ng-if="busAppForm.selectBus!=null"]');
        if (!stopListContainer) return false;
        
        const stopItems = stopListContainer.querySelectorAll('li');
        return stopItems.length > 0;
      },
      { timeout: 5000 }
    );
    
    // 정류장 목록이 로드되었음
    console.log(`정류장 선택: ${fromSchool.station}`);
    
    // 정류장 선택
    const stationFound = await page.evaluate((stationName) => {
      const stationItems = Array.from(document.querySelectorAll('ul.list-group li'));
      
      for (const item of stationItems) {
        if (item.textContent.includes(stationName)) {
          item.click();
          return true;
        }
      }
      return false;
    }, fromSchool.station);
    
    if (!stationFound) {
      throw new Error(`정류장을 찾을 수 없음: ${fromSchool.station}`);
    }
    
    // 좌석 목록이 로드될 때까지 대기
    console.log('좌석 목록 로드 대기');
    await page.waitForFunction(
      () => {
        // ng-if="busAppForm.selectBus!=null && busAppForm.selectStop!=null" 속성을 가진 div가 있는지 확인
        const seatContainer = document.querySelector('div[ng-if="busAppForm.selectBus!=null && busAppForm.selectStop!=null"]');
        return seatContainer !== null;
      },
      { timeout: 5000 }
    );
    
    // 좌석 선택 또는 대기예약 설정
    const seatResult = await selectSeatOrWaiting(page, fromSchool.seatNumber, 'fromSchool');

    // 예약하기 버튼 클릭
    console.log('예약하기 버튼 클릭');
    await page.waitForSelector('button.btn.btn-primary.btn-lg.btn-block', { visible: true });

    // 최종적으로 Angular 모델 확인 및 버튼 클릭
    try {
      const reserveResult = await page.evaluate(() => {
        try {
          // 예약 버튼 찾기
          const reserveButton = document.querySelector('button.btn.btn-primary.btn-lg.btn-block');
          if (!reserveButton) {
            return { success: false, error: "예약 버튼을 찾을 수 없습니다" };
          }
          
          // Angular 스코프 접근
          const angularScope = angular.element(document.querySelector('[ng-controller="busReserveCtrl"]')).scope();
          
          // 버튼 텍스트와 상태 확인
          const buttonText = reserveButton.textContent.trim();
          const isWaitingReservation = buttonText.includes('대기');
          const formState = angularScope && angularScope.busAppForm 
            ? { 
                seatNo: angularScope.busAppForm.seatNo, 
                wait: angularScope.busAppForm.wait,
                dir: angularScope.busAppForm.dir, 
                hasSelectedBus: !!angularScope.busAppForm.selectBus,
                hasSelectedStop: !!angularScope.busAppForm.selectStop
              } 
            : null;
          
          // 대기예약인 경우 강제로 wait 설정
          if (isWaitingReservation && angularScope && angularScope.busAppForm) {
            angularScope.busAppForm.wait = true;
            angularScope.busAppForm.seatNo = null;
            
            // Angular 스코프 적용
            if (typeof angularScope.$apply === 'function') {
              angularScope.$apply();
            }
          }
          
          // 직접 DOM 이벤트 방식으로 클릭
          reserveButton.click();
          
          return { 
            success: true, 
            buttonText,
            isWaitingReservation,
            formState,
            hasAngularScope: !!angularScope
          };
        } catch (e) {
          return { 
            success: false, 
            error: e.message,
            stack: e.stack
          };
        }
      });
      
      console.log('예약 버튼 클릭 결과:', reserveResult);
      
      // 버튼이 클릭되었지만 경고창이 뜨는 경우를 대비
      try {
        await page.waitForFunction(() => {
          // 알림창이 표시되는지 확인
          return window.swal2Shown === true || 
                 document.querySelector('.swal2-shown') !== null ||
                 document.querySelector('.swal2-container') !== null;
        }, { timeout: 1000 });
        
        console.log('경고창 감지됨, 처리 시도');
        await handleConfirmDialogs('reservation-alert');
      } catch (e) {
        // 경고창이 없으면 무시하고 계속 진행
      }
      
    } catch (error) {
      console.error('예약 버튼 클릭 중 오류:', error.message);
      await takeScreenshot('fromSchool-button-error');
    }

    // 확인 다이얼로그 처리 (선택하신 정보로 예약을 하시겠습니까? + 예약 완료)
    console.log('확인 다이얼로그 처리 시작');
    await handleConfirmDialogs('fromSchool-dialog');
    
    console.log('하교 버스 예약 완료');
    endTimer(processName);
    return { status: 'success', message: '하교 예약 완료', details: fromSchool };
  } catch (error) {
    console.error('하교 예약 오류:', error);
    await takeScreenshot('fromSchool-error');
    endTimer(processName);
    throw new Error(`하교 예약 실패: ${error.message}`);
  }
}

/**
 * 등교 버스 예약
 */
async function reserveToSchool(reservationData) {
  const processName = "등교 예약";
  startTimer(processName);
  
  try {
    const { page } = await initBrowser();
    const { toSchool } = reservationData;
    
    // 등교 탭으로 명시적 이동
    console.log('등교 탭으로 이동');
    // 등교 탭 선택 버튼 클릭
    const tabButtons = await page.$$('.btn-group button');
    if (tabButtons.length >= 1) {
      await tabButtons[0].click(); // 첫 번째 버튼이 등교 탭
      console.log('등교 탭 클릭 완료');
    }
    
    // 잠시 대기하여 탭 전환 완료 확인
    await page.waitForFunction(
      () => {
        const buttons = Array.from(document.querySelectorAll('.btn-group button'));
        return buttons.length >= 1 && buttons[0].classList.contains('btn-primary');
      },
      { timeout: 5000 }
    );
    
    await takeScreenshot('toSchool-tab');
    console.log('등교 예약 시작');
    
    // 노선 선택 (셀렉트 박스로 구현됨)
    console.log(`노선 선택: ${toSchool.route}`);
    
    // 셀렉트 박스가 있는지 확인
    await page.waitForSelector('select.form-control', { visible: true });
    
    // 노선 이름이 포함된 옵션 선택
    await page.evaluate((routeName) => {
      const selectElement = document.querySelector('select.form-control');
      const options = Array.from(selectElement.options);
      const targetOption = options.find(option => option.textContent.includes(routeName));
      
      if (targetOption) {
        selectElement.value = targetOption.value;
        
        // Angular에게 변경 이벤트 알림
        const event = new Event('change', { bubbles: true });
        selectElement.dispatchEvent(event);
      }
    }, toSchool.route);
    
    // 단순 시간 지연 대신 시간 목록이 로드될 때까지 명시적으로 대기
    console.log('시간 목록 로드 대기');
    await page.waitForFunction(
      () => {
        const timeItems = document.querySelectorAll('ul.list-group li');
        return timeItems.length > 0;
      },
      { timeout: 5000 }
    );
    
    // 시간 목록이 로드되었는지 확인
    console.log(`출발시간 선택: ${toSchool.time}`);
    
    // 출발 시간 선택
    const timeFound = await page.evaluate((targetTime) => {
      const timeItems = Array.from(document.querySelectorAll('ul.list-group li'));
      
      for (const item of timeItems) {
        if (item.textContent.includes(targetTime)) {
          item.click();
          return true;
        }
      }
      return false;
    }, toSchool.time);
    
    if (!timeFound) {
      throw new Error(`출발 시간을 찾을 수 없음: ${toSchool.time}`);
    }
    
    // 정류장 목록이 로드될 때까지 대기
    console.log('정류장 목록 로드 대기');
    await page.waitForFunction(
      () => {
        // ng-if="busAppForm.selectBus!=null" 속성을 가진 div가 있는지 확인
        const stopListContainer = document.querySelector('div[ng-if="busAppForm.selectBus!=null"]');
        if (!stopListContainer) return false;
        
        const stopItems = stopListContainer.querySelectorAll('li');
        return stopItems.length > 0;
      },
      { timeout: 5000 }
    );
    
    // 정류장 목록이 로드되었음
    console.log(`정류장 선택: ${toSchool.station}`);
    
    // 정류장 선택
    const stationFound = await page.evaluate((stationName) => {
      const stationItems = Array.from(document.querySelectorAll('ul.list-group li'));
      
      for (const item of stationItems) {
        if (item.textContent.includes(stationName)) {
          item.click();
          return true;
        }
      }
      return false;
    }, toSchool.station);
    
    if (!stationFound) {
      throw new Error(`정류장을 찾을 수 없음: ${toSchool.station}`);
    }
    
    // 좌석 목록이 로드될 때까지 대기
    console.log('좌석 목록 로드 대기');
    await page.waitForFunction(
      () => {
        // ng-if="busAppForm.selectBus!=null && busAppForm.selectStop!=null" 속성을 가진 div가 있는지 확인
        const seatContainer = document.querySelector('div[ng-if="busAppForm.selectBus!=null && busAppForm.selectStop!=null"]');
        return seatContainer !== null;
      },
      { timeout: 5000 }
    );
    
    // 좌석 선택 또는 대기예약 설정
    const seatResult = await selectSeatOrWaiting(page, toSchool.seatNumber, 'toSchool');

    // 예약하기 버튼 클릭
    console.log('예약하기 버튼 클릭');
    await page.waitForSelector('button.btn.btn-primary.btn-lg.btn-block', { visible: true });

    // 최종적으로 Angular 모델 확인 및 버튼 클릭
    try {
      const reserveResult = await page.evaluate(() => {
        try {
          // 예약 버튼 찾기
          const reserveButton = document.querySelector('button.btn.btn-primary.btn-lg.btn-block');
          if (!reserveButton) {
            return { success: false, error: "예약 버튼을 찾을 수 없습니다" };
          }
          
          // Angular 스코프 접근
          const angularScope = angular.element(document.querySelector('[ng-controller="busReserveCtrl"]')).scope();
          
          // 버튼 텍스트와 상태 확인
          const buttonText = reserveButton.textContent.trim();
          const isWaitingReservation = buttonText.includes('대기');
          const formState = angularScope && angularScope.busAppForm 
            ? { 
                seatNo: angularScope.busAppForm.seatNo, 
                wait: angularScope.busAppForm.wait,
                dir: angularScope.busAppForm.dir, 
                hasSelectedBus: !!angularScope.busAppForm.selectBus,
                hasSelectedStop: !!angularScope.busAppForm.selectStop
              } 
            : null;
          
          // 대기예약인 경우 강제로 wait 설정
          if (isWaitingReservation && angularScope && angularScope.busAppForm) {
            angularScope.busAppForm.wait = true;
            angularScope.busAppForm.seatNo = null;
            
            // Angular 스코프 적용
            if (typeof angularScope.$apply === 'function') {
              angularScope.$apply();
            }
          }
          
          // 직접 DOM 이벤트 방식으로 클릭
          reserveButton.click();
          
          return { 
            success: true, 
            buttonText,
            isWaitingReservation,
            formState,
            hasAngularScope: !!angularScope
          };
        } catch (e) {
          return { 
            success: false, 
            error: e.message,
            stack: e.stack
          };
        }
      });
      
      console.log('예약 버튼 클릭 결과:', reserveResult);
      
      // 버튼이 클릭되었지만 경고창이 뜨는 경우를 대비
      try {
        await page.waitForFunction(() => {
          // 알림창이 표시되는지 확인
          return window.swal2Shown === true || 
                 document.querySelector('.swal2-shown') !== null ||
                 document.querySelector('.swal2-container') !== null;
        }, { timeout: 1000 });
        
        console.log('경고창 감지됨, 처리 시도');
        await handleConfirmDialogs('reservation-alert');
      } catch (e) {
        // 경고창이 없으면 무시하고 계속 진행
      }
      
    } catch (error) {
      console.error('예약 버튼 클릭 중 오류:', error.message);
      await takeScreenshot('toSchool-button-error');
    }

    // 확인 다이얼로그 처리 (선택하신 정보로 예약을 하시겠습니까? + 예약 완료)
    console.log('확인 다이얼로그 처리 시작');
    await handleConfirmDialogs('toSchool-dialog');
    
    console.log('등교 버스 예약 완료');
    endTimer(processName);
    return { status: 'success', message: '등교 예약 완료', details: toSchool };
  } catch (error) {
    console.error('등교 예약 오류:', error);
    await takeScreenshot('toSchool-error');
    endTimer(processName);
    throw new Error(`등교 예약 실패: ${error.message}`);
  }
}

/**
 * 로그 저장
 */
async function saveReservationLog(dayOfWeek, type, result) {
  try {
    const today = new Date();
    const dateString = today.getFullYear() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');
    
    // Firestore에 로그 저장
    await db.collection('logs').doc(dateString).set({
      [dayOfWeek]: {
        [type]: {
          timestamp: new Date().toISOString(),
          status: result.status || 'error',
          message: result.message || 'Unknown error',
          details: result.details || {}
        }
      }
    }, { merge: true });
    
    // 통합 로깅 시스템을 통해 로그 저장
    logger.logReservationResult(dayOfWeek, type, result);
    
    console.log(`로그 저장 완료: ${dateString} - ${dayOfWeek} - ${type}`);
  } catch (error) {
    console.error('로그 저장 오류:', error);
  }
}

/**
 * 전체 예약 프로세스 실행
 * @param {boolean} testMode - 테스트 모드 여부 (요일 제한 무시)
 */
async function startReservation(testMode = false) {
  const processName = "전체 예약 프로세스";
  startTimer(processName);
  
  try {
    // 브라우저 초기화 및 로그인 상태 확인
    await initBrowser();
    await takeScreenshot('start-reservation');
    
    // 예약 정보 로드
    startTimer("예약 정보 로드");
    const reservationData = await getReservationData(testMode);
    endTimer("예약 정보 로드");
    
    // 버스 예약 페이지로 이동
    startTimer("예약 페이지 이동");
    await navigateToBusReservePage();
    await takeScreenshot('bus-reserve-page');
    endTimer("예약 페이지 이동");
    
    // 하교 예약 실행
    const fromSchoolResult = await reserveFromSchool(reservationData);
    await saveReservationLog(reservationData.dayOfWeek, 'fromSchool', fromSchoolResult);
    
    // 하교 예약 완료 후 남은 다이얼로그 확인 및 처리
    console.log('하교-등교 전환 전 추가 다이얼로그 확인');
    await handleConfirmDialogs('transition-dialogs');
    
    // 등교 예약 실행
    const toSchoolResult = await reserveToSchool(reservationData);
    await saveReservationLog(reservationData.dayOfWeek, 'toSchool', toSchoolResult);
    
    // 최종 확인: 남은 다이얼로그 있는지 확인
    await handleConfirmDialogs('final-dialogs');
    
    // 완료 스크린샷
    await takeScreenshot('reservation-complete');
    
    endTimer(processName);
    reportTimers(); // 모든 타이머 보고
    
    return {
      status: 'success',
      message: '모든 예약이 완료되었습니다',
      fromSchool: fromSchoolResult,
      toSchool: toSchoolResult,
      dayOfWeek: reservationData.dayOfWeek,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('예약 프로세스 오류:', error);
    await takeScreenshot('reservation-error');
    
    // 오류 로그 저장 시도
    try {
      const dayOfWeek = getDayOfWeek();
      await saveReservationLog(dayOfWeek, 'error', {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } catch (logError) {
      console.error('오류 로그 저장 실패:', logError);
    }
    
    endTimer(processName);
    reportTimers(); // 오류 발생해도 타이머 보고
    
    throw new Error(`예약 실패: ${error.message}`);
  }
}

/**
 * 다음 예약 일정 계산
 */
function getNextSchedule() {
  if (nextSchedule) return nextSchedule;
  
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0(일) ~ 6(토)
  
  // 다음 예약 요일 계산 (0:일, 1:월, 2:화)
  let nextDay;
  if (dayOfWeek <= 2) {
    // 오늘이 일, 월, 화 중 하나면
    if (now.getHours() < 21 || (now.getHours() === 21 && now.getMinutes() === 0)) {
      // 21시 이전이면 오늘
      nextDay = dayOfWeek;
    } else {
      // 21시 이후면 다음 예약일
      nextDay = (dayOfWeek + 1) % 7;
      if (nextDay > 2) nextDay = 0; // 화요일 이후면 다시 일요일로
    }
  } else {
    // 오늘이 수, 목, 금, 토면 다음 일요일
    nextDay = 0;
  }
  
  // 다음 예약 날짜 계산
  const daysToAdd = (nextDay - dayOfWeek + 7) % 7;
  const nextDate = new Date(now);
  nextDate.setDate(now.getDate() + daysToAdd);
  nextDate.setHours(21, 0, 0, 0);
  
  nextSchedule = {
    day: ['일', '월', '화'][nextDay],
    date: nextDate.toISOString(),
    timestamp: nextDate.getTime()
  };
  
  return nextSchedule;
}

// 일정 시간마다 다음 예약 일정 리셋 (매일 자정)
setInterval(() => {
  nextSchedule = null;
}, 24 * 60 * 60 * 1000);

/**
 * 대기예약 상태를 강제로 설정하는 함수
 * 좌석 선택이 잘 작동하지 않을 때 최후의 수단으로 사용
 */
async function forceWaitingReservation(page) {
  console.log('대기예약 상태를 강제로 설정합니다.');
  
  const result = await page.evaluate(() => {
    try {
      // 1. busAppForm 객체 직접 조작
      if (typeof busAppForm !== 'undefined') {
        busAppForm.seatNo = null; // 좌석 선택 취소
        busAppForm.wait = true; // 대기예약 활성화
        
        // 원래 코드에 있는 reserveProc 함수를 직접 수정
        if (typeof window.reserveProc === 'function') {
          // 원래 함수 백업
          const originalReserveProc = window.reserveProc;
          
          // reserveProc 재정의 - 대기예약 모드로 강제 설정
          window.reserveProc = function() {
            busAppForm.wait = true;
            return originalReserveProc.apply(this, arguments);
          };
        }
        
        // Angular 스코프 업데이트
        if (typeof angular !== 'undefined') {
          const scope = angular.element(document.querySelector('[ng-controller]')).scope();
          if (scope) {
            // reserveProc 함수를 래핑하여 강제로 대기예약 설정
            if (typeof scope.reserveProc === 'function') {
              const originalReserveProc = scope.reserveProc;
              scope.reserveProc = function() {
                busAppForm.wait = true;
                return originalReserveProc.apply(this, arguments);
              };
            }
            
            scope.$apply();
          }
        }
      }
      
      // 2. 버튼 텍스트 변경 (시각적 피드백)
      const reserveButton = document.querySelector('button.btn.btn-primary.btn-lg.btn-block');
      if (reserveButton) {
        reserveButton.textContent = ' 대기 예약 하기 ';
      }
      
      // 3. 체크박스가 있다면 체크
      const waitingCheckbox = document.querySelector('input[type="checkbox"][ng-model="busAppForm.wait"]') || 
                            document.querySelector('input[ng-model="busAppForm.wait"]');
      if (waitingCheckbox) {
        waitingCheckbox.checked = true;
        const event = new Event('change', { bubbles: true });
        waitingCheckbox.dispatchEvent(event);
      }
      
      return '대기예약 상태 강제 설정 완료';
    } catch (error) {
      return `대기예약 상태 설정 실패: ${error.message}`;
    }
  });
  
  console.log(result);
  await page.waitForTimeout(500); // 변경사항 적용을 위한 대기
  return result;
}

module.exports = {
  login,
  startReservation,
  getNextSchedule,
  getReservationData,
  navigateToBusReservePage,
  reserveFromSchool,
  reserveToSchool,
  takeScreenshot,
  startTimer,
  endTimer,
  reportTimers,
  forceWaitingReservation
}; 