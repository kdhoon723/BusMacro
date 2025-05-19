import { defineStore } from 'pinia';
import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  Timestamp 
} from 'firebase/firestore';
import { useAuthStore } from './auth';

export const useReservationStore = defineStore('reservations', {
  state: () => ({
    schedules: {
      sunday: {
        toSchool: {
          enabled: false,
          route: '',
          time: '',
          station: '',
          seatNumber: 1
        },
        fromSchool: {
          enabled: false,
          route: '',
          time: '',
          station: '',
          seatNumber: 1
        }
      },
      monday: {
        toSchool: {
          enabled: false,
          route: '',
          time: '',
          station: '',
          seatNumber: 1
        },
        fromSchool: {
          enabled: false,
          route: '',
          time: '',
          station: '',
          seatNumber: 1
        }
      },
      tuesday: {
        toSchool: {
          enabled: false,
          route: '',
          time: '',
          station: '',
          seatNumber: 1
        },
        fromSchool: {
          enabled: false,
          route: '',
          time: '',
          station: '',
          seatNumber: 1
        }
      }
    },
    logs: [],
    availableRoutes: [],
    loading: false,
    error: null,
    nextReservation: {
      day: null,
      date: null,
      countdown: null
    }
  }),
  
  getters: {
    // 다음 예약 일정
    getNextReservation: (state) => state.nextReservation,
    
    // 특정 요일의 예약 설정
    getScheduleForDay: (state) => (day) => state.schedules[day] || null,
    
    // 로그 데이터
    getRecentLogs: (state) => state.logs.slice(0, 10), // 최근 10개 로그
    
    // 오늘 예약 여부
    hasTodayReservation: (state) => {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const today = days[new Date().getDay()];
      
      // 일, 월, 화요일만 해당
      if (!['sunday', 'monday', 'tuesday'].includes(today)) {
        return false;
      }
      
      const schedule = state.schedules[today];
      return schedule && (schedule.toSchool.enabled || schedule.fromSchool.enabled);
    },
    
    // 경로 옵션
    routeOptions: (state) => state.availableRoutes
  },
  
  actions: {
    // 사용자의 예약 설정 로드
    async loadSchedules() {
      this.loading = true;
      this.error = null;
      
      try {
        const authStore = useAuthStore();
        if (!authStore.userId) {
          throw new Error('인증되지 않은 사용자');
        }
        
        // 일/월/화요일 예약 설정 로드
        const days = ['sunday', 'monday', 'tuesday'];
        
        for (const day of days) {
          const scheduleDoc = await getDoc(doc(db, 'schedules', day));
          
          if (scheduleDoc.exists()) {
            this.schedules[day] = scheduleDoc.data();
          }
        }
        
        // 경로 옵션 로드
        const routesCollection = collection(db, 'routes');
        const routesSnapshot = await getDocs(routesCollection);
        
        this.availableRoutes = routesSnapshot.docs.map(doc => doc.data());
        
        return true;
      } catch (error) {
        this.error = error.message;
        console.error('예약 설정 로드 오류:', error);
        return false;
      } finally {
        this.loading = false;
      }
    },
    
    // 예약 설정 저장
    async saveSchedule(day, scheduleData) {
      this.loading = true;
      this.error = null;
      
      try {
        const authStore = useAuthStore();
        if (!authStore.userId) {
          throw new Error('인증되지 않은 사용자');
        }
        
        // Firestore에 예약 설정 저장
        await setDoc(doc(db, 'schedules', day), scheduleData);
        
        // 로컬 상태 업데이트
        this.schedules[day] = { ...scheduleData };
        
        return true;
      } catch (error) {
        this.error = error.message;
        console.error('예약 설정 저장 오류:', error);
        return false;
      } finally {
        this.loading = false;
      }
    },
    
    // 최근 로그 로드
    async loadLogs() {
      this.loading = true;
      this.error = null;
      
      try {
        const authStore = useAuthStore();
        if (!authStore.userId) {
          throw new Error('인증되지 않은 사용자');
        }
        
        // 최근 30일의 로그 데이터 로드
        const logsCollection = collection(db, 'logs');
        
        // 30일 전 날짜 계산
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // 날짜 형식을 YYYYMMDD 문자열로 변환
        const dateString = thirtyDaysAgo.getFullYear() +
          String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0') +
          String(thirtyDaysAgo.getDate()).padStart(2, '0');
        
        // 날짜를 기준으로 정렬된 쿼리
        const logsQuery = query(
          logsCollection,
          orderBy('date', 'desc')
        );
        
        const logsSnapshot = await getDocs(logsQuery);
        
        // 로그 데이터 변환
        this.logs = logsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            date: data.date,
            ...data
          };
        });
        
        return true;
      } catch (error) {
        this.error = error.message;
        console.error('로그 로드 오류:', error);
        return false;
      } finally {
        this.loading = false;
      }
    },
    
    // 다음 예약 일정 계산
    calculateNextReservation() {
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
      
      // 카운트다운 계산 (밀리초)
      const countdown = nextDate.getTime() - now.getTime();
      
      this.nextReservation = {
        day: ['일', '월', '화'][nextDay],
        date: nextDate.toISOString(),
        timestamp: nextDate.getTime(),
        countdown
      };
      
      return this.nextReservation;
    }
  }
}); 