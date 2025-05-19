/**
 * 버스 예약 자동화 서비스
 */
const puppeteer = require('puppeteer');
const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore();

// 브라우저 인스턴스
let browser = null;
let page = null;

// 예약 일정 캐시
let nextSchedule = null;

/**
 * 지정된 시간(ms) 동안 대기하는 함수
 */
function delay(time) {
  return new Promise(function(resolve) { 
    setTimeout(resolve, time);
  });
}

/**
 * 브라우저 초기화
 */
async function initBrowser() {
  if (!browser) {
    console.log('브라우저 초기화');
    browser = await puppeteer.launch({
      headless: process.env.NODE_ENV === 'production',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1366, height: 768 }
    });
  }

  if (!page) {
    page = await browser.newPage();
    // 기본 타임아웃 설정
    page.setDefaultTimeout(30000);
    // 모바일 사이트로 인식되도록 설정
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1');
  }

  return { browser, page };
}

/**
 * 사이트 로그인
 */
async function login() {
  try {
    const { page } = await initBrowser();
    
    // 로그인 페이지 접속
    console.log('로그인 페이지 접속');
    await page.goto('https://daejin.unibus.kr/#/', { waitUntil: 'networkidle2' });
    
    // 로그인 정보 입력
    console.log('로그인 정보 입력');
    await page.type('#id', process.env.DJ_ID);
    await page.type('#pass', process.env.DJ_PASSWORD);
    
    // 로그인 버튼 클릭
    console.log('로그인 버튼 클릭');
    await page.click('button.btn.btn-primary.btn-block');
    
    // 로그인 성공 확인 (알림창 등)
    await page.waitForSelector('.swal2-confirm', { visible: true, timeout: 5000 });
    await page.click('.swal2-confirm');
    
    console.log('로그인 완료');
    
    // 메인 페이지가 로드될 때까지 대기
    await page.waitForSelector('a.list-group-item[href="#/busReserve"]', { visible: true });
    
    return true;
  } catch (error) {
    console.error('로그인 오류:', error);
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
 */
async function getReservationData() {
  try {
    const dayOfWeek = getDayOfWeek();
    console.log(`오늘 요일: ${dayOfWeek}`);
    
    // 지원하는 요일이 아니면 종료
    if (!['sunday', 'monday', 'tuesday'].includes(dayOfWeek)) {
      throw new Error('지원하지 않는 요일입니다 (일, 월, 화요일만 예약 가능)');
    }
    
    // Firestore에서 예약 정보 가져오기
    const schedulesDoc = await db.collection('schedules').doc(dayOfWeek).get();
    if (!schedulesDoc.exists) {
      throw new Error(`${dayOfWeek} 요일 예약 정보가 없습니다`);
    }
    
    const scheduleData = schedulesDoc.data();
    console.log('예약 정보 로드 완료:', scheduleData);
    
    return {
      dayOfWeek,
      toSchool: scheduleData.toSchool,
      fromSchool: scheduleData.fromSchool
    };
  } catch (error) {
    console.error('예약 정보 로드 오류:', error);
    throw new Error(`예약 정보 로드 실패: ${error.message}`);
  }
}

/**
 * 버스예약 페이지로 이동
 */
async function navigateToBusReservePage() {
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
    return true;
  } catch (error) {
    console.error('버스예약 페이지 이동 오류:', error);
    throw new Error(`버스예약 페이지 이동 실패: ${error.message}`);
  }
}

/**
 * 하교 버스 예약
 */
async function reserveFromSchool(reservationData) {
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
    
    // 좌석 선택 확인 (대기 예약인지 일반 예약인지 판단)
    const isWaitingReservation = await page.evaluate(() => {
      // 대기예약 메시지가 있는지 확인
      const waitingMsg = document.querySelector('.seatDiv');
      return waitingMsg && waitingMsg.textContent.includes('모든 좌석이 예약되어');
    });
    
    if (isWaitingReservation) {
      console.log('모든 좌석이 예약되어 있습니다. 대기예약을 진행합니다.');
      // 대기예약인 경우 바로 예약 버튼 클릭
    } else {
      // 일반 예약인 경우 좌석 선택 후 예약
      console.log(`좌석 선택: ${fromSchool.seatNumber}번`);
      
      // 좌석 버튼을 직접 찾아서 클릭
      const seatSelected = await page.evaluate((seatNumber) => {
        // 모든 좌석 버튼 중에서 해당 번호를 찾음
        const seatButtons = Array.from(document.querySelectorAll('.seatBtn'));
        const targetSeat = seatButtons.find(btn => btn.textContent.trim().includes(`${seatNumber}번`));
        
        if (targetSeat && !targetSeat.disabled) {
          targetSeat.click();
          return true;
        }
        return false;
      }, fromSchool.seatNumber);
      
      if (!seatSelected) {
        console.warn(`${fromSchool.seatNumber}번 좌석을 선택할 수 없습니다. 다른 좌석을 시도합니다.`);
        
        // 첫 번째 사용 가능한 좌석 선택
        const anySeatSelected = await page.evaluate(() => {
          const availableSeats = Array.from(document.querySelectorAll('.seatBtn')).filter(btn => !btn.disabled);
          if (availableSeats.length > 0) {
            availableSeats[0].click();
            return availableSeats[0].textContent.trim();
          }
          return false;
        });
        
        if (!anySeatSelected) {
          console.log('사용 가능한 좌석이 없습니다. 대기예약으로 전환합니다.');
          // 명시적으로 대기예약으로 전환
        } else {
          console.log(`대체 좌석 선택됨: ${anySeatSelected}`);
        }
      }
    }
    
    // 예약하기 버튼 클릭
    console.log('예약하기 버튼 클릭');
    await page.waitForSelector('button.btn.btn-primary.btn-lg.btn-block', { visible: true });
    await page.click('button.btn.btn-primary.btn-lg.btn-block');
    
    // 예약 확인 다이얼로그
    await page.waitForSelector('.swal2-confirm', { visible: true });
    const confirmMessage = await page.evaluate(() => {
      const element = document.querySelector('.swal2-html-container');
      return element ? element.textContent : '';
    });
    
    console.log(`확인 다이얼로그 메시지: ${confirmMessage}`);
    
    // 첫 번째 확인 버튼 클릭
    await page.click('.swal2-confirm');
    
    // 예약 결과 다이얼로그
    await page.waitForSelector('.swal2-confirm', { visible: true });
    const resultMessage = await page.evaluate(() => {
      const element = document.querySelector('.swal2-html-container');
      return element ? element.textContent : '';
    });
    
    console.log(`결과 다이얼로그 메시지: ${resultMessage}`);
    
    if (!resultMessage.includes('예약되었습니다') && !resultMessage.includes('예약 완료')) {
      throw new Error(`예약 실패: ${resultMessage}`);
    }
    
    // 확인 버튼 클릭
    await page.click('.swal2-confirm');
    
    console.log('하교 버스 예약 완료');
    return { status: 'success', message: '하교 예약 완료', details: fromSchool };
  } catch (error) {
    console.error('하교 예약 오류:', error);
    throw new Error(`하교 예약 실패: ${error.message}`);
  }
}

/**
 * 등교 버스 예약
 */
async function reserveToSchool(reservationData) {
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
    
    // 좌석 선택 확인 (대기 예약인지 일반 예약인지 판단)
    const isWaitingReservation = await page.evaluate(() => {
      // 대기예약 메시지가 있는지 확인
      const waitingMsg = document.querySelector('.seatDiv');
      return waitingMsg && waitingMsg.textContent.includes('모든 좌석이 예약되어');
    });
    
    if (isWaitingReservation) {
      console.log('모든 좌석이 예약되어 있습니다. 대기예약을 진행합니다.');
      // 대기예약인 경우 바로 예약 버튼 클릭
    } else {
      // 일반 예약인 경우 좌석 선택 후 예약
      console.log(`좌석 선택: ${toSchool.seatNumber}번`);
      
      // 좌석 버튼을 직접 찾아서 클릭
      const seatSelected = await page.evaluate((seatNumber) => {
        // 모든 좌석 버튼 중에서 해당 번호를 찾음
        const seatButtons = Array.from(document.querySelectorAll('.seatBtn'));
        const targetSeat = seatButtons.find(btn => btn.textContent.trim().includes(`${seatNumber}번`));
        
        if (targetSeat && !targetSeat.disabled) {
          targetSeat.click();
          return true;
        }
        return false;
      }, toSchool.seatNumber);
      
      if (!seatSelected) {
        console.warn(`${toSchool.seatNumber}번 좌석을 선택할 수 없습니다. 다른 좌석을 시도합니다.`);
        
        // 첫 번째 사용 가능한 좌석 선택
        const anySeatSelected = await page.evaluate(() => {
          const availableSeats = Array.from(document.querySelectorAll('.seatBtn')).filter(btn => !btn.disabled);
          if (availableSeats.length > 0) {
            availableSeats[0].click();
            return availableSeats[0].textContent.trim();
          }
          return false;
        });
        
        if (!anySeatSelected) {
          console.log('사용 가능한 좌석이 없습니다. 대기예약으로 전환합니다.');
          // 명시적으로 대기예약으로 전환
        } else {
          console.log(`대체 좌석 선택됨: ${anySeatSelected}`);
        }
      }
    }
    
    // 예약하기 버튼 클릭
    console.log('예약하기 버튼 클릭');
    await page.waitForSelector('button.btn.btn-primary.btn-lg.btn-block', { visible: true });
    await page.click('button.btn.btn-primary.btn-lg.btn-block');
    
    // 예약 확인 다이얼로그
    await page.waitForSelector('.swal2-confirm', { visible: true });
    const confirmMessage = await page.evaluate(() => {
      const element = document.querySelector('.swal2-html-container');
      return element ? element.textContent : '';
    });
    
    console.log(`확인 다이얼로그 메시지: ${confirmMessage}`);
    
    // 첫 번째 확인 버튼 클릭
    await page.click('.swal2-confirm');
    
    // 예약 결과 다이얼로그
    await page.waitForSelector('.swal2-confirm', { visible: true });
    const resultMessage = await page.evaluate(() => {
      const element = document.querySelector('.swal2-html-container');
      return element ? element.textContent : '';
    });
    
    console.log(`결과 다이얼로그 메시지: ${resultMessage}`);
    
    if (!resultMessage.includes('예약되었습니다') && !resultMessage.includes('예약 완료')) {
      throw new Error(`예약 실패: ${resultMessage}`);
    }
    
    // 확인 버튼 클릭
    await page.click('.swal2-confirm');
    
    console.log('등교 버스 예약 완료');
    return { status: 'success', message: '등교 예약 완료', details: toSchool };
  } catch (error) {
    console.error('등교 예약 오류:', error);
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
    
    // 로그 저장
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
    
    console.log(`로그 저장 완료: ${dateString} - ${dayOfWeek} - ${type}`);
  } catch (error) {
    console.error('로그 저장 오류:', error);
  }
}

/**
 * 전체 예약 프로세스 실행
 */
async function startReservation() {
  try {
    // 브라우저 초기화 및 로그인 상태 확인
    await initBrowser();
    
    // 예약 정보 로드
    const reservationData = await getReservationData();
    
    // 버스 예약 페이지로 이동
    await navigateToBusReservePage();
    
    // 하교 예약 실행
    const fromSchoolResult = await reserveFromSchool(reservationData);
    await saveReservationLog(reservationData.dayOfWeek, 'fromSchool', fromSchoolResult);
    
    // 등교 예약 실행
    const toSchoolResult = await reserveToSchool(reservationData);
    await saveReservationLog(reservationData.dayOfWeek, 'toSchool', toSchoolResult);
    
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

module.exports = {
  login,
  startReservation,
  getNextSchedule,
  getReservationData,
  navigateToBusReservePage,
  reserveFromSchool,
  reserveToSchool
}; 