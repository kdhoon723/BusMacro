# 대진대 버스 예약 자동화 API 🚌

대진대학교 버스 예약을 자동화하는 Node.js API 서비스입니다. 등교/하교 노선을 선택할 수 있으며, **동시에 두 방향 예약도 가능**합니다.

## 🚀 주요 기능

- ✅ **등교/하교 노선 선택**: UP(등교), DOWN(하교) 방향 모두 지원
- 🔥 **동시 예약 지원**: 등교와 하교를 동시에 예약 가능
- ⏰ **정밀한 시간 제어**: 밀리초 단위의 정확한 시간에 예약 실행
- 🔄 **자동 좌석 선택**: 선호 좌석이 예약된 경우 자동으로 다른 좌석 선택
- 📋 **상세한 로깅**: 실시간 진행 상황과 디버그 정보 제공
- 🧪 **테스트 모드**: 실제 예약 없이 테스트 가능
- ⚙️ **유연한 설정**: 환경변수를 통한 상세한 커스터마이징

## 📦 설치 및 설정

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경변수 설정
`.env` 파일을 생성하고 다음 정보를 설정하세요:

#### 기본 설정
```env
# 로그인 정보
TEST_ID=your_student_id
TEST_PASSWORD=your_password
USER_ID=your_student_id
USER_PASSWORD=your_password

# 테스트 모드
TEST_MODE=true
```

#### 🔥 동시 예약 설정 (추천!)
```env
# 동시 예약 활성화
DUAL_RESERVATION=true

# 등교 설정
UP_ROUTE=장기/대화               # 등교 노선 (예: 장기/대화, 성남, 수원)
UP_TIME=07:50                   # 등교 버스 시간
UP_SEAT_NO=11                   # 등교 좌석 번호

# 하교 설정  
DOWN_ROUTE=노원                 # 하교 노선 (예: 노원, 성남, 수원)
DOWN_TIME=15:30                 # 하교 버스 시간
DOWN_SEAT_NO=11                 # 하교 좌석 번호
```

#### 단일 예약 설정 (기존 방식)
```env
BUS_ROUTE=장기/대화              # 노선 이름
BUS_TIME=07:50                  # 버스 시간
BUS_DIRECTION=UP                # UP: 등교, DOWN: 하교
SEAT_NO=11                      # 좌석 번호
```

## 🎮 사용법

### 🔥 NEW! 동시 예약 테스트
```bash
# 등교/하교 동시 예약 테스트 (현재 시간 + 10초 후 실행)
npm run test:dual

# 도움말 보기
npm run test:dual -- --help

# 특정 시간에 등교/하교 동시 예약 테스트
npm run test:dual -- --start-time=21:00:00 --test

# 등교만 테스트
npm run test:dual -- --start-time=08:00:00 --no-down --test

# 하교만 테스트
npm run test:dual -- --start-time=21:00:00 --no-up --test
```

### 기본 테스트
```bash
# 기본 테스트 (현재 시간 + 10초 후 실행)
npm run test:enhanced

# 도움말 보기
npm run test:enhanced -- --help
```

### 향상된 테스트 옵션

#### 하교 노선 테스트
```bash
# 특정 시간에 하교 버스 예약 테스트
npm run test:enhanced -- --start-time=21:00:00 --direction=DOWN --route=노원 --bus-time=15:30 --test

# 실제 예약 (테스트 모드 제거)
npm run test:enhanced -- --start-time=21:00:00 --direction=DOWN --route=노원 --bus-time=15:30
```

#### 등교 노선 테스트
```bash
# 등교 버스 예약 테스트
npm run test:enhanced -- --start-time=08:30:00 --direction=UP --route=성남 --bus-time=07:30 --test

# 등교 버스 실제 예약
npm run test:enhanced -- --start-time=08:30:00 --direction=UP --route=성남 --bus-time=07:30
```

### 기존 테스트 명령어

```bash
# 로그인 테스트
npm run test:login

# 예약 기능 테스트
npm run test:reserve

# 기본 시간 테스트
npm run test:time
```

## ⚙️ 환경변수 설명

### 필수 설정
- `TEST_ID`, `TEST_PASSWORD`: 테스트용 로그인 정보
- `USER_ID`, `USER_PASSWORD`: 운영용 로그인 정보

### 🔥 동시 예약 설정
- `DUAL_RESERVATION`: 동시 예약 모드 활성화 (`true`/`false`)

#### 등교 설정
- `UP_ROUTE`: 등교 노선 이름 (예: 장기/대화, 성남, 수원)
- `UP_TIME`: 등교 버스 시간 (HH:MM 형식)
- `UP_SEAT_NO`: 등교 좌석 번호 (1-45)

#### 하교 설정
- `DOWN_ROUTE`: 하교 노선 이름 (예: 노원, 성남, 수원)
- `DOWN_TIME`: 하교 버스 시간 (HH:MM 형식)
- `DOWN_SEAT_NO`: 하교 좌석 번호 (1-45)

### 단일 예약 설정
- `BUS_ROUTE`: 노선 이름
- `BUS_TIME`: 원하는 버스 시간
- `BUS_DIRECTION`: `UP`(등교) 또는 `DOWN`(하교)
- `SEAT_NO`: 좌석 번호

### 테스트 설정
- `TEST_MODE`: 테스트 모드 활성화 (`true`/`false`)

## 🚀 운영 모드

### 서비스 시작
```bash
# 개발 모드 (nodemon)
npm run dev

# 운영 모드
npm start
```

### PM2로 백그라운드 실행
```bash
# PM2 설치
npm install -g pm2

# 서비스 시작
pm2 start src/index.js --name "bus-reservation"

# 로그 확인
pm2 logs bus-reservation

# 서비스 중지
pm2 stop bus-reservation
```

## 📋 명령어 옵션

### 🔥 dual-reservation-test.js 옵션 (신기능!)

```bash
--start-time=HH:MM:SS    # 예약 시도할 정확한 시간
--no-up                  # 등교 예약 비활성화
--no-down                # 하교 예약 비활성화
--test                   # 테스트 모드 (실제 예약 안함)
--help, -h              # 도움말 출력
```

### enhanced-time-test.js 옵션

```bash
--start-time=HH:MM:SS    # 예약 시도할 정확한 시간
--direction=UP|DOWN      # 노선 방향 (UP: 등교, DOWN: 하교)
--route=노선명           # 예약할 노선
--bus-time=HH:MM         # 예약할 버스 시간
--seat-no=숫자           # 선호 좌석 번호
--test                   # 테스트 모드 (실제 예약 안함)
--help, -h              # 도움말 출력
```

## 🎯 실전 사용 예시

### 🔥 등교/하교 동시 예약 (추천!)
```bash
# .env 설정
DUAL_RESERVATION=true
UP_ROUTE=장기/대화
UP_TIME=07:50
UP_SEAT_NO=11

DOWN_ROUTE=노원
DOWN_TIME=15:30
DOWN_SEAT_NO=11

# 테스트
npm run test:dual -- --start-time=21:00:00 --test
```

### 등교 버스만 예약
```bash
# .env 설정
BUS_DIRECTION=UP
BUS_ROUTE=장기/대화
BUS_TIME=07:50
SEAT_NO=11

# 테스트
npm run test:enhanced -- --start-time=08:00:00 --direction=UP --route=장기/대화 --bus-time=07:50 --test
```

### 하교 버스만 예약
```bash
# .env 설정
BUS_DIRECTION=DOWN
BUS_ROUTE=노원
BUS_TIME=15:30
SEAT_NO=11

# 테스트
npm run test:enhanced -- --start-time=21:00:00 --direction=DOWN --route=노원 --bus-time=15:30 --test
```

## 🔍 동시 예약 처리 시간 측정

동시 예약 테스트 시 다음과 같은 정보가 출력됩니다:

```
📊 === 예약 결과 요약 ===
✅ 등교: 예약 성공! 예약번호: 12345 (1247ms)
✅ 하교: 예약 성공! 예약번호: 12346 (1189ms)

📈 성공: 2개, 실패: 0개
⏱️  전체 처리 시간: 1250ms
🔄 최대 개별 처리 시간: 1247ms
```

## 🔧 문제 해결

### 로그인 실패
- 학번과 비밀번호를 다시 확인하세요
- 대진대 포털 사이트에서 직접 로그인이 되는지 확인하세요

### 노선을 찾을 수 없음
- 테스트 명령어로 사용 가능한 노선 목록을 확인하세요
- 노선 이름이 정확한지 확인하세요 (부분 문자열로 매칭됨)

### 시간을 찾을 수 없음
- 해당 노선의 운행 시간표를 확인하세요
- 등교/하교 방향이 올바른지 확인하세요

### 동시 예약 실패
- 각각의 환경변수 설정을 확인하세요 (`UP_*`, `DOWN_*`)
- 테스트 모드에서 먼저 검증해보세요

## 🎉 새로운 기능들

### ✨ 동시 예약의 장점
1. **시간 절약**: 등교/하교를 따로 예약할 필요 없음
2. **정확성**: 동시에 처리되어 타이밍 이슈 방지
3. **편의성**: 한 번의 설정으로 모든 예약 자동화
4. **모니터링**: 각각의 처리 시간과 결과를 별도로 확인 가능

### 🔧 유연한 설정
- 등교만 또는 하교만 선택적으로 비활성화 가능
- 각각 다른 크론 스케줄로 운영 가능
- 서로 다른 노선, 시간, 좌석 설정 가능

## 🗄️ 데이터 수집 및 Firebase 연동

### 📊 버스 데이터 수집

모든 노선, 시간표, 정류장 정보를 자동으로 수집하여 JSON 파일로 저장합니다.

```bash
# 데이터 수집 실행
npm run collect:data
```

수집되는 정보:
- **등교/하교 노선**: 모든 노선의 기본 정보
- **시간표**: 각 노선별 운행 시간과 버스 정보
- **정류장**: 노선별 정류장 목록과 요금 정보
- **좌석 정보**: 버스별 좌석 배치와 예약 현황 (샘플)

### 🔥 Firebase 연동

수집된 데이터를 Firebase에 업로드하여 웹/앱에서 활용할 수 있습니다. **Firestore (권장)** 또는 Realtime Database를 선택할 수 있습니다.

#### Firebase 설정

1. **Firebase Admin SDK 설치**
```bash
npm install firebase-admin
```

2. **환경변수 설정** (.env 파일)
```bash
# Firebase 설정 (Firestore 사용 시 - 권장)
FIREBASE_SERVICE_ACCOUNT_PATH=./djbusmacro-firebase-adminsdk-fbsvc-c0fa9208a3.json

# Firebase 설정 (Realtime Database 사용 시)
FIREBASE_SERVICE_ACCOUNT_PATH=./djbusmacro-firebase-adminsdk-fbsvc-c0fa9208a3.json
FIREBASE_DATABASE_URL=https://djbusmacro-default-rtdb.firebaseio.com/

# 기존 로그인 정보
TEST_ID=your_student_id
TEST_PASSWORD=your_password
```

3. **Firebase 서비스 계정 키 생성**
   - Firebase Console → 프로젝트 설정 → 서비스 계정
   - "새 비공개 키 생성" 클릭
   - 다운로드한 JSON 파일을 프로젝트에 저장

#### Firebase 업로드 명령어

**🔥 Firestore 사용 (권장)**
```bash
# 데이터 수집 + Firestore 업로드
npm run upload:firestore

# 기존 데이터만 업로드 (수집 건너뛰기)
npm run upload:firestore -- --no-collect

# 기존 Firestore 데이터 조회
npm run upload:firestore -- --show-existing --no-upload

# 도움말
npm run upload:firestore -- --help
```

**Realtime Database 사용**
```bash
# 데이터 수집 + Firebase 업로드 (전체)
npm run upload:firebase

# 배치 업로드 (대용량 데이터용)
npm run sync:firebase

# 기존 데이터만 업로드 (수집 건너뛰기)
npm run upload:firebase -- --no-collect

# 기존 Firebase 데이터 조회
npm run upload:firebase -- --show-existing --no-upload
```

#### 🔥 Firestore 데이터 구조 (권장)

```
busData/
├── metadata (document)
│   ├── lastUpdated: Timestamp
│   ├── version: "1.0.0"
│   ├── totalRoutes: 36
│   ├── upRoutesCount: 18
│   └── downRoutesCount: 18
├── routes/
│   └── items/ (collection)
│       ├── up_38 (document)
│       │   ├── seq: 38
│       │   ├── lineName: "[등교]장기/대화"
│       │   ├── direction: "UP"
│       │   ├── stopSeqs: [104, 105]
│       │   └── timetableCount: 1
│       └── down_45 (document)
│           ├── seq: 45
│           ├── lineName: "[하교]노원"
│           └── direction: "DOWN"
├── timetables/
│   └── items/ (collection)
│       └── 134336 (document)
│           ├── busSeq: 134336
│           ├── operateTime: "07:40"
│           ├── routeSeq: 38
│           ├── direction: "UP"
│           └── routeName: "[등교]장기/대화"
└── stops/
    └── items/ (collection)
        └── 104 (document)
            ├── seq: 104
            ├── stopName: "1)장기역"
            ├── cost: 4000
            └── routes: [38]
```

#### Realtime Database 데이터 구조

```json
{
  "busData": {
    "metadata": {
      "lastUpdated": "2024-05-26T12:00:00.000Z",
      "version": "1.0.0"
    },
    "routes": {
      "up_38": {
        "seq": 38,
        "lineName": "[등교]장기/대화",
        "busCnt": "1",
        "direction": "UP",
        "stopSeqs": [104, 105]
      }
    },
    "timetables": {
      "134336": {
        "busSeq": 134336,
        "carNum": 6216,
        "operateTime": "07:40",
        "seatCount": 44,
        "routeSeq": 38,
        "direction": "UP"
      }
    },
    "stops": {
      "104": {
        "seq": 104,
        "stopName": "1)장기역",
        "cost": 4000
      }
    }
  }
}
```

### 🎯 활용 예시

#### 🔥 웹 앱에서 Firestore 데이터 사용 (권장)

```javascript
// Firebase 초기화
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 등교 노선 목록 가져오기
const upRoutesQuery = query(
  collection(db, 'busData/routes/items'),
  where('direction', '==', 'UP')
);

onSnapshot(upRoutesQuery, (snapshot) => {
  const upRoutes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log('등교 노선:', upRoutes);
});

// 특정 노선의 시간표 가져오기
const routeTimetablesQuery = query(
  collection(db, 'busData/timetables/items'),
  where('routeSeq', '==', 38)
);

onSnapshot(routeTimetablesQuery, (snapshot) => {
  const timetables = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log('장기/대화 노선 시간표:', timetables);
});

// 메타데이터 가져오기
const metadataRef = doc(db, 'busData', 'metadata');
getDoc(metadataRef).then((doc) => {
  if (doc.exists()) {
    console.log('메타데이터:', doc.data());
  }
});
```

#### Realtime Database 사용

```javascript
// Firebase 초기화
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// 등교 노선 목록 가져오기
const upRoutesRef = ref(database, 'busData/routes');
onValue(upRoutesRef, (snapshot) => {
  const routes = snapshot.val();
  const upRoutes = Object.values(routes).filter(route => route.direction === 'UP');
  console.log('등교 노선:', upRoutes);
});

// 특정 노선의 시간표 가져오기
const timetablesRef = ref(database, 'busData/timetables');
onValue(timetablesRef, (snapshot) => {
  const timetables = snapshot.val();
  const routeTimetables = Object.values(timetables).filter(t => t.routeSeq === 38);
  console.log('장기/대화 노선 시간표:', routeTimetables);
});
```

#### 🔥 React 컴포넌트 예시 (Firestore)

```jsx
import { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore';

function BusRouteSelector() {
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [timetables, setTimetables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirestore();
    
    // 노선 목록 로드
    const routesQuery = query(collection(db, 'busData/routes/items'));
    const unsubscribeRoutes = onSnapshot(routesQuery, (snapshot) => {
      const routesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRoutes(routesData);
      setLoading(false);
    });
    
    return () => {
      unsubscribeRoutes();
    };
  }, []);

  useEffect(() => {
    if (!selectedRoute) {
      setTimetables([]);
      return;
    }

    const db = getFirestore();
    
    // 선택된 노선의 시간표 로드
    const timetablesQuery = query(
      collection(db, 'busData/timetables/items'),
      where('routeSeq', '==', selectedRoute.seq)
    );
    
    const unsubscribeTimetables = onSnapshot(timetablesQuery, (snapshot) => {
      const timetablesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // 시간순 정렬
      timetablesData.sort((a, b) => a.operateTime.localeCompare(b.operateTime));
      setTimetables(timetablesData);
    });

    return () => {
      unsubscribeTimetables();
    };
  }, [selectedRoute]);

  if (loading) {
    return <div>로딩 중...</div>;
  }

  return (
    <div className="bus-route-selector">
      <div className="route-selection">
        <label htmlFor="route-select">노선 선택:</label>
        <select 
          id="route-select"
          onChange={(e) => {
            const route = routes.find(r => r.id === e.target.value);
            setSelectedRoute(route || null);
          }}
          value={selectedRoute?.id || ''}
        >
          <option value="">-- 노선을 선택하세요 --</option>
          {routes.map((route) => (
            <option key={route.id} value={route.id}>
              {route.lineName} ({route.direction === 'UP' ? '등교' : '하교'})
            </option>
          ))}
        </select>
      </div>
      
      {selectedRoute && (
        <div className="route-info">
          <h3>{selectedRoute.lineName}</h3>
          <p>방향: {selectedRoute.direction === 'UP' ? '등교' : '하교'}</p>
          <p>버스 수: {selectedRoute.busCnt}대</p>
        </div>
      )}
      
      {timetables.length > 0 && (
        <div className="timetables">
          <h4>운행 시간표</h4>
          <div className="timetable-grid">
            {timetables.map(timetable => (
              <div key={timetable.id} className="timetable-item">
                <div className="time">{timetable.operateTime}</div>
                <div className="seats">{timetable.seatCount}석</div>
                <div className="status">
                  예약: {timetable.appCount}/{timetable.seatCount}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default BusRouteSelector;
```

### 📈 데이터 업데이트 자동화

크론 작업으로 정기적으로 데이터를 업데이트할 수 있습니다:

```bash
# 매일 새벽 3시에 데이터 수집 및 Firebase 업데이트
0 3 * * * cd /path/to/project && npm run sync:firebase
```

### 🔧 고급 옵션

#### 배치 업로드 옵션
- `--batch`: 대용량 데이터를 청크 단위로 나누어 업로드
- `--no-collect`: 기존 수집된 파일만 사용
- `--no-upload`: 수집만 하고 Firebase 업로드 건너뛰기
- `--show-existing`: 현재 Firebase에 저장된 데이터 정보 조회

#### 데이터 파일 위치
- 원본 데이터: `data/bus-data-YYYY-MM-DDTHH-MM-SS.json`
- Firebase 형식: `data/firebase-data-YYYY-MM-DDTHH-MM-SS.json`

## 🖥️ 프론트엔드와 실시간 데이터 연동

### 주간 버스 예약 관리 페이지 업데이트

프론트엔드의 주간 버스 예약 관리 페이지가 이제 Firestore에서 실시간 버스 데이터를 자동으로 로드합니다:

1. **실시간 노선 정보**: 수집된 실제 등교/하교 노선 목록이 자동으로 표시됩니다.
2. **실시간 시간표**: 각 노선을 선택하면 해당 노선의 실제 운행 시간과 잔여 좌석 정보가 표시됩니다.
3. **실시간 정류장**: 선택한 노선의 실제 정류장 목록이 자동으로 로드됩니다.

### 데이터 업데이트 프로세스

```bash
# 1. 백엔드에서 최신 버스 데이터 수집 및 Firestore 업로드
cd backend-api
npm run sync:firestore

# 2. 프론트엔드는 자동으로 업데이트된 데이터를 반영
# (페이지 새로고침 시 최신 데이터 로드)
```

### 프론트엔드 기능 개선사항

- **노선별 설명**: "24개 정류장, 59개 시간표" 형식으로 노선 정보 표시
- **시간표 좌석 정보**: "15:30 (잔여: 35/44석)" 형식으로 실시간 좌석 정보 표시
- **자동 백업**: Firestore 연결 실패 시 하드코딩된 백업 데이터 자동 사용
- **디버그 정보**: 개발 모드에서 로드된 데이터 개수 실시간 표시

### 주기적 업데이트 권장

버스 운행 정보는 수시로 변경될 수 있으므로 다음과 같이 주기적 업데이트를 권장합니다:

```bash
# cron 작업 설정 예시 (매주 일요일 새벽 3시)
0 3 * * 0 cd /path/to/backend-api && npm run sync:firestore >> /var/log/bus-data-update.log 2>&1
```

## 📞 지원

버그 신고나 기능 요청은 이슈를 통해 알려주세요.
