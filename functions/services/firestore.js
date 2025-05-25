const admin = require('firebase-admin');

class FirestoreService {
  constructor() {
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    this.db = admin.firestore();
    console.log('FirestoreService 초기화 완료');
  }

  // ========== 사용자 관리 ==========
  async getUser(userId) {
    try {
      const doc = await this.db.collection('users').doc(userId).get();
      if (doc.exists) {
        console.log(`사용자 조회 성공: ${userId}`);
        return { id: doc.id, ...doc.data() };
      } else {
        console.log(`사용자를 찾을 수 없음: ${userId}`);
        return null;
      }
    } catch (error) {
      console.error(`사용자 조회 실패: ${userId}`, error);
      throw error;
    }
  }

  async createUser(userId, userData) {
    try {
      await this.db.collection('users').doc(userId).set({
        ...userData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        isActive: true
      });
      console.log(`사용자 생성 완료: ${userId}`);
    } catch (error) {
      console.error(`사용자 생성 실패: ${userId}`, error);
      throw error;
    }
  }

  async updateUser(userId, updates) {
    try {
      await this.db.collection('users').doc(userId).update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`사용자 업데이트 완료: ${userId}`);
    } catch (error) {
      console.error(`사용자 업데이트 실패: ${userId}`, error);
      throw error;
    }
  }

  async deleteUser(userId) {
    try {
      await this.db.collection('users').doc(userId).delete();
      console.log(`사용자 삭제 완료: ${userId}`);
    } catch (error) {
      console.error(`사용자 삭제 실패: ${userId}`, error);
      throw error;
    }
  }

  // ========== 예약 설정 관리 ==========
  async getReservationSettings(userId) {
    try {
      const doc = await this.db.collection('reservationSettings').doc(userId).get();
      if (doc.exists) {
        console.log(`예약 설정 조회 성공: ${userId}`);
        return doc.data();
      } else {
        console.log(`예약 설정을 찾을 수 없음: ${userId}`);
        return null;
      }
    } catch (error) {
      console.error(`예약 설정 조회 실패: ${userId}`, error);
      throw error;
    }
  }

  async setReservationSettings(userId, settings) {
    try {
      await this.db.collection('reservationSettings').doc(userId).set({
        ...settings,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`예약 설정 저장 완료: ${userId}`);
    } catch (error) {
      console.error(`예약 설정 저장 실패: ${userId}`, error);
      throw error;
    }
  }

  // ========== 예약 로그 관리 ==========
  async createReservationLog(logData) {
    try {
      const ref = await this.db.collection('reservationLogs').add({
        ...logData,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`예약 로그 생성 완료: ${ref.id}`);
      return ref.id;
    } catch (error) {
      console.error('예약 로그 생성 실패:', error);
      throw error;
    }
  }

  async updateReservationLog(logId, updates) {
    try {
      await this.db.collection('reservationLogs').doc(logId).update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`예약 로그 업데이트 완료: ${logId}`);
    } catch (error) {
      console.error(`예약 로그 업데이트 실패: ${logId}`, error);
      throw error;
    }
  }

  async getReservationLogs(userId, limit = 10) {
    try {
      const snapshot = await this.db.collection('reservationLogs')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log(`예약 로그 조회 완료: ${userId} (${logs.length}개)`);
      return logs;
    } catch (error) {
      console.error(`예약 로그 조회 실패: ${userId}`, error);
      throw error;
    }
  }

  // ========== 활성 사용자 조회 ==========
  async getActiveUsers() {
    try {
      const snapshot = await this.db.collection('users')
        .where('isActive', '==', true)
        .get();
      
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log(`활성 사용자 조회 완료: ${users.length}명`);
      return users;
    } catch (error) {
      console.error('활성 사용자 조회 실패:', error);
      throw error;
    }
  }

  // ========== 오늘의 예약 설정 조회 ==========
  async getTodayReservations() {
    try {
      const snapshot = await this.db.collection('reservationSettings')
        .where('autoReserve', '==', true)
        .get();
      
      const reservations = snapshot.docs.map(doc => ({
        userId: doc.id,
        ...doc.data()
      }));
      
      console.log(`오늘의 예약 설정 조회 완료: ${reservations.length}개`);
      return reservations;
    } catch (error) {
      console.error('오늘의 예약 설정 조회 실패:', error);
      throw error;
    }
  }

  // ========== 세션 데이터 관리 ==========
  async saveSessionData(userId, sessionData) {
    try {
      await this.db.collection('sessions').doc(userId).set({
        ...sessionData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`세션 데이터 저장 완료: ${userId}`);
    } catch (error) {
      console.error(`세션 데이터 저장 실패: ${userId}`, error);
      throw error;
    }
  }

  async getSessionData(userId) {
    try {
      const doc = await this.db.collection('sessions').doc(userId).get();
      if (doc.exists) {
        console.log(`세션 데이터 조회 성공: ${userId}`);
        return doc.data();
      } else {
        console.log(`세션 데이터를 찾을 수 없음: ${userId}`);
        return null;
      }
    } catch (error) {
      console.error(`세션 데이터 조회 실패: ${userId}`, error);
      throw error;
    }
  }

  // ========== 주간 스케줄 관리 (새로운 확장 모델) ==========
  async getWeeklySchedule(userId) {
    try {
      const doc = await this.db.collection('weeklySchedules').doc(userId).get();
      if (doc.exists) {
        console.log(`주간 스케줄 조회 성공: ${userId}`);
        return doc.data();
      } else {
        console.log(`주간 스케줄을 찾을 수 없음: ${userId}, 기본값 반환`);
        // 기본 주간 스케줄 반환
        return {
          monday: { enabled: false, route: '', time: '', seats: [], direction: 'DOWN' },
          tuesday: { enabled: false, route: '', time: '', seats: [], direction: 'DOWN' },
          wednesday: { enabled: false, route: '', time: '', seats: [], direction: 'DOWN' },
          thursday: { enabled: false, route: '', time: '', seats: [], direction: 'DOWN' },
          friday: { enabled: false, route: '', time: '', seats: [], direction: 'DOWN' }
        };
      }
    } catch (error) {
      console.error(`주간 스케줄 조회 실패: ${userId}`, error);
      throw error;
    }
  }

  async setWeeklySchedule(userId, weeklySchedule) {
    try {
      await this.db.collection('weeklySchedules').doc(userId).set({
        ...weeklySchedule,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`주간 스케줄 저장 완료: ${userId}`);
    } catch (error) {
      console.error(`주간 스케줄 저장 실패: ${userId}`, error);
      throw error;
    }
  }

  async updateDaySchedule(userId, dayOfWeek, daySchedule) {
    try {
      const updateData = {};
      updateData[dayOfWeek] = daySchedule;
      updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      
      await this.db.collection('weeklySchedules').doc(userId).update(updateData);
      console.log(`${dayOfWeek} 스케줄 업데이트 완료: ${userId}`);
    } catch (error) {
      console.error(`${dayOfWeek} 스케줄 업데이트 실패: ${userId}`, error);
      throw error;
    }
  }

  // 특정 요일과 노선에 대한 예약 대상 사용자들 조회
  async getUsersForDayAndRoute(dayOfWeek, routeFilter = null) {
    try {
      const snapshot = await this.db.collection('weeklySchedules').get();
      
      const users = [];
      snapshot.docs.forEach(doc => {
        const userId = doc.id;
        const schedule = doc.data();
        const daySchedule = schedule[dayOfWeek];
        
        if (daySchedule && daySchedule.enabled) {
          // 노선 필터가 있으면 적용
          if (routeFilter) {
            if (routeFilter === 'nowon' && daySchedule.route.includes('노원')) {
              users.push({ userId, ...daySchedule });
            } else if (routeFilter === 'other' && !daySchedule.route.includes('노원')) {
              users.push({ userId, ...daySchedule });
            }
          } else {
            users.push({ userId, ...daySchedule });
          }
        }
      });
      
      console.log(`${dayOfWeek} ${routeFilter || '전체'} 노선 사용자 조회: ${users.length}명`);
      return users;
    } catch (error) {
      console.error(`${dayOfWeek} 사용자 조회 실패:`, error);
      throw error;
    }
  }

  // 오늘 실행할 예약들 조회 (요일과 시간별)
  async getTodayExecutionTargets(dayOfWeek, timeSlot) {
    try {
      let routeFilter = null;
      
      // 시간대별 노선 필터 설정
      if (timeSlot === '21:00') {
        routeFilter = 'other'; // 노원 제외
      } else if (timeSlot === '22:00') {
        routeFilter = 'nowon'; // 노원만
      }
      
      const users = await this.getUsersForDayAndRoute(dayOfWeek, routeFilter);
      console.log(`오늘(${dayOfWeek}) ${timeSlot} 실행 대상: ${users.length}명`);
      return users;
    } catch (error) {
      console.error(`오늘 실행 대상 조회 실패: ${dayOfWeek} ${timeSlot}`, error);
      throw error;
    }
  }

  // ========== 노선 정보 관리 ==========
  async getRouteInfo(routeName) {
    try {
      const doc = await this.db.collection('routeInfo').doc(routeName).get();
      if (doc.exists) {
        return doc.data();
      } else {
        // 기본 노선 정보 반환
        const isNowon = routeName.includes('노원');
        return {
          name: routeName,
          executionTime: isNowon ? '22:00' : '21:00',
          isSpecialRoute: isNowon,
          description: isNowon ? '노원 노선 - 22시 정각 예약' : '일반 노선 - 21시 정각 예약'
        };
      }
    } catch (error) {
      console.error(`노선 정보 조회 실패: ${routeName}`, error);
      throw error;
    }
  }

  async setRouteInfo(routeName, routeInfo) {
    try {
      await this.db.collection('routeInfo').doc(routeName).set({
        ...routeInfo,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`노선 정보 저장 완료: ${routeName}`);
    } catch (error) {
      console.error(`노선 정보 저장 실패: ${routeName}`, error);
      throw error;
    }
  }
}

module.exports = FirestoreService; 