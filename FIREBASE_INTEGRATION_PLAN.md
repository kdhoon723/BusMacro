# 🔥 Firebase 통합 계획서 - 대진대 버스 예약 시스템

## 📋 현재 상황 분석

### ✅ 완료된 사항
- **Firebase 프로젝트 설정 완료**
  - Hosting: `frontend/dist` 연결
  - Firestore: 규칙 및 인덱스 설정
  - Functions: 기본 템플릿 준비
- **API 기반 버스 예약 시스템 완성** (`backend-api/`)
  - 인증 서비스 (로그인/로그아웃)
  - 예약 서비스 (노선/시간표/좌석/예약)
  - 정밀한 타이밍 제어 시스템
  - 멀티 계정 지원

### 🎯 통합 목표
1. **서버리스 아키텍처**: Firebase Functions로 완전 이전
2. **데이터 영속성**: Firestore로 사용자 정보 및 예약 기록 관리
3. **자동 스케줄링**: Cloud Scheduler로 정확한 시간 실행
4. **실시간 모니터링**: 예약 성공/실패 상태 실시간 추적
5. **확장성**: 다중 사용자 동시 예약 처리

## 🚀 단계별 통합 계획

### Phase 1: Functions 환경 설정 (30분)

#### 1.1 의존성 추가
```bash
cd functions
npm install axios tough-cookie axios-cookiejar-support node-cron
```

#### 1.2 환경 변수 설정
```bash
firebase functions:config:set app.env="production"
firebase functions:config:set scheduler.timezone="Asia/Seoul"
```

#### 1.3 폴더 구조 생성
```
functions/
├── index.js (메인 엔트리포인트)
├── services/
│   ├── auth.js (인증 서비스)
│   ├── reservation.js (예약 서비스)
│   └── firestore.js (데이터베이스 서비스)
├── utils/
│   ├── request.js (HTTP 클라이언트)
│   ├── timing.js (정밀 타이밍)
│   └── logger.js (로깅 유틸)
└── triggers/
    ├── scheduled.js (스케줄 함수들)
    ├── http.js (HTTP 트리거)
    └── firestore.js (Firestore 트리거)
```

### Phase 2: 코드 이전 및 Firebase 적응 (1시간)

#### 2.1 Firestore 데이터 모델 설계
```javascript
// 사용자 컬렉션
users/{userId} {
  studentId: string,
  password: string, // 암호화된 비밀번호
  name: string,
  isActive: boolean,
  createdAt: timestamp,
  lastLogin: timestamp
}

// 예약 설정 컬렉션
reservationSettings/{userId} {
  targetRoute: string,
  targetTime: string,
  preferredSeats: array,
  autoReserve: boolean,
  notifications: {
    email: string,
    discord: string
  }
}

// 예약 기록 컬렉션
reservationLogs/{logId} {
  userId: string,
  attemptTime: timestamp,
  targetTime: string,
  route: string,
  status: string, // 'success', 'failed', 'pending'
  seatNumber: string,
  errorMessage: string,
  executionTimeMs: number
}
```

#### 2.2 서비스 코드 Firebase 적응
- **AuthService**: Firebase Admin Auth와 연동
- **ReservationService**: Firestore 데이터 연동
- **RequestUtil**: Cloud Functions 환경 최적화

#### 2.3 HTTP 트리거 함수 생성
```javascript
// 사용자 관리 API
exports.addUser = onRequest()        // 사용자 추가
exports.updateUser = onRequest()     // 사용자 정보 수정
exports.deleteUser = onRequest()     // 사용자 삭제
exports.testLogin = onRequest()      // 로그인 테스트

// 예약 관리 API
exports.setReservation = onRequest() // 예약 설정
exports.getReservationStatus = onRequest() // 상태 조회
exports.cancelReservation = onRequest()    // 예약 취소
```

### Phase 3: 스케줄링 시스템 구현 (45분)

#### 3.1 Cloud Scheduler 함수
```javascript
// 매일 20:59:00에 실행 (1분 전 로그인)
exports.preLogin = onSchedule('59 20 * * *', async (event) => {
  // 모든 활성 사용자 로그인 준비
});

// 매일 21:00:00에 실행 (정확한 예약 시도)
exports.executeReservation = onSchedule('0 21 * * *', async (event) => {
  // 정밀한 타이밍으로 예약 실행
});

// 매 30초마다 실행 (상태 모니터링)
exports.monitorReservation = onSchedule('*/30 * * * * *', async (event) => {
  // 진행중인 예약 상태 확인
});
```

#### 3.2 정밀 타이밍 시스템
```javascript
// 밀리초 단위 정확한 실행
const executeAtExactTime = (targetTime, callback) => {
  const now = new Date();
  const target = new Date(targetTime);
  const delay = target.getTime() - now.getTime();
  
  setTimeout(callback, delay);
};
```

### Phase 4: 실시간 모니터링 구현 (30분)

#### 4.1 Firestore 트리거
```javascript
// 예약 상태 변경 시 알림
exports.onReservationUpdate = onDocumentUpdated('reservationLogs/{logId}', 
  async (event) => {
    // Discord/이메일 알림 발송
  }
);

// 새 사용자 추가 시 검증
exports.onUserCreated = onDocumentCreated('users/{userId}', 
  async (event) => {
    // 로그인 테스트 자동 실행
  }
);
```

#### 4.2 실시간 대시보드 연동
- Frontend에서 Firestore 실시간 리스너 설정
- 예약 진행 상황 실시간 표시
- 성공/실패 통계 시각화

### Phase 5: 보안 및 최적화 (30분)

#### 5.1 보안 강화
```javascript
// Firestore 보안 규칙 업데이트
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}

match /reservationLogs/{logId} {
  allow read: if request.auth != null;
  allow write: if false; // 서버에서만 작성
}
```

#### 5.2 성능 최적화
- 동시 실행 제한 설정
- 메모리 및 타임아웃 최적화
- 에러 재시도 로직 구현

## 📊 배포 및 테스트 계획

### 1. 로컬 테스트 (15분)
```bash
# Firebase Emulator 실행
firebase emulators:start

# 각 함수 개별 테스트
curl -X POST http://localhost:5001/{project}/us-central1/testLogin
```

### 2. 스테이징 배포 (10분)
```bash
# Functions만 배포
firebase deploy --only functions

# 특정 함수만 배포
firebase deploy --only functions:testLogin
```

### 3. 프로덕션 배포 (10분)
```bash
# 전체 배포
firebase deploy

# Cloud Scheduler 설정 확인
gcloud scheduler jobs list
```

## ⚠️ 주의사항 및 고려사항

### 기술적 고려사항
1. **콜드 스타트**: 첫 실행 시 지연 시간 고려
2. **동시성**: 여러 사용자 동시 예약 시 API 제한
3. **타임아웃**: Cloud Functions 최대 실행 시간 (540초)
4. **비용**: 함수 실행 횟수 및 Firestore 읽기/쓰기 비용

### 운영 고려사항
1. **모니터링**: Cloud Logging 및 Monitoring 설정
2. **알림**: 실패 시 즉시 알림 시스템
3. **백업**: 중요 설정 데이터 정기 백업
4. **업데이트**: API 변경 시 빠른 대응 체계

## 🎯 성공 지표

### 기능적 지표
- [ ] 21:00:00 정확한 시간 실행 (±100ms)
- [ ] 예약 성공률 95% 이상
- [ ] 다중 사용자 동시 처리
- [ ] 실시간 상태 업데이트

### 기술적 지표
- [ ] 함수 콜드 스타트 3초 이하
- [ ] API 응답 시간 1초 이하
- [ ] 에러율 1% 이하
- [ ] 가용성 99.9% 이상

## 🚀 다음 단계

### 즉시 실행 가능한 작업
1. **functions 폴더 의존성 설치**
2. **기본 HTTP 트리거 함수 작성**
3. **Firestore 데이터 모델 생성**
4. **로컬 에뮬레이터 테스트**

### 통합 완료 후 추가 기능
1. **모바일 앱 연동** (Flutter + Firebase)
2. **다중 대학 지원** 확장
3. **AI 기반 최적 좌석 추천**
4. **카카오톡 알림 연동**

---

## 📝 체크리스트

- [ ] Phase 1: Functions 환경 설정
- [ ] Phase 2: 코드 이전 및 Firebase 적응  
- [ ] Phase 3: 스케줄링 시스템 구현
- [ ] Phase 4: 실시간 모니터링 구현
- [ ] Phase 5: 보안 및 최적화
- [ ] 로컬 테스트 완료
- [ ] 스테이징 배포 완료
- [ ] 프로덕션 배포 완료

**예상 총 소요 시간: 3-4시간**  
**필요 인력: 개발자 1명**  
**추가 비용: Firebase Blaze 플랜 (종량제)** 