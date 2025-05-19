/**
 * Firebase 초기 데이터 설정
 */
const { db } = require('./init');

/**
 * 초기 설정 데이터
 */
const initialSchedules = {
  sunday: {
    toSchool: {
      enabled: true,
      route: '장기/대화',
      time: '07:40',
      station: '대화역',
      seatNumber: 11
    },
    fromSchool: {
      enabled: true,
      route: '대화A',
      time: '15:45',
      station: '대화역',
      seatNumber: 11
    }
  },
  monday: {
    toSchool: {
      enabled: true,
      route: '장기/대화',
      time: '07:40',
      station: '대화역',
      seatNumber: 11
    },
    fromSchool: {
      enabled: true,
      route: '대화A',
      time: '13:45',
      station: '대화역',
      seatNumber: 11
    }
  },
  tuesday: {
    toSchool: {
      enabled: true,
      route: '대화A',
      time: '08:30',
      station: '대화역',
      seatNumber: 11
    },
    fromSchool: {
      enabled: true,
      route: '대화A',
      time: '15:45',
      station: '대화역',
      seatNumber: 11
    }
  }
};

const initialSettings = {
  reservationEnabled: true,
  notificationEnabled: true
};

/**
 * 초기 데이터 생성
 */
async function setupInitialData() {
  try {
    console.log('초기 데이터 설정 시작...');
    
    // 요일별 스케줄 데이터 설정
    const days = ['sunday', 'monday', 'tuesday'];
    for (const day of days) {
      const schedulesRef = db.collection('schedules').doc(day);
      
      // 문서가 존재하는지 확인
      const doc = await schedulesRef.get();
      if (!doc.exists) {
        // 문서가 없으면 초기 데이터 생성
        await schedulesRef.set(initialSchedules[day]);
        console.log(`${day} 스케줄 초기 데이터 생성 완료`);
      } else {
        console.log(`${day} 스케줄 데이터가 이미 존재합니다.`);
      }
    }
    
    // 상태 초기화
    const statusRef = db.collection('status').doc('current');
    const statusDoc = await statusRef.get();
    if (!statusDoc.exists) {
      await statusRef.set({
        currentState: 'idle',
        lastUpdated: new Date().toISOString(),
        nextScheduled: null
      });
      console.log('상태 초기 데이터 생성 완료');
    } else {
      console.log('상태 데이터가 이미 존재합니다.');
    }
    
    // 설정 초기화
    const settingsRef = db.collection('user').doc('settings');
    const settingsDoc = await settingsRef.get();
    if (!settingsDoc.exists) {
      await settingsRef.set(initialSettings);
      console.log('설정 초기 데이터 생성 완료');
    } else {
      console.log('설정 데이터가 이미 존재합니다.');
    }
    
    console.log('초기 데이터 설정 완료!');
  } catch (error) {
    console.error('초기 데이터 설정 오류:', error);
  }
}

// 스크립트 직접 실행 시 초기 데이터 설정
if (require.main === module) {
  setupInitialData()
    .then(() => {
      console.log('스크립트 실행 완료');
      process.exit(0);
    })
    .catch(error => {
      console.error('스크립트 실행 오류:', error);
      process.exit(1);
    });
}

module.exports = {
  setupInitialData
}; 