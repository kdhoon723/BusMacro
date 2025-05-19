# 버스 예약 자동화 매크로 시스템

## 프로젝트 개요
대진대학교 통학버스 예약을 자동화하는 매크로 시스템입니다. 정해진 시간(일/월/화 21:00)에 자동으로 버스 예약을 수행하며, 진행 상황과 결과를 사용자에게 알림으로 제공합니다.

## 시스템 구성

### 백엔드 (Cloud Run)
- Puppeteer 기반 브라우저 자동화
- 예약 3분 전(20:57)부터 로그인 준비
- 21:00 정각에 예약 수행
- Firestore를 통한 프론트엔드와 통신
- Secret Manager를 이용한 인증 정보 보안 관리

### 프론트엔드 (Vue.js)
- Firebase 호스팅
- 예약 설정 관리 (노선, 시간, 좌석 설정)
- 예약 상태 및 로그 모니터링
- Firestore를 통한 데이터 동기화

## 주요 기능
1. **자동 예약 기능**
   - 일/월/화 21:00 정각 예약 자동 수행
   - 노선/시간/좌석 등 사용자 설정 기반 예약

2. **로그인 관리**
   - 예약 3분 전 사전 로그인으로 지연 최소화
   - 세션 유지 및 관리

3. **예약 설정**
   - 버스 노선 및 시간 선택
   - 선호 좌석 지정

4. **모니터링 및 알림**
   - 예약 진행 상황 실시간 확인
   - 카카오톡 알림톡을 통한 결과 통지
   - 실패 시 신속한 알림으로 수동 대응 가능

## 기술 스택
- **백엔드**: Node.js, Puppeteer, Cloud Run
- **프론트엔드**: Vue.js, Firebase 호스팅
- **데이터베이스**: Firestore
- **인증 및 보안**: Secret Manager (운영 환경), .env (개발 환경)
- **알림 시스템**: 카카오톡 알림톡 API

## 알림 시스템 (카카오톡 알림톡)
1. **구현 방법**
   - 카카오 비즈니스 계정 생성
   - 알림톡 템플릿 등록 및 승인
   - API 연동으로 알림 발송

2. **알림 내용**
   - 예약 성공: 날짜, 시간, 좌석번호, 예약 확인 번호
   - 예약 실패: 실패 사유 및 수동 예약 안내

## 개발 계획
1. **개발 환경 구성**
   - 로컬 환경에서 .env 파일로 인증 정보 관리
   - 테스트용 Firestore 데이터베이스 설정

2. **백엔드 개발**
   - Puppeteer 스크립트 작성 (로그인, 예약 과정)
   - Cloud Run 서비스 구성
   - 스케줄링 및 타이밍 관리 기능

3. **프론트엔드 개발**
   - Vue.js 프로젝트 구조 설정
   - 사용자 인터페이스 구현
   - Firestore 연동

4. **알림 시스템 구축**
   - 카카오 비즈니스 계정 및 알림톡 설정
   - 백엔드 연동 및 알림 발송 로직 구현

5. **배포 및 테스트**
   - Firebase 호스팅을 통한 프론트엔드 배포
   - Cloud Run에 백엔드 서비스 배포
   - 실제 환경에서 테스트 진행 

## 작동 프로세스

1. **초기 접속 및 로그인 (20:57분)**
   - `https://daejin.unibus.kr/#/` 도메인으로 접속
   - 로그인 페이지에서 저장된 ID/PW 자동 입력 (@login.html)
   - 로그인 버튼 클릭 후 "인증되었습니다" 메시지에 확인 버튼 클릭 (@check.html)

2. **예약 대기 (20:57~21:00)**
   - 메인 페이지에서 정각(21:00)까지 대기 (@index.html)
   - 정확히 21:00에 버스예약 버튼 클릭

3. **예약 프로세스 (21:00)**
   - **하교 예약 순서:**
     1. 하교 탭 클릭(기본으로 표시됨) (@busreserve_come.html)
     2. 노선 선택 클릭 후 JSON에 지정된 노선 선택
     3. 출발시간 선택 후 지정된 시간 클릭 (@busreserve_time.html)
     4. 정류장(대화역) 클릭 후 지정된 좌석(11번) 선택 (@busreserve_seat.html)
     5. 예약하기 버튼 클릭 및 확인 메시지 승인 (@busreserve_confirm.html)
   
   - **등교 예약 순서:**
     1. 하교 예약 완료 후 등교 탭으로 이동 (@busreserve_come.html)
     2. 동일한 절차로 등교 예약 진행

## Firestore 데이터 구조

```javascript
// Firestore 데이터 구조
{
  "user": {
    "auth": {
      "id": "학번",
      "password": "비밀번호",
      "phone": "전화번호"  // 알림톡 발송용
    },
    "settings": {
      "reservationEnabled": true,  // 예약 자동화 활성화 여부
      "notificationEnabled": true  // 알림 활성화 여부
    }
  },
  "schedules": {
    "sunday": {
      "toSchool": {
        "enabled": true,
        "route": "장기/대화",
        "time": "07:40",
        "station": "대화역",
        "seatNumber": 11
      },
      "fromSchool": {
        "enabled": true,
        "route": "대화A",
        "time": "15:45",
        "station": "대화역",
        "seatNumber": 11
      }
    },
    "monday": {
      "toSchool": {
        "enabled": true,
        "route": "장기/대화",
        "time": "07:40",
        "station": "대화역",
        "seatNumber": 11
      },
      "fromSchool": {
        "enabled": true,
        "route": "대화A",
        "time": "13:45",
        "station": "대화역",
        "seatNumber": 11
      }
    },
    "tuesday": {
      "toSchool": {
        "enabled": true,
        "route": "대화A",
        "time": "08:30",
        "station": "대화역",
        "seatNumber": 11
      },
      "fromSchool": {
        "enabled": true,
        "route": "대화A",
        "time": "15:45",
        "station": "대화역",
        "seatNumber": 11
      }
    }
  },
  "logs": {
    "20240520": {  // 날짜 형식 YYYYMMDD
      "sunday": {
        "toSchool": {
          "timestamp": "2024-05-20T07:38:45.123Z",
          "status": "success",
          "message": "예약 성공",
          "reservationNumber": "12345",
          "details": {
            "route": "장기/대화",
            "time": "07:40",
            "station": "대화역",
            "seatNumber": 11
          }
        },
        "fromSchool": {
          "timestamp": "2024-05-20T15:43:10.456Z",
          "status": "success",
          "message": "예약 성공",
          "reservationNumber": "67890",
          "details": {
            "route": "대화A",
            "time": "15:45",
            "station": "대화역",
            "seatNumber": 11
          }
        }
      }
    }
  },
  "status": {
    "lastRun": "2024-05-20T21:00:05.123Z",
    "nextScheduled": "2024-05-21T21:00:00.000Z",
    "currentState": "idle",  // idle, running, error
    "lastError": null
  }
}
```