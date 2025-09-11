# NewBM - 대진대 버스 예약 자동화 시스템

## 📚 기술 스택
- **패키지 관리**: Yarn Berry (PnP 모드)
- **프론트엔드**: Vue 3 + JavaScript + Pinia + Quasar + PWA
- **백엔드**: Cloudflare Workers + Cron Triggers
- **데이터베이스**: Supabase (PostgreSQL + Auth)
- **호스팅**: Cloudflare Pages
- **개발 방식**: 직접 배포 & 실제 환경 테스트

## 🏗 시스템 아키텍처

### Frontend (Vue 3 + Quasar)
```
사용자 → [회원가입/로그인] → [예약 설정] → Supabase DB
         ↓ 버스 로그인 검증 ↓
```

### Backend (Cloudflare Workers)
```
Cron Trigger → Worker → 대진대 예약 사이트
(일~목 저녁)    ↓        (서버시간 동기화)
              DB 조회 → 병렬 예약 처리
```

## 📅 예약 일정 및 시간
- **예약 대상**: 월~금 버스 (주5일)
- **예약 실행**: 전날 저녁 (일~목)
- **예약 시간**: 오후 9시, 10시 (노선별)
- **Worker 실행**: 예약시간 1분 전 활성화
- **시간 동기화**: 대진대 예약 서버의 서버시간 기준

## 🗄 Supabase 데이터베이스 설계

### users 테이블
```sql
- id (uuid, PK)
- email (text, Supabase Auth 연동)
- bus_username (text, 대진대 학번)
- bus_password (text, AES 암호화)
- created_at (timestamp)
- updated_at (timestamp)
```

### reservations 테이블
```sql
- id (uuid, PK) 
- user_id (uuid, FK → users)
- route_type (text) -- 'route_9pm' | 'route_10pm'
- day_of_week (int) -- 1:월, 2:화, 3:수, 4:목, 5:금
- is_active (boolean)
- created_at (timestamp)
```

### reservation_logs 테이블
```sql
- id (uuid, PK)
- user_id (uuid, FK → users)
- execution_time (timestamp)
- status ('pending' | 'success' | 'failed')
- error_message (text, nullable)
- reservation_details (jsonb)
```

## 🔐 인증 및 보안

### 사용자 인증
- **Supabase Auth** 사용
- 이메일 제한 시: `{학번}@dj.bus` 형태로 솔트 추가
- **회원가입 플로우**:
  1. 대진대 로그인 정보 입력
  2. "로그인 확인" 버튼으로 실제 버스 예약 사이트 로그인 검증
  3. 성공 시에만 회원가입 완료

### 비밀번호 처리
```javascript
// 저장: AES-256-GCM 암호화
const encryptedPassword = encrypt(plainPassword, ENCRYPTION_KEY)

// Worker에서 사용: 복호화
const plainPassword = decrypt(encryptedPassword, ENCRYPTION_KEY)
```

## ⚡ Cloudflare Workers 설계

### Cron 스케줄링
```javascript
// wrangler.toml
[triggers]
crons = [
  "59 20 * * 0,1,2,3,4",  # 일~목 20:59 (9시 예약용)
  "59 21 * * 0,1,2,3,4"   # 일~목 21:59 (10시 예약용)
]
```

### 병렬 처리 로직
```javascript
export default {
  async scheduled(event, env, ctx) {
    // 1. 서버 시간 동기화
    const serverTime = await getServerTime()
    
    // 2. 활성 예약 조회
    const reservations = await getActiveReservations()
    
    // 3. 병렬 처리 (Promise.allSettled)
    const results = await Promise.allSettled(
      reservations.map(reservation => 
        processReservation(reservation)
      )
    )
    
    // 4. 결과 로깅
    await logResults(results)
  }
}
```

### 시간 동기화 전략
```javascript
async function getServerTime() {
  // 대진대 예약 서버에서 현재 시간 추출
  const response = await fetch(BUS_RESERVATION_URL)
  const serverTime = extractTimeFromResponse(response)
  
  // 정확한 시간까지 대기
  const waitTime = calculateWaitTime(serverTime, targetTime)
  await sleep(waitTime)
}
```

## 🚀 개발 및 배포 전략

### 개발 환경
```bash
# 1. 프로젝트 초기화
yarn set version berry
yarn config set nodeLinker pnp

# 2. 개발 도구 설치
yarn add vue quasar @quasar/cli pinia
yarn add @supabase/supabase-js
yarn add wrangler

# 3. 바로 배포
wrangler deploy
```

### 배포 플로우
1. **Frontend**: Cloudflare Pages (GitHub 연동 자동 배포)
2. **Workers**: `wrangler deploy` 직접 배포
3. **테스트**: 실제 환경에서 바로 확인
4. **모니터링**: Worker 로그 + Supabase Dashboard

## 📱 PWA 구성
- **Service Worker**: 오프라인 지원
- **Push Notification**: 예약 결과 알림
- **App Manifest**: 홈 화면 설치 가능

## 🎯 핵심 기능 우선순위

### Phase 1 (MVP)
1. ✅ 사용자 회원가입/로그인
2. ✅ 예약 설정 입력
3. ✅ Worker 예약 실행
4. ✅ 결과 확인 대시보드

### Phase 2 (개선)
1. 🔄 PWA 기능 추가
2. 🔄 Push 알림
3. 🔄 상세 로그 및 통계

### Phase 3 (고도화)
1. ⏳ 다중 노선 지원 확장
2. ⏳ 실시간 모니터링
3. ⏳ 사용자 피드백 시스템