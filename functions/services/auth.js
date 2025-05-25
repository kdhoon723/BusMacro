const RequestUtil = require('../utils/request');
const FirestoreService = require('./firestore');

class AuthService {
  constructor() {
    this.firestoreService = new FirestoreService();
    console.log('AuthService 초기화 완료');
  }

  async login(userId) {
    try {
      console.log(`[${userId}] 로그인 프로세스 시작`);
      
      // Firestore에서 사용자 정보 조회
      const user = await this.firestoreService.getUser(userId);
      if (!user) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      // 기존 세션 데이터 확인
      const existingSession = await this.firestoreService.getSessionData(userId);
      const requestUtil = new RequestUtil(userId);
      
      // 기존 세션이 있다면 복원 시도
      if (existingSession) {
        requestUtil.restoreSessionData(existingSession);
        
        // 세션 유효성 검사
        const isValid = await this.checkSessionValidity(userId, requestUtil);
        if (isValid) {
          console.log(`[${userId}] 기존 세션 재사용 성공`);
          return {
            success: true,
            authToken: existingSession.authToken,
            requestUtil: requestUtil,
            reusedSession: true
          };
        }
      }

      // 새로운 로그인 시도 (실제 대진대 버스 API)
      console.log(`[${userId}] 새로운 로그인 시도`);
      const loginResponse = await requestUtil.post(
        'index.php?ctrl=Main&action=loginProc',
        {
          id: user.studentId,
          pass: user.password, // 실제로는 복호화 필요
          autoLogin: ''
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (loginResponse.data && loginResponse.data.result === 'OK') {
        const authToken = loginResponse.data.data;
        if (authToken) {
          requestUtil.setAuthorizationToken(authToken);
        }
        
        const sessionData = {
          ...requestUtil.getSessionData(),
          authToken: authToken,
          loginTime: new Date().toISOString()
        };

        // 세션 데이터 저장
        await this.firestoreService.saveSessionData(userId, sessionData);
        
        // 사용자 마지막 로그인 시간 업데이트
        await this.firestoreService.updateUser(userId, {
          lastLogin: new Date()
        });

        console.log(`[${userId}] 로그인 성공 - 토큰: ${authToken || '토큰 없음'}`);
        return {
          success: true,
          authToken: authToken,
          requestUtil: requestUtil,
          reusedSession: false
        };
      } else {
        throw new Error(loginResponse.data?.resultMsg || '로그인 실패');
      }
    } catch (error) {
      console.error(`[${userId}] 로그인 실패:`, error.message);
      
      // 실패 로그 저장
      await this.firestoreService.createReservationLog({
        userId: userId,
        action: 'login',
        status: 'failed',
        errorMessage: error.message,
        attemptTime: new Date()
      });
      
      throw error;
    }
  }

  async checkSessionValidity(userId, requestUtil) {
    try {
      console.log(`[${userId}] 세션 유효성 검사`);
      const response = await requestUtil.get('index.php?ctrl=Passenger&action=getMainPsgrInfo');
      
      const isValid = response.data && response.data.result === 'OK';
      console.log(`[${userId}] 세션 유효성: ${isValid ? '유효' : '무효'}`);
      return isValid;
    } catch (error) {
      console.error(`[${userId}] 세션 유효성 검사 실패:`, error.message);
      return false;
    }
  }

  async logout(userId, requestUtil) {
    try {
      console.log(`[${userId}] 로그아웃 시도`);
      
      await requestUtil.post(
        'index.php?ctrl=Main&action=logoutProc',
        { a: 'a' }, // 더미 데이터
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      // 저장된 세션 데이터 삭제
      await this.firestoreService.db.collection('sessions').doc(userId).delete();
      
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
      
      const isAuthenticated = response.data.result === 'success';
      console.log(`[${userId}] 인증 상태: ${isAuthenticated ? '인증됨' : '인증 안됨'}`);
      return isAuthenticated;
    } catch (error) {
      console.error(`[${userId}] 인증 상태 확인 실패:`, error.message);
      return false;
    }
  }

  // 대량 로그인 처리 (사전 로그인용)
  async batchLogin(userIds) {
    console.log(`대량 로그인 시작: ${userIds.length}명`);
    
    const results = await Promise.allSettled(
      userIds.map(userId => this.login(userId))
    );

    const successCount = results.filter(r => 
      r.status === 'fulfilled' && r.value && r.value.success
    ).length;

    console.log(`대량 로그인 완료: ${successCount}/${userIds.length} 성공`);
    return {
      total: userIds.length,
      success: successCount,
      failed: userIds.length - successCount,
      results: results
    };
  }

  // 세션 정리 (오래된 세션 삭제)
  async cleanupOldSessions(hoursOld = 24) {
    try {
      const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
      
      const snapshot = await this.firestoreService.db
        .collection('sessions')
        .where('updatedAt', '<', cutoffTime)
        .get();

      const batch = this.firestoreService.db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      if (!snapshot.empty) {
        await batch.commit();
        console.log(`오래된 세션 ${snapshot.size}개 정리 완료`);
      }
    } catch (error) {
      console.error('세션 정리 실패:', error);
    }
  }
}

module.exports = AuthService; 