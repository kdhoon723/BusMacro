# 🛠️ Firebase 구현 가이드 - 기술적 세부사항

## 🚀 Phase 1: 즉시 시작 가능한 작업

### 1.1 의존성 설치 및 환경 설정

```bash
# 1. Functions 디렉토리로 이동
cd functions

# 2. 필요한 패키지 설치
npm install axios@^1.6.2 tough-cookie@^4.1.3 axios-cookiejar-support@^4.0.7 node-cron@^3.0.2

# 3. Firebase CLI 최신 버전 확인
firebase --version

# 4. 프로젝트 정보 확인
firebase projects:list
firebase use --add
```

### 1.2 폴더 구조 생성

```bash
# functions 디렉토리 내에서 실행
mkdir -p services utils triggers
```

### 1.3 환경 변수 설정

```bash
# 개발 환경 설정
firebase functions:config:set app.env="development"
firebase functions:config:set app.timezone="Asia/Seoul"
firebase functions:config:set app.reservation_time="21:00:00"

# 알림 설정 (선택사항)
firebase functions:config:set notifications.discord_webhook="YOUR_WEBHOOK_URL"
firebase functions:config:set notifications.email_service="gmail"
```

## 🔧 Phase 2: 핵심 서비스 구현

### 2.1 utils/request.js - HTTP 클라이언트

```javascript
const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

class RequestUtil {
  constructor(userId) {
    this.userId = userId;
    this.jar = new CookieJar();
    this.client = wrapper(axios.create({
      jar: this.jar,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    }));
  }

  async post(url, data, options = {}) {
    try {
      const response = await this.client.post(url, data, {
        ...options,
        withCredentials: true
      });
      return response;
    } catch (error) {
      console.error(`[${this.userId}] POST 요청 실패:`, error.message);
      throw error;
    }
  }

  async get(url, options = {}) {
    try {
      const response = await this.client.get(url, {
        ...options,
        withCredentials: true
      });
      return response;
    } catch (error) {
      console.error(`[${this.userId}] GET 요청 실패:`, error.message);
      throw error;
    }
  }

  getCookies() {
    return this.jar.toJSON();
  }

  setCookies(cookies) {
    if (cookies && cookies.cookies) {
      cookies.cookies.forEach(cookie => {
        this.jar.setCookieSync(cookie.key + '=' + cookie.value, cookie.domain);
      });
    }
  }
}

module.exports = RequestUtil;
```

### 2.2 services/firestore.js - 데이터베이스 서비스

```javascript
const admin = require('firebase-admin');

class FirestoreService {
  constructor() {
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    this.db = admin.firestore();
  }

  // 사용자 관리
  async getUser(userId) {
    const doc = await this.db.collection('users').doc(userId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async createUser(userId, userData) {
    await this.db.collection('users').doc(userId).set({
      ...userData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true
    });
  }

  async updateUser(userId, updates) {
    await this.db.collection('users').doc(userId).update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  async deleteUser(userId) {
    await this.db.collection('users').doc(userId).delete();
  }

  // 예약 설정 관리
  async getReservationSettings(userId) {
    const doc = await this.db.collection('reservationSettings').doc(userId).get();
    return doc.exists ? doc.data() : null;
  }

  async setReservationSettings(userId, settings) {
    await this.db.collection('reservationSettings').doc(userId).set({
      ...settings,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // 예약 로그 관리
  async createReservationLog(logData) {
    const ref = await this.db.collection('reservationLogs').add({
      ...logData,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  }

  async updateReservationLog(logId, updates) {
    await this.db.collection('reservationLogs').doc(logId).update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // 활성 사용자 조회
  async getActiveUsers() {
    const snapshot = await this.db.collection('users')
      .where('isActive', '==', true)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  // 오늘의 예약 설정 조회
  async getTodayReservations() {
    const snapshot = await this.db.collection('reservationSettings')
      .where('autoReserve', '==', true)
      .get();
    
    return snapshot.docs.map(doc => ({
      userId: doc.id,
      ...doc.data()
    }));
  }
}

module.exports = FirestoreService;
```

### 2.3 services/auth.js - 인증 서비스 (Firebase 적응)

```javascript
const RequestUtil = require('../utils/request');
const FirestoreService = require('./firestore');

class AuthService {
  constructor() {
    this.firestoreService = new FirestoreService();
  }

  async login(userId) {
    try {
      // Firestore에서 사용자 정보 조회
      const user = await this.firestoreService.getUser(userId);
      if (!user) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      // 새 HTTP 클라이언트 생성
      const requestUtil = new RequestUtil(userId);
      
      // 로그인 시도
      const loginResponse = await requestUtil.post(
        'https://m.daejin.ac.kr/sys/main/main.kmc',
        {
          classname: 'Mobile_Sys_Index_Main',
          method: 'Main',
          action: 'loginProc',
          id: user.studentId,
          pass: user.password, // 실제로는 암호화 해제 필요
          autoLogin: 'on'
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (loginResponse.data.result === 'success') {
        // 세션 쿠키 저장 (Firestore에 저장할 수도 있음)
        const cookies = requestUtil.getCookies();
        
        // 사용자 마지막 로그인 시간 업데이트
        await this.firestoreService.updateUser(userId, {
          lastLogin: new Date(),
          lastSessionCookies: cookies
        });

        return {
          success: true,
          authToken: loginResponse.data.data,
          requestUtil: requestUtil
        };
      } else {
        throw new Error(loginResponse.data.message || '로그인 실패');
      }
    } catch (error) {
      console.error(`[${userId}] 로그인 실패:`, error.message);
      
      // 실패 로그 저장
      await this.firestoreService.createReservationLog({
        userId: userId,
        action: 'login',
        status: 'failed',
        errorMessage: error.message
      });
      
      throw error;
    }
  }

  async logout(userId, requestUtil) {
    try {
      await requestUtil.post(
        'https://m.daejin.ac.kr/sys/main/main.kmc',
        {
          classname: 'Mobile_Sys_Index_Main',
          method: 'Main',
          action: 'logoutProc'
        }
      );
      
      console.log(`[${userId}] 로그아웃 완료`);
    } catch (error) {
      console.error(`[${userId}] 로그아웃 실패:`, error.message);
    }
  }

  async getAuthStatus(userId, requestUtil) {
    try {
      const response = await requestUtil.get(
        'https://m.daejin.ac.kr/sys/main/main.kmc?classname=Mobile_Sys_Index_Main&method=Main&action=authStatus'
      );
      
      return response.data.result === 'success';
    } catch (error) {
      console.error(`[${userId}] 인증 상태 확인 실패:`, error.message);
      return false;
    }
  }
}

module.exports = AuthService;
```

## 🎯 Phase 3: HTTP 트리거 함수

### 3.1 triggers/http.js - HTTP API 엔드포인트

```javascript
const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const AuthService = require('../services/auth');
const ReservationService = require('../services/reservation');
const FirestoreService = require('../services/firestore');

// 글로벌 설정
setGlobalOptions({
  region: 'asia-northeast3', // 서울 리전
  memory: '1GiB',
  timeoutSeconds: 300
});

const authService = new AuthService();
const reservationService = new ReservationService();
const firestoreService = new FirestoreService();

// 사용자 추가
exports.addUser = onRequest(async (req, res) => {
  try {
    const { userId, studentId, password, name } = req.body;
    
    if (!userId || !studentId || !password) {
      return res.status(400).json({ 
        success: false, 
        message: '필수 정보가 누락되었습니다.' 
      });
    }

    // 로그인 테스트
    await firestoreService.createUser(userId, {
      studentId,
      password, // 실제로는 암호화 필요
      name: name || '익명'
    });

    // 실제 로그인 테스트
    try {
      await authService.login(userId);
      res.json({ 
        success: true, 
        message: '사용자가 성공적으로 추가되었습니다.' 
      });
    } catch (loginError) {
      // 로그인 실패 시 사용자 삭제
      await firestoreService.deleteUser(userId);
      throw new Error(`로그인 테스트 실패: ${loginError.message}`);
    }
  } catch (error) {
    console.error('사용자 추가 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// 로그인 테스트
exports.testLogin = onRequest(async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'userId가 필요합니다.' 
      });
    }

    const result = await authService.login(userId);
    res.json({ 
      success: true, 
      message: '로그인 성공',
      authToken: result.authToken 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// 예약 설정
exports.setReservation = onRequest(async (req, res) => {
  try {
    const { userId, targetRoute, targetTime, preferredSeats, autoReserve } = req.body;
    
    await firestoreService.setReservationSettings(userId, {
      targetRoute,
      targetTime,
      preferredSeats: preferredSeats || [],
      autoReserve: autoReserve !== false
    });

    res.json({ 
      success: true, 
      message: '예약 설정이 저장되었습니다.' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// 예약 상태 조회
exports.getReservationStatus = onRequest(async (req, res) => {
  try {
    const { userId } = req.query;
    
    const settings = await firestoreService.getReservationSettings(userId);
    const user = await firestoreService.getUser(userId);
    
    // 최근 로그 조회
    const logsSnapshot = await firestoreService.db
      .collection('reservationLogs')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    
    const logs = logsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      success: true,
      data: {
        user,
        settings,
        recentLogs: logs
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});
```

## ⏰ Phase 4: 스케줄링 시스템

### 4.1 triggers/scheduled.js - 스케줄 함수

```javascript
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const AuthService = require('../services/auth');
const ReservationService = require('../services/reservation');
const FirestoreService = require('../services/firestore');

setGlobalOptions({
  region: 'asia-northeast3',
  memory: '2GiB',
  timeoutSeconds: 540
});

const authService = new AuthService();
const reservationService = new ReservationService();
const firestoreService = new FirestoreService();

// 로그인 세션 준비 (20:59:00)
exports.preLogin = onSchedule('59 20 * * 1-5', async (event) => {
  console.log('🔐 사전 로그인 프로세스 시작');
  
  try {
    const activeUsers = await firestoreService.getActiveUsers();
    const loginPromises = [];

    for (const user of activeUsers) {
      const loginPromise = authService.login(user.id).catch(error => {
        console.error(`[${user.id}] 사전 로그인 실패:`, error.message);
        return null;
      });
      
      loginPromises.push(loginPromise);
    }

    const results = await Promise.allSettled(loginPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
    
    console.log(`✅ 사전 로그인 완료: ${successCount}/${activeUsers.length} 성공`);
  } catch (error) {
    console.error('❌ 사전 로그인 프로세스 실패:', error);
  }
});

// 정확한 예약 실행 (21:00:00)
exports.executeReservation = onSchedule('0 21 * * 1-5', async (event) => {
  console.log('🚌 예약 실행 프로세스 시작');
  
  try {
    const reservations = await firestoreService.getTodayReservations();
    
    // 정확한 21:00:00에 실행되도록 타이밍 조정
    const now = new Date();
    const targetTime = new Date();
    targetTime.setHours(21, 0, 0, 0);
    
    const delay = targetTime.getTime() - now.getTime();
    
    if (delay > 0) {
      console.log(`⏰ ${delay}ms 후 정확한 시간에 실행됩니다.`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // 동시 예약 실행
    const reservationPromises = reservations.map(async (reservation) => {
      const logId = await firestoreService.createReservationLog({
        userId: reservation.userId,
        targetRoute: reservation.targetRoute,
        targetTime: reservation.targetTime,
        status: 'pending',
        attemptTime: new Date()
      });

      try {
        // 로그인된 세션 재사용 또는 새로운 로그인
        const authResult = await authService.login(reservation.userId);
        
        // 예약 실행
        const reservationResult = await reservationService.makeReservation(
          reservation.userId,
          authResult.requestUtil,
          authResult.authToken,
          reservation.targetRoute,
          reservation.targetTime,
          reservation.preferredSeats
        );

        // 성공 로그 업데이트
        await firestoreService.updateReservationLog(logId, {
          status: 'success',
          seatNumber: reservationResult.seatNumber,
          executionTimeMs: Date.now() - targetTime.getTime()
        });

        console.log(`✅ [${reservation.userId}] 예약 성공: ${reservationResult.seatNumber}`);
        return { userId: reservation.userId, success: true, ...reservationResult };
      } catch (error) {
        // 실패 로그 업데이트
        await firestoreService.updateReservationLog(logId, {
          status: 'failed',
          errorMessage: error.message,
          executionTimeMs: Date.now() - targetTime.getTime()
        });

        console.error(`❌ [${reservation.userId}] 예약 실패:`, error.message);
        return { userId: reservation.userId, success: false, error: error.message };
      }
    });

    const results = await Promise.allSettled(reservationPromises);
    const successCount = results.filter(r => 
      r.status === 'fulfilled' && r.value && r.value.success
    ).length;

    console.log(`🎯 예약 실행 완료: ${successCount}/${reservations.length} 성공`);
  } catch (error) {
    console.error('❌ 예약 실행 프로세스 실패:', error);
  }
});

// 상태 모니터링 (매 30초)
exports.monitorReservation = onSchedule('*/30 20-21 * * 1-5', async (event) => {
  try {
    // 진행중인 예약들의 상태 확인
    const pendingLogsSnapshot = await firestoreService.db
      .collection('reservationLogs')
      .where('status', '==', 'pending')
      .where('createdAt', '>=', new Date(Date.now() - 3600000)) // 1시간 이내
      .get();

    if (!pendingLogsSnapshot.empty) {
      console.log(`📊 진행중인 예약: ${pendingLogsSnapshot.size}개`);
    }
  } catch (error) {
    console.error('모니터링 실패:', error);
  }
});
```

## 📱 Phase 5: 실시간 알림 시스템

### 5.1 triggers/firestore.js - Firestore 트리거

```javascript
const { onDocumentUpdated, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');

setGlobalOptions({
  region: 'asia-northeast3'
});

// 예약 상태 변경 알림
exports.onReservationUpdate = onDocumentUpdated('reservationLogs/{logId}', async (event) => {
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();
  
  // 상태가 변경된 경우에만 알림
  if (beforeData.status !== afterData.status) {
    const { userId, status, seatNumber, errorMessage } = afterData;
    
    try {
      if (status === 'success') {
        console.log(`🎉 [${userId}] 예약 성공 알림: 좌석 ${seatNumber}`);
        // Discord/이메일 알림 발송
        await sendNotification(userId, 'success', `예약이 성공했습니다! 좌석: ${seatNumber}`);
      } else if (status === 'failed') {
        console.log(`😞 [${userId}] 예약 실패 알림: ${errorMessage}`);
        // 실패 알림 발송
        await sendNotification(userId, 'failed', `예약에 실패했습니다: ${errorMessage}`);
      }
    } catch (error) {
      console.error('알림 발송 실패:', error);
    }
  }
});

// 새 사용자 추가 시 검증
exports.onUserCreated = onDocumentCreated('users/{userId}', async (event) => {
  const userId = event.params.userId;
  const userData = event.data.data();
  
  console.log(`👤 새 사용자 추가: ${userId} (${userData.name})`);
  
  // 환영 알림 또는 추가 검증 로직
});

async function sendNotification(userId, type, message) {
  // Discord Webhook 또는 이메일 발송 로직
  // 실제 구현에서는 외부 서비스 연동
  console.log(`📢 [${userId}] ${type}: ${message}`);
}
```

## 🚀 배포 명령어 모음

### 로컬 테스트
```bash
# 에뮬레이터 시작
firebase emulators:start --only functions,firestore

# 특정 함수 테스트
curl -X POST http://localhost:5001/your-project/asia-northeast3/testLogin \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user"}'
```

### 배포
```bash
# Functions만 배포
firebase deploy --only functions

# 특정 함수만 배포
firebase deploy --only functions:testLogin,functions:addUser

# 전체 배포
firebase deploy
```

### 로그 확인
```bash
# 실시간 로그
firebase functions:log --only executeReservation

# 특정 시간 로그
firebase functions:log --since 1h
```

## ✅ 구현 체크리스트

### Phase 1 (30분)
- [ ] functions 폴더 의존성 설치
- [ ] 폴더 구조 생성
- [ ] 환경 변수 설정
- [ ] Firebase 프로젝트 설정 확인

### Phase 2 (1시간)
- [ ] RequestUtil 클래스 구현
- [ ] FirestoreService 클래스 구현
- [ ] AuthService Firebase 적응
- [ ] ReservationService Firebase 적응

### Phase 3 (45분)
- [ ] HTTP 트리거 함수 구현
- [ ] API 엔드포인트 테스트
- [ ] 에러 핸들링 구현

### Phase 4 (45분)
- [ ] 스케줄 함수 구현
- [ ] 정밀 타이밍 시스템 구현
- [ ] Cloud Scheduler 설정

### Phase 5 (30분)
- [ ] Firestore 트리거 구현
- [ ] 알림 시스템 구현
- [ ] 보안 규칙 업데이트

### 테스트 및 배포 (35분)
- [ ] 로컬 에뮬레이터 테스트
- [ ] 스테이징 배포
- [ ] 프로덕션 배포
- [ ] 모니터링 설정

**총 예상 시간: 3시간 25분**

이제 바로 시작할 수 있습니다! 🚀 