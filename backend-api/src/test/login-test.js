/**
 * 버스 예약 API - 로그인 테스트
 */
require('dotenv').config();
const AuthService = require('../services/auth');

/**
 * 로그인 테스트 실행
 */
async function testLogin() {
  console.log('로그인 테스트 시작...');
  
  // 환경변수에서 로그인 정보 가져오기
  const id = process.env.TEST_ID;
  const password = process.env.TEST_PASSWORD;
  
  if (!id || !password) {
    console.error('로그인 정보가 없습니다. .env 파일에 TEST_ID와 TEST_PASSWORD를 설정하세요.');
    return;
  }
  
  // 인증 서비스 생성
  const authService = new AuthService('login-test');
  
  try {
    // 로그인 시도
    console.log(`ID: ${id.substring(0, 3)}*****로 로그인 시도`);
    
    // 디버그 모드로 전환
    authService.apiClient.client.interceptors.request.use(request => {
      console.log('요청 URL:', request.url);
      console.log('요청 헤더:', JSON.stringify(request.headers, null, 2));
      console.log('요청 데이터:', request.data);
      return request;
    });
    
    authService.apiClient.client.interceptors.response.use(
      response => {
        console.log('응답 상태:', response.status);
        console.log('응답 헤더:', JSON.stringify(response.headers, null, 2));
        console.log('응답 데이터:', JSON.stringify(response.data, null, 2));
        return response;
      },
      error => {
        console.error('응답 오류:', error.message);
        if (error.response) {
          console.error('응답 상태:', error.response.status);
          console.error('응답 데이터:', error.response.data);
        }
        return Promise.reject(error);
      }
    );
    
    const loginResult = await authService.login(id, password);
    
    if (loginResult.success) {
      console.log('로그인 성공!');
      console.log('인증 정보:', {
        isLoggedIn: authService.isLoggedIn,
        hasAuthToken: !!authService.apiClient.authorization
      });
      
      // 로그인 상태 확인
      console.log('\n로그인 상태 확인 중...');
      const isLoggedIn = await authService.checkLoginStatus();
      console.log(`로그인 상태: ${isLoggedIn ? '로그인됨' : '로그인되지 않음'}`);
      
      // 로그아웃
      console.log('\n로그아웃 시도 중...');
      const logoutResult = await authService.logout();
      console.log(`로그아웃 결과: ${logoutResult.success ? '성공' : '실패'}`);
    } else {
      console.error('로그인 실패:', loginResult.message);
      console.error('응답 데이터:', loginResult.data);
    }
  } catch (error) {
    console.error('테스트 중 오류 발생:', error.message);
  }
}

// 테스트 실행
testLogin().catch(error => {
  console.error('테스트 실패:', error);
}); 