# Google Cloud Platform 배포 가이드

대진대학교 버스 예약 매크로 백엔드를 Google Cloud Platform에 배포하는 방법을 안내합니다.

## 사전 준비

1. [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) 설치
2. GCP 프로젝트 생성 및 설정
3. 결제 계정 활성화
4. 필요한 서비스 API 활성화:
   - Cloud Run API
   - Cloud Build API
   - Container Registry API

## 환경 변수 설정

`.env` 파일을 생성하고 다음 변수를 설정하세요:

```
# Firebase 설정
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="your-private-key"

# 대진대학교 로그인 정보
DJ_ID=your-username
DJ_PASSWORD=your-password

# 알림 서비스 설정
KAKAO_API_KEY=your-kakao-api-key
SMS_API_KEY=your-sms-api-key
NOTIFICATION_PHONE=your-phone-number
```

## Secret Manager 설정

민감한 정보는 Secret Manager에 저장하는 것이 좋습니다:

```bash
# Secret Manager API 활성화
gcloud services enable secretmanager.googleapis.com

# 시크릿 생성
gcloud secrets create DJ_ID --data-file=<(echo -n "your-username")
gcloud secrets create DJ_PASSWORD --data-file=<(echo -n "your-password")
gcloud secrets create FIREBASE_PRIVATE_KEY --data-file=<(echo -n "your-private-key")
```

## 배포 방법

### 1. 수동 배포

```bash
# 백엔드 디렉토리로 이동
cd backend

# 도커 이미지 빌드
docker build -t gcr.io/[PROJECT_ID]/busmacro-backend .

# 이미지 푸시
docker push gcr.io/[PROJECT_ID]/busmacro-backend

# Cloud Run 배포
gcloud run deploy busmacro-backend \
  --image gcr.io/[PROJECT_ID]/busmacro-backend \
  --region asia-northeast3 \
  --platform managed \
  --allow-unauthenticated \
  --update-secrets=DJ_ID=DJ_ID:latest,DJ_PASSWORD=DJ_PASSWORD:latest,FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest
```

### 2. Cloud Build 자동 배포

```bash
# cloudbuild.yaml 파일이 있는 디렉토리에서 실행
gcloud builds submit --config=cloudbuild.yaml .
```

## 스케줄링

Cloud Scheduler를 사용하여 cron 작업을 설정할 수 있습니다:

```bash
# Cloud Scheduler API 활성화
gcloud services enable cloudscheduler.googleapis.com

# 일요일 21:00에 예약 시작하는 작업 설정
gcloud scheduler jobs create http reserve-sunday \
  --schedule="0 21 * * 0" \
  --uri="https://busmacro-backend-[hash].run.app/api/reserve/manual" \
  --http-method=POST
```

## 모니터링

Cloud Run 콘솔에서 로그와 모니터링 정보를 확인할 수 있습니다:
https://console.cloud.google.com/run

## 트러블슈팅

1. **Puppeteer 실행 오류**
   - Dockerfile의 Chrome 설치 및 의존성을 확인하세요

2. **환경 변수 문제**
   - Secret Manager가 올바르게 설정되었는지 확인하세요
   - Cloud Run 서비스의 환경 변수가 올바르게 설정되었는지 확인하세요

3. **타임아웃 오류**
   - Cloud Run 설정에서 타임아웃을 15분으로 늘리세요 