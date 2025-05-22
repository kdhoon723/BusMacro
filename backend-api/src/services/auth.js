/**
 * 인증 관련 서비스
 */
const { createUserClient } = require('../utils/request');

class AuthService {
  constructor(userId = 'default') {
    this.userId = userId;
    this.apiClient = createUserClient(userId);
    this.isLoggedIn = false;
  }

  /**
   * 로그인 요청
   * @param {string} id - 사용자 ID
   * @param {string} password - 비밀번호
   * @returns {Promise<Object>} 로그인 결과
   */
  async login(id, password) {
    try {
      console.log(`[${this.userId}] 로그인 시도...`);
      
      // 로그인 API 호출
      // JSON 데이터로 전송
      const response = await this.apiClient.client.post('index.php?ctrl=Main&action=loginProc', 
        {
          id,
          pass: password,
          autoLogin: ''
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      // 응답 확인
      if (response.data && response.data.result === 'OK') {
        this.isLoggedIn = true;
        
        // 응답 본문에서 인증 토큰 가져오기
        const authToken = response.data.data;
        if (authToken) {
          this.apiClient.setAuthorizationToken(authToken);
          console.log(`[${this.userId}] 로그인 성공 (토큰 확보)`);
        } else {
          console.log(`[${this.userId}] 로그인 성공 (토큰 없음)`);
        }
        
        return {
          success: true,
          message: '로그인 성공',
          data: response.data
        };
      } else {
        this.isLoggedIn = false;
        console.log(`[${this.userId}] 로그인 실패: ${response.data.resultMsg || '알 수 없는 오류'}`);
        
        return {
          success: false,
          message: response.data.resultMsg || '로그인 실패',
          data: response.data
        };
      }
    } catch (error) {
      this.isLoggedIn = false;
      console.error(`[${this.userId}] 로그인 오류:`, error.message);
      
      return {
        success: false,
        message: '로그인 중 오류 발생',
        error: error.message,
        data: error.response ? error.response.data : null
      };
    }
  }

  /**
   * 로그인 상태 확인
   * @returns {Promise<boolean>} 로그인 상태
   */
  async checkLoginStatus() {
    try {
      const response = await this.apiClient.client.get('index.php?ctrl=Passenger&action=getMainPsgrInfo');
      
      // 로그인 상태 확인
      if (response.data && response.data.result === 'OK') {
        this.isLoggedIn = true;
        return true;
      } else {
        this.isLoggedIn = false;
        return false;
      }
    } catch (error) {
      this.isLoggedIn = false;
      console.error(`[${this.userId}] 로그인 상태 확인 오류:`, error.message);
      return false;
    }
  }

  /**
   * 로그아웃
   * @returns {Promise<Object>} 로그아웃 결과
   */
  async logout() {
    try {
      // 실제 로그아웃 API 호출
      const response = await this.apiClient.client.post('index.php?ctrl=Main&action=logoutProc', 
        { a: 'a' },  // 더미 데이터
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      // 로컬 상태 초기화
      this.isLoggedIn = false;
      this.apiClient.setAuthorizationToken(null);
      console.log(`[${this.userId}] 로그아웃 완료`);
      
      return {
        success: true,
        message: '로그아웃 성공',
        data: response.data
      };
    } catch (error) {
      console.error(`[${this.userId}] 로그아웃 오류:`, error.message);
      
      // 오류가 발생해도 로컬에서는 로그아웃 처리
      this.isLoggedIn = false;
      this.apiClient.setAuthorizationToken(null);
      
      return {
        success: false,
        message: '로그아웃 중 오류 발생',
        error: error.message
      };
    }
  }
}

module.exports = AuthService;
