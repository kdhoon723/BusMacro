/**
 * Firebase 초기화 및 연결
 */
const admin = require('firebase-admin');
const { applicationDefault } = require('firebase-admin/app');
require('dotenv').config();

// 환경 변수에서 Firebase 프로젝트 ID 가져오기
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

// 인증 방식 선택 로직
let credential;
let useGcloudAuth = process.env.USE_GCLOUD_AUTH === 'true';

if (useGcloudAuth) {
  // gcloud 인증 사용 (applicationDefault)
  console.log('gcloud 애플리케이션 기본 사용자 인증 정보를 사용합니다.');
  credential = applicationDefault();
  
  if (!FIREBASE_PROJECT_ID) {
    console.error('gcloud 인증 사용 시 FIREBASE_PROJECT_ID 환경 변수가 필요합니다.');
    process.exit(1);
  }
} else {
  // 기존 서비스 계정 키 방식 사용
  const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
  const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY;
  
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    console.error('Firebase 환경 변수가 설정되지 않았습니다. .env 파일을 확인해주세요.');
    process.exit(1);
  }
  
  credential = admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    // 개행 문자 처리
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  });
}

// Firebase Admin SDK 초기화
try {
  admin.initializeApp({
    credential: credential,
    projectId: FIREBASE_PROJECT_ID
  });
  
  console.log('Firebase 초기화 성공!');
} catch (error) {
  console.error('Firebase 초기화 오류:', error);
  process.exit(1);
}

// Firestore 인스턴스 가져오기
const db = admin.firestore();

module.exports = {
  admin,
  db
}; 