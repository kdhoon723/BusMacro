const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const qs = require('querystring');

/**
 * 사용자별 API 클라이언트 (대진대 버스 예약 시스템)
 */
class RequestUtil {
  constructor(userId = 'default') {
    this.userId = userId;
    this.jar = new CookieJar();
    this.authorization = null;
    
    // axios 인스턴스 생성 및 쿠키 지원 추가
    this.client = wrapper(axios.create({
      baseURL: 'https://daejin.unibus.kr/api/',
      timeout: 10000,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://daejin.unibus.kr/'
      },
      // JSON 객체를 적절한 형식으로 변환
      transformRequest: [
        (data, headers) => {
          if (typeof data === 'string') {
            return data;
          }
          
          if (data) {
            if (headers['Content-Type'] === 'application/json') {
              return JSON.stringify(data);
            } else if (headers['Content-Type'] === 'application/x-www-form-urlencoded') {
              return qs.stringify(data);
            }
          }
          return data;
        }
      ]
    }));
    
    // 쿠키 저장소 연결
    this.client.defaults.jar = this.jar;
    this.client.defaults.withCredentials = true;
    
    // 응답 인터셉터
    this.client.interceptors.response.use(
      response => response,
      error => {
        console.error(`[${this.userId}] 요청 실패:`, error.message);
        return Promise.reject(error);
      }
    );
  }

  setAuthorizationToken(token) {
    this.authorization = token;
    this.client.defaults.headers.authorization = token;
  }

  async get(url, config = {}) {
    return await this.client.get(url, config);
  }

  async post(url, data = {}, config = {}) {
    return await this.client.post(url, data, config);
  }

  // 세션 데이터 저장/복원용 메서드
  getSessionData() {
    return {
      cookies: this.jar.toJSON(),
      authorization: this.authorization,
      updatedAt: new Date()
    };
  }

  restoreSessionData(sessionData) {
    if (sessionData.cookies) {
      this.jar = CookieJar.fromJSON(sessionData.cookies);
      this.client.defaults.jar = this.jar;
    }
    if (sessionData.authorization) {
      this.setAuthorizationToken(sessionData.authorization);
    }
  }
}

module.exports = RequestUtil; 