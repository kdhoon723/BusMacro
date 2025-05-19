/**
 * 로그인 테스트 스크립트
 */
require('dotenv').config();
const puppeteer = require('puppeteer');

// 환경 변수에서 로그인 정보 가져오기
const DJ_ID = process.env.DJ_ID;
const DJ_PASSWORD = process.env.DJ_PASSWORD;

if (!DJ_ID || !DJ_PASSWORD) {
  console.error('로그인 정보가 없습니다. .env 파일을 확인해주세요.');
  process.exit(1);
}

/**
 * 로그인 테스트 함수
 */
async function testLogin() {
  console.log('브라우저 실행 중...');
  
  // 브라우저 시작
  const browser = await puppeteer.launch({
    headless: false, // 테스트를 위해 브라우저 UI 표시
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1366, height: 768 }
  });

  try {
    // 새 페이지 열기
    const page = await browser.newPage();
    
    // 기본 타임아웃 설정
    page.setDefaultTimeout(30000);
    
    // 모바일 사이트로 인식되도록 설정
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1');
    
    // 로그인 페이지 접속
    console.log('로그인 페이지 접속 중...');
    await page.goto('https://daejin.unibus.kr/#/', { waitUntil: 'networkidle2' });
    
    // 스크린샷 저장
    await page.screenshot({ path: 'login-page.png' });
    
    // 로그인 정보 입력
    console.log('로그인 정보 입력 중...');
    await page.type('#id', DJ_ID);
    await page.type('#pass', DJ_PASSWORD);
    
    // 로그인 버튼 클릭
    console.log('로그인 버튼 클릭...');
    await page.click('button.btn.btn-primary.btn-block');
    
    // 로그인 성공 확인 (알림창 등)
    await page.waitForSelector('.swal2-confirm', { visible: true, timeout: 5000 });
    
    // 스크린샷 저장
    await page.screenshot({ path: 'login-confirm.png' });
    
    // 확인 버튼 클릭
    await page.click('.swal2-confirm');
    
    // 메인 페이지가 로드될 때까지 대기
    await page.waitForSelector('a.list-group-item[href="#/busReserve"]', { visible: true });
    
    // 스크린샷 저장
    await page.screenshot({ path: 'main-page.png' });
    
    console.log('로그인 테스트 성공!');
    
    // 버스예약 페이지로 이동 테스트
    console.log('버스예약 페이지로 이동 중...');
    await page.click('a.list-group-item[href="#/busReserve"]');
    
    // 페이지 로드 대기
    await page.waitForSelector('.tab-pane.active', { visible: true });
    
    // 스크린샷 저장
    await page.screenshot({ path: 'bus-reserve-page.png' });
    
    console.log('버스예약 페이지 이동 테스트 성공!');
    
  } catch (error) {
    console.error('테스트 실패:', error);
  } finally {
    // 5초 대기 후 브라우저 종료
    await new Promise(resolve => setTimeout(resolve, 5000));
    await browser.close();
    console.log('브라우저 종료됨');
  }
}

// 테스트 실행
testLogin().catch(console.error); 