import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase 설정
// 중요: 실제 환경에서는 .env 파일 등을 통해 환경 변수로 관리하세요
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "default-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "djbusmacro.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "djbusmacro",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "djbusmacro.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "default-sender-id",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "default-app-id"
};

// Firebase 설정 검증
function validateFirebaseConfig() {
  const requiredFields = ['apiKey', 'authDomain', 'projectId'];
  const missingFields = requiredFields.filter(field => 
    !firebaseConfig[field] || firebaseConfig[field].includes('default-')
  );
  
  if (missingFields.length > 0) {
    console.warn('⚠️ Firebase 설정이 완전하지 않습니다. 누락된 필드:', missingFields);
    console.warn('환경 변수를 설정하거나 .env 파일을 생성해주세요.');
  }
  
  console.log('🔥 Firebase 설정:', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    hasApiKey: !!firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('default-')
  });
}

// 설정 검증 실행
validateFirebaseConfig();

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// Auth 및 Firestore 인스턴스 내보내기
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app; 