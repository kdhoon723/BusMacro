/**
 * Firestore 데이터 업로더 - 수집된 버스 데이터를 Firestore에 업로드
 */
require('dotenv').config();
const { collectBusData, convertToFirebaseFormat } = require('./data-collector');
const fs = require('fs').promises;
const path = require('path');

// Firebase Admin SDK
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
    
    if (!serviceAccountPath) {
      console.error('❌ Firebase 설정이 없습니다. .env 파일에 다음을 설정하세요:');
      console.error('FIREBASE_SERVICE_ACCOUNT_PATH=path/to/serviceAccountKey.json');
      return null;
    }
    
    const serviceAccount = require(serviceAccountPath);
    
    // Firebase Admin 초기화 (이미 초기화된 경우 건너뛰기)
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    
    console.log('✅ Firebase 초기화 완료');
    return admin.firestore();
    
  } catch (error) {
    console.error('❌ Firebase 초기화 실패:', error.message);
    return null;
  }
}

/**
 * undefined 값을 제거하는 함수
 */
function removeUndefinedValues(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedValues).filter(item => item !== undefined);
  }
  
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = removeUndefinedValues(value);
    }
  }
  return cleaned;
}

/**
 * Firestore 형식으로 데이터 변환
 */
function convertToFirestoreFormat(data) {
  const firestoreData = {
    metadata: {
      lastUpdated: admin.firestore.Timestamp.fromDate(new Date(data.collectedAt)),
      version: '1.0.0',
      totalRoutes: data.upRoutes.length + data.downRoutes.length,
      upRoutesCount: data.upRoutes.length,
      downRoutesCount: data.downRoutes.length
    },
    routes: [],
    timetables: [],
    stops: []
  };
  
  // 등교 노선 처리
  data.upRoutes.forEach(route => {
    // 노선 정보
    firestoreData.routes.push({
      id: `up_${route.seq}`,
      seq: route.seq,
      lineName: route.lineName || '',
      busCnt: parseInt(route.busCnt) || 0,
      direction: 'UP',
      stopSeqs: route.stops ? route.stops.map(stop => stop.seq) : [],
      timetableCount: route.timetables ? route.timetables.length : 0,
      stopCount: route.stops ? route.stops.length : 0,
      seatInfo: route.seatInfo || null
    });
    
    // 시간표 데이터
    if (route.timetables) {
      route.timetables.forEach(timetable => {
        firestoreData.timetables.push({
          id: timetable.busSeq ? timetable.busSeq.toString() : `unknown_${Date.now()}`,
          busSeq: timetable.busSeq || 0,
          carNum: timetable.carNum || '',
          operateDate: timetable.operateDate || '',
          operateWeek: timetable.operateWeek || '',
          operateTime: timetable.operateTime || '',
          fullOperateTime: timetable.fullOperateTime || '',
          seatCount: timetable.seatCount || 0,
          seatNumbering: timetable.seatNumbering || '',
          appCount: timetable.appCount || 0,
          readyCount: timetable.readyCount || 0,
          routeSeq: route.seq,
          direction: 'UP',
          routeName: route.lineName || ''
        });
      });
    }
    
    // 정류장 데이터
    if (route.stops) {
      route.stops.forEach(stop => {
        // 중복 방지를 위해 이미 추가된 정류장인지 확인
        const existingStop = firestoreData.stops.find(s => s.seq === stop.seq);
        if (!existingStop) {
          firestoreData.stops.push({
            id: stop.seq ? stop.seq.toString() : `unknown_${Date.now()}`,
            seq: stop.seq || 0,
            stopName: stop.stopName || '',
            memo: stop.memo || '',
            cost: stop.cost || 0,
            routes: [route.seq] // 이 정류장을 사용하는 노선들
          });
        } else {
          // 이미 존재하는 정류장에 노선 추가
          if (!existingStop.routes.includes(route.seq)) {
            existingStop.routes.push(route.seq);
          }
        }
      });
    }
  });
  
  // 하교 노선 처리
  data.downRoutes.forEach(route => {
    // 노선 정보
    firestoreData.routes.push({
      id: `down_${route.seq}`,
      seq: route.seq,
      lineName: route.lineName || '',
      busCnt: parseInt(route.busCnt) || 0,
      direction: 'DOWN',
      stopSeqs: route.stops ? route.stops.map(stop => stop.seq) : [],
      timetableCount: route.timetables ? route.timetables.length : 0,
      stopCount: route.stops ? route.stops.length : 0,
      seatInfo: route.seatInfo || null
    });
    
    // 시간표 데이터
    if (route.timetables) {
      route.timetables.forEach(timetable => {
        firestoreData.timetables.push({
          id: timetable.busSeq ? timetable.busSeq.toString() : `unknown_${Date.now()}`,
          busSeq: timetable.busSeq || 0,
          carNum: timetable.carNum || '',
          operateDate: timetable.operateDate || '',
          operateWeek: timetable.operateWeek || '',
          operateTime: timetable.operateTime || '',
          fullOperateTime: timetable.fullOperateTime || '',
          seatCount: timetable.seatCount || 0,
          seatNumbering: timetable.seatNumbering || '',
          appCount: timetable.appCount || 0,
          readyCount: timetable.readyCount || 0,
          routeSeq: route.seq,
          direction: 'DOWN',
          routeName: route.lineName || ''
        });
      });
    }
    
    // 정류장 데이터
    if (route.stops) {
      route.stops.forEach(stop => {
        // 중복 방지를 위해 이미 추가된 정류장인지 확인
        const existingStop = firestoreData.stops.find(s => s.seq === stop.seq);
        if (!existingStop) {
          firestoreData.stops.push({
            id: stop.seq ? stop.seq.toString() : `unknown_${Date.now()}`,
            seq: stop.seq || 0,
            stopName: stop.stopName || '',
            memo: stop.memo || '',
            cost: stop.cost || 0,
            routes: [route.seq]
          });
        } else {
          // 이미 존재하는 정류장에 노선 추가
          if (!existingStop.routes.includes(route.seq)) {
            existingStop.routes.push(route.seq);
          }
        }
      });
    }
  });
  
  // undefined 값 제거
  return removeUndefinedValues(firestoreData);
}

/**
 * 데이터를 Firestore에 업로드
 */
async function uploadToFirestore(data) {
  const db = initializeFirebase();
  if (!db) {
    return false;
  }
  
  try {
    console.log('🔄 Firestore에 데이터 업로드 중...');
    
    const firestoreData = convertToFirestoreFormat(data);
    
    // 배치 작업으로 업로드
    const batch = db.batch();
    
    // 메타데이터 업로드
    console.log('  📋 메타데이터 업로드...');
    const metadataRef = db.collection('busData').doc('metadata');
    batch.set(metadataRef, firestoreData.metadata);
    
    // 노선 데이터 업로드
    console.log(`  🚌 노선 데이터 ${firestoreData.routes.length}개 업로드...`);
    firestoreData.routes.forEach(route => {
      const routeRef = db.collection('busData').doc('routes').collection('items').doc(route.id);
      batch.set(routeRef, route);
    });
    
    // 시간표 데이터 업로드 (배치 제한으로 인해 청크 단위로 처리)
    console.log(`  📅 시간표 데이터 ${firestoreData.timetables.length}개 업로드...`);
    
    // 정류장 데이터 업로드
    console.log(`  🚏 정류장 데이터 ${firestoreData.stops.length}개 업로드...`);
    firestoreData.stops.forEach(stop => {
      const stopRef = db.collection('busData').doc('stops').collection('items').doc(stop.id);
      batch.set(stopRef, stop);
    });
    
    // 배치 커밋 (Firestore 배치는 최대 500개 작업 제한)
    await batch.commit();
    
    // 시간표는 별도로 처리 (대용량 데이터)
    await uploadTimetablesBatch(db, firestoreData.timetables);
    
    console.log('✅ Firestore 업로드 완료');
    return true;
    
  } catch (error) {
    console.error('❌ Firestore 업로드 실패:', error.message);
    return false;
  }
}

/**
 * 시간표 데이터를 배치로 업로드
 */
async function uploadTimetablesBatch(db, timetables) {
  const chunkSize = 450; // Firestore 배치 제한 (500) 보다 작게 설정
  
  for (let i = 0; i < timetables.length; i += chunkSize) {
    const chunk = timetables.slice(i, i + chunkSize);
    const batch = db.batch();
    
    console.log(`    📊 시간표 청크 ${Math.floor(i/chunkSize) + 1}/${Math.ceil(timetables.length/chunkSize)} 업로드... (${chunk.length}개)`);
    
    chunk.forEach(timetable => {
      const timetableRef = db.collection('busData').doc('timetables').collection('items').doc(timetable.id);
      batch.set(timetableRef, timetable);
    });
    
    await batch.commit();
    
    // 잠시 대기 (Firestore 제한 방지)
    if (i + chunkSize < timetables.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

/**
 * 기존 Firestore 데이터 조회
 */
async function getFirestoreData() {
  const db = initializeFirebase();
  if (!db) {
    return null;
  }
  
  try {
    console.log('📥 Firestore에서 기존 데이터 조회 중...');
    
    // 메타데이터 조회
    const metadataDoc = await db.collection('busData').doc('metadata').get();
    
    if (metadataDoc.exists) {
      const metadata = metadataDoc.data();
      console.log('✅ 기존 데이터 조회 완료');
      console.log(`  - 마지막 업데이트: ${metadata.lastUpdated?.toDate?.() || '알 수 없음'}`);
      console.log(`  - 버전: ${metadata.version || '알 수 없음'}`);
      console.log(`  - 총 노선 수: ${metadata.totalRoutes || 0}개`);
      console.log(`  - 등교 노선: ${metadata.upRoutesCount || 0}개`);
      console.log(`  - 하교 노선: ${metadata.downRoutesCount || 0}개`);
      
      // 컬렉션 크기 조회
      const routesSnapshot = await db.collection('busData').doc('routes').collection('items').get();
      const timetablesSnapshot = await db.collection('busData').doc('timetables').collection('items').get();
      const stopsSnapshot = await db.collection('busData').doc('stops').collection('items').get();
      
      console.log(`  - 저장된 노선: ${routesSnapshot.size}개`);
      console.log(`  - 저장된 시간표: ${timetablesSnapshot.size}개`);
      console.log(`  - 저장된 정류장: ${stopsSnapshot.size}개`);
      
      return {
        metadata,
        routesCount: routesSnapshot.size,
        timetablesCount: timetablesSnapshot.size,
        stopsCount: stopsSnapshot.size
      };
    } else {
      console.log('📭 Firestore에 기존 데이터가 없습니다.');
      return null;
    }
    
  } catch (error) {
    console.error('❌ Firestore 데이터 조회 실패:', error.message);
    return null;
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('🚀 Firestore 업로더 시작...\n');
  
  const args = process.argv.slice(2);
  const options = {
    collectNew: !args.includes('--no-collect'),
    uploadToFirestore: !args.includes('--no-upload'),
    showExisting: args.includes('--show-existing')
  };
  
  console.log('설정:', options);
  console.log('');
  
  // 기존 데이터 조회
  if (options.showExisting) {
    await getFirestoreData();
    console.log('');
  }
  
  let dataToUpload = null;
  
  // 새 데이터 수집
  if (options.collectNew) {
    console.log('🔍 새로운 데이터 수집 중...');
    const rawData = await collectBusData();
    
    if (rawData) {
      dataToUpload = rawData;
      console.log('✅ 데이터 수집 완료\n');
    } else {
      console.error('❌ 데이터 수집 실패\n');
      return;
    }
  } else {
    // 최신 파일에서 데이터 로드
    try {
      const dataDir = path.join(__dirname, '../../data');
      const files = await fs.readdir(dataDir);
      const dataFiles = files.filter(f => f.startsWith('bus-data-') && f.endsWith('.json'));
      
      if (dataFiles.length === 0) {
        console.error('❌ 업로드할 데이터 파일이 없습니다. --no-collect 옵션을 제거하거나 먼저 데이터를 수집하세요.');
        return;
      }
      
      // 가장 최신 파일 선택
      dataFiles.sort().reverse();
      const latestFile = dataFiles[0];
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
  
  // Firestore에 업로드
  if (options.uploadToFirestore && dataToUpload) {
    const uploadSuccess = await uploadToFirestore(dataToUpload);
    
    if (uploadSuccess) {
      console.log('\n🎉 모든 작업이 완료되었습니다!');
      console.log('\n📱 Firestore 데이터 구조:');
      console.log('  - busData/metadata: 메타데이터');
      console.log('  - busData/routes/items/{routeId}: 노선 정보');
      console.log('  - busData/timetables/items/{busSeq}: 시간표 정보');
      console.log('  - busData/stops/items/{stopSeq}: 정류장 정보');
    } else {
      console.log('\n❌ 업로드 중 오류가 발생했습니다.');
    }
  } else if (!options.uploadToFirestore) {
    console.log('⏭️ Firestore 업로드를 건너뜁니다.');
  }
}

// 도움말 출력
function showHelp() {
  console.log(`
🚌 Firestore 업로더 사용법:

기본 사용법:
  node src/test/firestore-uploader.js

옵션:
  --no-collect      새 데이터 수집 건너뛰기 (기존 파일 사용)
  --no-upload       Firestore 업로드 건너뛰기
  --show-existing   기존 Firestore 데이터 조회
  --help            이 도움말 표시

환경변수 설정 (.env 파일):
  FIREBASE_SERVICE_ACCOUNT_PATH=path/to/serviceAccountKey.json
  TEST_ID=your_test_id
  TEST_PASSWORD=your_test_password

예시:
  node src/test/firestore-uploader.js                    # 전체 실행
  node src/test/firestore-uploader.js --no-collect      # 기존 데이터만 업로드
  node src/test/firestore-uploader.js --show-existing   # 기존 데이터 조회
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
  uploadToFirestore, 
  getFirestoreData, 
  convertToFirestoreFormat,
  initializeFirebase 
}; 