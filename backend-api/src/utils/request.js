const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const qs = require('querystring');

/**
 * 사용자별 API 클라이언트 생성
 * @param {string} userId - 사용자 식별자
 * @returns {Object} axios 인스턴스
 */
function createUserClient(userId) {
  // 쿠키 저장소 생성
  const jar = new CookieJar();
  
  // axios 인스턴스 생성 및 쿠키 지원 추가
  const client = wrapper(axios.create({
    baseURL: 'https://daejin.unibus.kr/api/',
    timeout: 10000,
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': 'https://daejin.unibus.kr/'
    },
    // JSON 객체를 form data 형식으로 변환 (기본값)
    transformRequest: [
      (data, headers) => {
        // 이미 문자열이면 그대로 반환
        if (typeof data === 'string') {
          return data;
        }
        
        // Content-Type에 따라 적절한 형식으로 변환
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
  client.defaults.jar = jar;
  client.defaults.withCredentials = true;
  
  // 응답 인터셉터 추가
  client.interceptors.response.use(
    response => response,
    error => {
      console.error(`[${userId}] 요청 실패:`, error.message);
      return Promise.reject(error);
    }
  );
  
  return {
    client,
    jar,
    authorization: null,
    setAuthorizationToken(token) {
      this.authorization = token;
      this.client.defaults.headers.authorization = token;
    }
  };
}

module.exports = {
  createUserClient
};
