/**
 * Firebase 데이터 업로더 - 수집된 버스 데이터를 Firebase에 업로드
 */
require('dotenv').config();
const { collectBusData, convertToFirebaseFormat } = require('./data-collector');
const fs = require('fs').promises;
const path = require('path');

// Firebase Admin SDK (설치 필요: npm install firebase-admin)
let admin;
try {
  admin = require('firebase-admin');
} catch (error) {
  console.error('❌ Firebase Admin SDK가 설치되지 않았습니다. 다음 명령어로 설치하세요:');
  console.error('npm install firebase-admin');
  process.exit(1);
}

/**
 * Firebase 초기화
 */
function initializeFirebase() {
  try {
    // Firebase 서비스 계정 키 파일 경로 (환경변수에서 설정)
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const databaseURL = process.env.FIREBASE_DATABASE_URL;
    
    if (!serviceAccountPath || !databaseURL) {
      console.error('❌ Firebase 설정이 없습니다. .env 파일에 다음을 설정하세요:');
      console.error('FIREBASE_SERVICE_ACCOUNT_PATH=path/to/serviceAccountKey.json');
      console.error('FIREBASE_DATABASE_URL=https://your-project.firebaseio.com');
      return null;
    }
    
    const serviceAccount = require(serviceAccountPath);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: databaseURL
    });
    
    console.log('✅ Firebase 초기화 완료');
    return admin.database();
    
  } catch (error) {
    console.error('❌ Firebase 초기화 실패:', error.message);
    return null;
  }
}

/**
 * 데이터를 Firebase에 업로드
 */
async function uploadToFirebase(data) {
  const db = initializeFirebase();
  if (!db) {
    return false;
  }
  
  try {
    console.log('🔄 Firebase에 데이터 업로드 중...');
    
    // 전체 데이터를 한 번에 업로드
    await db.ref('busData').set(data);
    
    console.log('✅ Firebase 업로드 완료');
    return true;
    
  } catch (error) {
    console.error('❌ Firebase 업로드 실패:', error.message);
    return false;
  }
}

/**
 * 부분별로 데이터 업로드 (대용량 데이터용)
 */
async function uploadToFirebaseBatch(data) {
  const db = initializeFirebase();
  if (!db) {
    return false;
  }
  
  try {
    console.log('🔄 Firebase에 배치 업로드 중...');
    
    // 메타데이터 업로드
    console.log('  📋 메타데이터 업로드...');
    await db.ref('busData/metadata').set(data.metadata);
    
    // 노선 데이터 업로드
    console.log('  🚌 노선 데이터 업로드...');
    await db.ref('busData/routes').set(data.routes);
    
    // 시간표 데이터를 청크 단위로 업로드
    console.log('  📅 시간표 데이터 업로드...');
    const timetableEntries = Object.entries(data.timetables);
    const chunkSize = 50; // 한 번에 50개씩 업로드
    
    for (let i = 0; i < timetableEntries.length; i += chunkSize) {
      const chunk = timetableEntries.slice(i, i + chunkSize);
      const chunkData = Object.fromEntries(chunk);
      
      console.log(`    📊 시간표 청크 ${Math.floor(i/chunkSize) + 1}/${Math.ceil(timetableEntries.length/chunkSize)} 업로드...`);
      await db.ref('busData/timetables').update(chunkData);
      
      // 잠시 대기 (Firebase 제한 방지)
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 정류장 데이터 업로드
    console.log('  🚏 정류장 데이터 업로드...');
    await db.ref('busData/stops').set(data.stops);
    
    console.log('✅ Firebase 배치 업로드 완료');
    return true;
    
  } catch (error) {
    console.error('❌ Firebase 배치 업로드 실패:', error.message);
    return false;
  }
}

/**
 * 기존 Firebase 데이터 조회
 */
async function getFirebaseData() {
  const db = initializeFirebase();
  if (!db) {
    return null;
  }
  
  try {
    console.log('📥 Firebase에서 기존 데이터 조회 중...');
    
    const snapshot = await db.ref('busData').once('value');
    const data = snapshot.val();
    
    if (data) {
      console.log('✅ 기존 데이터 조회 완료');
      console.log(`  - 마지막 업데이트: ${data.metadata?.lastUpdated || '알 수 없음'}`);
      console.log(`  - 노선 수: ${Object.keys(data.routes || {}).length}개`);
      console.log(`  - 시간표 수: ${Object.keys(data.timetables || {}).length}개`);
      console.log(`  - 정류장 수: ${Object.keys(data.stops || {}).length}개`);
    } else {
      console.log('📭 Firebase에 기존 데이터가 없습니다.');
    }
    
    return data;
    
  } catch (error) {
    console.error('❌ Firebase 데이터 조회 실패:', error.message);
    return null;
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('🚀 Firebase 업로더 시작...\n');
  
  const args = process.argv.slice(2);
  const options = {
    collectNew: !args.includes('--no-collect'),
    uploadToFirebase: !args.includes('--no-upload'),
    useBatch: args.includes('--batch'),
    showExisting: args.includes('--show-existing')
  };
  
  console.log('설정:', options);
  console.log('');
  
  // 기존 데이터 조회
  if (options.showExisting) {
    await getFirebaseData();
    console.log('');
  }
  
  let dataToUpload = null;
  
  // 새 데이터 수집
  if (options.collectNew) {
    console.log('🔍 새로운 데이터 수집 중...');
    const rawData = await collectBusData();
    
    if (rawData) {
      dataToUpload = convertToFirebaseFormat(rawData);
      console.log('✅ 데이터 수집 및 변환 완료\n');
    } else {
      console.error('❌ 데이터 수집 실패\n');
      return;
    }
  } else {
    // 최신 파일에서 데이터 로드
    try {
      const dataDir = path.join(__dirname, '../../data');
      const files = await fs.readdir(dataDir);
      const firebaseFiles = files.filter(f => f.startsWith('firebase-data-') && f.endsWith('.json'));
      
      if (firebaseFiles.length === 0) {
        console.error('❌ 업로드할 Firebase 데이터 파일이 없습니다. --no-collect 옵션을 제거하거나 먼저 데이터를 수집하세요.');
        return;
      }
      
      // 가장 최신 파일 선택
      firebaseFiles.sort().reverse();
      const latestFile = firebaseFiles[0];
      const filePath = path.join(dataDir, latestFile);
      
      console.log(`📂 기존 데이터 파일 로드: ${latestFile}`);
      const fileContent = await fs.readFile(filePath, 'utf8');
      dataToUpload = JSON.parse(fileContent);
      console.log('✅ 데이터 로드 완료\n');
      
    } catch (error) {
      console.error('❌ 데이터 파일 로드 실패:', error.message);
      return;
    }
  }
  
  // Firebase에 업로드
  if (options.uploadToFirebase && dataToUpload) {
    const uploadSuccess = options.useBatch 
      ? await uploadToFirebaseBatch(dataToUpload)
      : await uploadToFirebase(dataToUpload);
    
    if (uploadSuccess) {
      console.log('\n🎉 모든 작업이 완료되었습니다!');
    } else {
      console.log('\n❌ 업로드 중 오류가 발생했습니다.');
    }
  } else if (!options.uploadToFirebase) {
    console.log('⏭️ Firebase 업로드를 건너뜁니다.');
  }
}

// 도움말 출력
function showHelp() {
  console.log(`
🚌 Firebase 업로더 사용법:

기본 사용법:
  node src/test/firebase-uploader.js

옵션:
  --no-collect      새 데이터 수집 건너뛰기 (기존 파일 사용)
  --no-upload       Firebase 업로드 건너뛰기
  --batch           배치 업로드 사용 (대용량 데이터용)
  --show-existing   기존 Firebase 데이터 조회
  --help            이 도움말 표시

환경변수 설정 (.env 파일):
  FIREBASE_SERVICE_ACCOUNT_PATH=path/to/serviceAccountKey.json
  FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
  TEST_ID=your_test_id
  TEST_PASSWORD=your_test_password

예시:
  node src/test/firebase-uploader.js                    # 전체 실행
  node src/test/firebase-uploader.js --batch            # 배치 업로드
  node src/test/firebase-uploader.js --no-collect      # 기존 데이터만 업로드
  node src/test/firebase-uploader.js --show-existing   # 기존 데이터 조회
`);
}

// 스크립트 실행
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    showHelp();
  } else {
    main().catch(error => {
      console.error('❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
  }
}

module.exports = { 
  uploadToFirebase, 
  uploadToFirebaseBatch, 
  getFirebaseData, 
  initializeFirebase 
}; 