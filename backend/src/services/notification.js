/**
 * 알림 서비스
 * 카카오톡 알림톡을 통한 알림 기능 구현
 */
const axios = require('axios');
const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore();

// 카카오톡 알림톡 API 설정
const KAKAO_API_KEY = process.env.KAKAO_API_KEY;
const KAKAO_SENDER_KEY = process.env.KAKAO_SENDER_KEY;
const KAKAO_TEMPLATE_CODE = process.env.KAKAO_TEMPLATE_CODE;
const KAKAO_API_URL = 'https://kapi.kakao.com/v1/api/talk/template/send';

/**
 * 사용자 전화번호 가져오기
 */
async function getUserPhone() {
  try {
    const userDoc = await db.collection('user').doc('auth').get();
    if (!userDoc.exists) {
      throw new Error('사용자 정보가 없습니다');
    }
    
    const userData = userDoc.data();
    if (!userData.phone) {
      throw new Error('전화번호 정보가 없습니다');
    }
    
    return userData.phone;
  } catch (error) {
    console.error('사용자 전화번호 가져오기 오류:', error);
    return null;
  }
}

/**
 * 알림톡 발송 설정 확인
 */
async function isNotificationEnabled() {
  try {
    const settingsDoc = await db.collection('user').doc('settings').get();
    if (!settingsDoc.exists) {
      return true; // 기본값: 알림 활성화
    }
    
    const settings = settingsDoc.data();
    return settings.notificationEnabled !== false;
  } catch (error) {
    console.error('알림 설정 확인 오류:', error);
    return true; // 오류 시 기본값: 알림 활성화
  }
}

/**
 * 카카오톡 알림톡 발송
 */
async function sendKakaoNotification(templateData, phone) {
  try {
    if (!KAKAO_API_KEY || !KAKAO_SENDER_KEY || !KAKAO_TEMPLATE_CODE) {
      throw new Error('카카오 API 설정이 없습니다');
    }
    
    if (!phone) {
      throw new Error('전화번호가 없습니다');
    }
    
    // 알림톡 데이터 구성
    const requestData = {
      template_object: {
        object_type: 'text',
        text: templateData.message,
        link: {
          web_url: '',
          mobile_web_url: ''
        },
        button_title: '자세히 보기'
      },
      template_id: KAKAO_TEMPLATE_CODE,
      receiver_uuids: [phone]
    };
    
    // 알림톡 API 호출
    const response = await axios.post(KAKAO_API_URL, requestData, {
      headers: {
        'Authorization': `Bearer ${KAKAO_API_KEY}`,
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
    
    console.log('카카오톡 알림 발송 성공:', response.data);
    return response.data;
  } catch (error) {
    console.error('카카오톡 알림 발송 오류:', error);
    throw new Error(`카카오톡 알림 발송 실패: ${error.message}`);
  }
}

/**
 * 성공 알림 발송
 */
async function sendSuccess(result) {
  try {
    // 알림 설정 확인
    const notificationEnabled = await isNotificationEnabled();
    if (!notificationEnabled) {
      console.log('알림이 비활성화되어 있습니다');
      return;
    }
    
    // 전화번호 가져오기
    const phone = await getUserPhone();
    if (!phone) {
      console.error('알림 발송 실패: 전화번호 없음');
      return;
    }
    
    // 성공 메시지 구성
    let message = `[대진대학교 버스 예약 성공]\n`;
    
    if (result.fromSchool && result.fromSchool.status === 'success') {
      const fromSchool = result.fromSchool.details;
      message += `\n▶ 하교 예약\n`;
      message += `• 노선: ${fromSchool.route}\n`;
      message += `• 시간: ${fromSchool.time}\n`;
      message += `• 정류장: ${fromSchool.station}\n`;
      message += `• 좌석: ${fromSchool.seatNumber}번\n`;
    }
    
    if (result.toSchool && result.toSchool.status === 'success') {
      const toSchool = result.toSchool.details;
      message += `\n▶ 등교 예약\n`;
      message += `• 노선: ${toSchool.route}\n`;
      message += `• 시간: ${toSchool.time}\n`;
      message += `• 정류장: ${toSchool.station}\n`;
      message += `• 좌석: ${toSchool.seatNumber}번\n`;
    }
    
    message += `\n예약 시간: ${new Date().toLocaleString('ko-KR')}`;
    
    // 알림톡 발송
    await sendKakaoNotification({ message }, phone);
    
    // 알림 로그 기록
    await db.collection('logs').doc('notifications').set({
      [new Date().toISOString()]: {
        type: 'success',
        message,
        sentTo: phone
      }
    }, { merge: true });
    
    console.log('성공 알림 발송 완료');
  } catch (error) {
    console.error('성공 알림 발송 오류:', error);
  }
}

/**
 * 경고 알림 발송
 */
async function sendAlert(title, message) {
  try {
    // 알림 설정 확인
    const notificationEnabled = await isNotificationEnabled();
    if (!notificationEnabled) {
      console.log('알림이 비활성화되어 있습니다');
      return;
    }
    
    // 전화번호 가져오기
    const phone = await getUserPhone();
    if (!phone) {
      console.error('알림 발송 실패: 전화번호 없음');
      return;
    }
    
    // 경고 메시지 구성
    const alertMessage = `[대진대학교 버스 예약 실패]\n\n▶ ${title}\n\n${message}\n\n발생 시간: ${new Date().toLocaleString('ko-KR')}\n\n수동으로 예약을 진행해주세요.`;
    
    // 알림톡 발송
    await sendKakaoNotification({ message: alertMessage }, phone);
    
    // 알림 로그 기록
    await db.collection('logs').doc('notifications').set({
      [new Date().toISOString()]: {
        type: 'alert',
        title,
        message,
        sentTo: phone
      }
    }, { merge: true });
    
    console.log('경고 알림 발송 완료');
  } catch (error) {
    console.error('경고 알림 발송 오류:', error);
  }
}

module.exports = {
  sendSuccess,
  sendAlert
}; 