/**
 * 환경 설정 관리 파일
 * 로컬 개발 환경과 Cloud Run 환경 간의 설정 차이를 관리합니다.
 */
require('dotenv').config();
const path = require('path');

// 환경 타입 확인
const isProduction = process.env.NODE_ENV === 'production';
const isCloudRun = process.env.K_SERVICE !== undefined; // Cloud Run 환경인지 확인

/**
 * Puppeteer 브라우저 설정
 */
const browserConfig = {
  // 개발 환경에서는 브라우저를 표시, 프로덕션/Cloud Run 환경에서는 헤드리스 모드
  headless: isProduction ? 'new' : false,
  // Cloud Run 환경에서는 지정된 Chrome 경로 사용
  executablePath: isCloudRun ? process.env.PUPPETEER_EXECUTABLE_PATH : undefined,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=1366,768'
  ],
  defaultViewport: { width: 1366, height: 768 }
};

/**
 * 스크린샷 저장 설정
 */
const screenshotConfig = {
  // 로컬 개발 환경에서는 프로젝트 내 저장, Cloud Run에서는 /tmp 디렉토리에 저장
  dir: isCloudRun ? '/tmp/screenshots' : path.join(__dirname, '../../screenshots'),
  // 스크린샷 저장 여부 (프로덕션 환경에서도 문제 분석을 위해 저장)
  enabled: true
};

/**
 * 서버 설정
 */
const serverConfig = {
  port: process.env.PORT || 3000,
  // 로컬 개발 환경에서는 모든 요청 처리, Cloud Run에서는 인증된 요청만 처리
  requireAuth: isCloudRun
};

/**
 * 로깅 설정
 */
const loggingConfig = {
  // 로그 레벨 (개발 환경에서는 자세히, 프로덕션에서는 간소화)
  level: isProduction ? 'info' : 'debug',
  // 타이머 활성화 여부
  enableTimers: true
};

module.exports = {
  isProduction,
  isCloudRun,
  browserConfig,
  screenshotConfig,
  serverConfig,
  loggingConfig
}; 