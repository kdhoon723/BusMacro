<template>
  <div class="log-viewer">
    <h1>세부 로그 확인</h1>
    
    <!-- 인증 오류 메시지 -->
    <div v-if="authError" class="auth-error">
      <p>{{ authError }}</p>
      <router-link to="/login" class="btn-login">로그인 페이지로 이동</router-link>
    </div>
    
    <div v-if="!authError" class="log-content">
      <div class="filter-controls">
        <div class="form-group">
          <label>날짜 선택</label>
          <input type="date" v-model="selectedDate" @change="loadLogs" />
        </div>
        
        <div class="form-group">
          <label>로그 레벨</label>
          <select v-model="selectedLevel" @change="loadLogs">
            <option value="">모든 레벨</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>로그 타입</label>
          <select v-model="selectedType" @change="filterByType">
            <option value="">모든 타입</option>
            <option value="process">프로세스</option>
            <option value="screenshot">스크린샷</option>
            <option value="dialog">다이얼로그</option>
            <option value="reservation">예약</option>
            <option value="server">서버</option>
            <option value="timer_summary">타이머 요약</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>결과 수</label>
          <select v-model="resultLimit" @change="loadLogs">
            <option value="50">50개</option>
            <option value="100">100개</option>
            <option value="200">200개</option>
            <option value="500">500개</option>
          </select>
        </div>
        
        <button @click="loadLogs" class="btn btn-primary">새로고침</button>
      </div>
      
      <div class="auto-refresh">
        <label>
          <input type="checkbox" v-model="autoRefresh" @change="toggleAutoRefresh" />
          자동 새로고침 (10초)
        </label>
      </div>
      
      <!-- 환경 정보 -->
      <div class="environment-info" v-if="logs.length > 0">
        <div class="info-box">
          <strong>환경:</strong> {{ logs[0].context.environment === 'cloudrun' ? 'Cloud Run' : '로컬' }}
        </div>
        <div class="info-box">
          <strong>세션 ID:</strong> {{ logs[0].context.sessionId }}
        </div>
        <div class="info-box">
          <strong>로그 개수:</strong> {{ displayedLogs.length }} / {{ logs.length }}
        </div>
      </div>
      
      <!-- 로그 타임라인 -->
      <div class="log-timeline">
        <div v-for="log in displayedLogs" :key="log.id" 
             class="log-entry" 
             :class="'log-level-' + log.level">
          <div class="log-time">
            {{ formatTime(log.timestamp) }}
          </div>
          
          <div class="log-badge" :class="'log-type-' + (log.context.type || 'default')">
            {{ log.context.type || 'log' }}
          </div>
          
          <div class="log-message">
            <div class="message-content">{{ log.message }}</div>
            
            <!-- 프로세스 로그 특별 처리 -->
            <div v-if="log.context.type === 'process'" class="process-info">
              <span class="process-name">{{ log.context.process }}</span>
              <span v-if="log.context.duration" class="process-duration">
                {{ log.context.duration }}ms
              </span>
              <span class="process-status" :class="'status-' + log.context.status">
                {{ log.context.status }}
              </span>
            </div>
            
            <!-- 스크린샷 특별 처리 -->
            <div v-if="log.context.type === 'screenshot'" class="screenshot-preview">
              <a :href="backendUrl.value + log.context.url" target="_blank">
                {{ log.context.screenshotName }}
                <small>(스크린샷 보기)</small>
              </a>
            </div>
            
            <!-- 추가 정보 토글 버튼 -->
            <button v-if="hasDetails(log)" 
                    @click="toggleDetails(log)" 
                    class="btn-toggle">
              {{ log.showDetails ? '숨기기' : '상세 정보' }}
            </button>
            
            <!-- 상세 정보 표시 영역 -->
            <div v-if="log.showDetails" class="log-details">
              <pre>{{ formatDetails(log) }}</pre>
            </div>
          </div>
        </div>
        
        <div v-if="logs.length === 0" class="no-logs">
          <p>검색 조건에 맞는 로그가 없습니다.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getFirestore, collection, query, where, orderBy, limit as firestoreLimit, onSnapshot, Timestamp, getDocs } from 'firebase/firestore';
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

export default {
  name: 'LogViewer',
  
  setup() {
    const db = getFirestore();
    const auth = getAuth();
    
    // 상태 변수
    const logs = ref([]);
    const displayedLogs = ref([]);
    const selectedDate = ref(new Date().toISOString().split('T')[0]);
    const selectedLevel = ref('');
    const selectedType = ref('');
    const resultLimit = ref(100);
    const autoRefresh = ref(false);
    const refreshInterval = ref(null);
    const isAuthenticated = ref(false);
    const authError = ref('');
    
    // 백엔드 URL (API 요청용)
    const backendUrl = ref('');

    // 백엔드 URL 설정
    try {
      // import.meta.env 또는 window.location 기반으로 URL 설정
      if (import.meta && import.meta.env && import.meta.env.VITE_BACKEND_URL) {
        backendUrl.value = import.meta.env.VITE_BACKEND_URL;
      } else {
        // 기본값: 현재 호스트의 3000 포트
        const host = window.location.hostname;
        backendUrl.value = `http://${host}:3000`;
      }
    } catch (error) {
      console.error('백엔드 URL 설정 오류:', error);
      backendUrl.value = 'http://localhost:3000'; // 기본값
    }
    
    // 인증 상태 확인
    const checkAuthState = () => {
      return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          unsubscribe();
          if (user) {
            console.log('인증 확인됨:', user.uid);
            isAuthenticated.value = true;
            resolve(true);
          } else {
            console.error('인증되지 않은 사용자');
            isAuthenticated.value = false;
            authError.value = '인증되지 않은 사용자입니다. 로그인 페이지로 이동하세요.';
            reject(new Error('인증되지 않은 사용자'));
          }
        });
      });
    };
    
    // 로그 불러오기
    const loadLogs = async () => {
      try {
        // 인증 상태 먼저 확인
        await checkAuthState();
        
        console.log('로그 로드 시작 - 인증 상태:', isAuthenticated.value);
        let logQuery;
        
        if (selectedDate.value) {
          // 특정 날짜 로그 조회
          const dateString = selectedDate.value.replace(/-/g, '');
          const logsCollection = collection(db, 'logs', dateString, 'entries');
          
          // 필터링 적용
          if (selectedLevel.value) {
            logQuery = query(
              logsCollection,
              where('level', '==', selectedLevel.value),
              orderBy('timestamp', 'desc'),
              firestoreLimit(parseInt(resultLimit.value))
            );
          } else {
            logQuery = query(
              logsCollection,
              orderBy('timestamp', 'desc'),
              firestoreLimit(parseInt(resultLimit.value))
            );
          }
        } else {
          // 최근 로그 조회
          const recentLogsCollection = collection(db, 'recent_logs');
          
          // 필터링 적용
          if (selectedLevel.value) {
            logQuery = query(
              recentLogsCollection,
              where('level', '==', selectedLevel.value),
              orderBy('timestamp', 'desc'),
              firestoreLimit(parseInt(resultLimit.value))
            );
          } else {
            logQuery = query(
              recentLogsCollection,
              orderBy('timestamp', 'desc'),
              firestoreLimit(parseInt(resultLimit.value))
            );
          }
        }
        
        // 로그 문서 가져오기
        const snapshot = await getDocs(logQuery);
        
        // 로그 데이터 변환
        const logData = snapshot.docs.map(doc => {
          const data = doc.data();
          
          // Firestore Timestamp를 JavaScript Date로 변환
          if (data.timestamp && data.timestamp instanceof Timestamp) {
            data.timestamp = data.timestamp.toDate();
          }
          
          return {
            id: doc.id,
            ...data,
            showDetails: false
          };
        });
        
        logs.value = logData;
        filterByType(); // 타입 필터링 적용
        
      } catch (error) {
        console.error('로그 로드 오류:', error);
      }
    };
    
    // 타입 필터링
    const filterByType = () => {
      if (!selectedType.value) {
        displayedLogs.value = logs.value;
      } else {
        displayedLogs.value = logs.value.filter(log => 
          log.context && log.context.type === selectedType.value
        );
      }
    };
    
    // 자동 새로고침 설정
    const toggleAutoRefresh = () => {
      if (autoRefresh.value) {
        refreshInterval.value = setInterval(loadLogs, 10000);
      } else {
        clearInterval(refreshInterval.value);
      }
    };
    
    // 상세 정보 표시 여부 확인
    const hasDetails = (log) => {
      return log.context && (
        Object.keys(log.context).length > 3 || // 기본 필드 외 추가 정보 있음
        log.context.timer ||
        log.context.result
      );
    };
    
    // 상세 정보 토글
    const toggleDetails = (log) => {
      log.showDetails = !log.showDetails;
    };
    
    // 상세 정보 포맷팅
    const formatDetails = (log) => {
      // 기본 필드 제외한 나머지 정보만 표시
      const { environment, serviceId, sessionId, ...details } = log.context;
      return JSON.stringify(details, null, 2);
    };
    
    // 시간 포맷팅
    const formatTime = (timestamp) => {
      if (!timestamp) return '';
      
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      
      return date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    };
    
    // 컴포넌트 마운트시 로그 로드
    onMounted(async () => {
      try {
        // 인증 상태 먼저 확인
        await checkAuthState();
        // 인증됐으면 로그 로드
        await loadLogs();
      } catch (error) {
        console.error('마운트 시 오류:', error);
        // 오류는 checkAuthState에서 이미 authError에 설정됨
      }
    });
    
    // 컴포넌트 언마운트시 인터벌 정리
    onBeforeUnmount(() => {
      if (refreshInterval.value) {
        clearInterval(refreshInterval.value);
      }
    });
    
    return {
      logs,
      displayedLogs,
      selectedDate,
      selectedLevel,
      selectedType,
      resultLimit,
      autoRefresh,
      backendUrl,
      loadLogs,
      filterByType,
      toggleAutoRefresh,
      hasDetails,
      toggleDetails,
      formatDetails,
      formatTime
    };
  }
};
</script>

<style scoped>
.log-viewer {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  margin-bottom: 20px;
  color: #333;
}

.filter-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 5px;
  font-weight: bold;
  font-size: 14px;
}

.form-group select,
.form-group input {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.auto-refresh {
  margin-bottom: 20px;
}

.environment-info {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
  padding: 10px;
  background-color: #e9f0f8;
  border-radius: 6px;
}

.info-box {
  padding: 5px 10px;
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.log-timeline {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.log-entry {
  display: flex;
  padding: 10px;
  border-radius: 4px;
  background-color: #f9f9f9;
  border-left: 5px solid #ddd;
}

.log-level-info {
  border-left-color: #2196F3;
}

.log-level-warn {
  border-left-color: #FF9800;
  background-color: #fff9e6;
}

.log-level-error {
  border-left-color: #F44336;
  background-color: #ffebee;
}

.log-level-debug {
  border-left-color: #9C27B0;
  background-color: #f3e5f5;
}

.log-time {
  flex: 0 0 80px;
  font-family: monospace;
  color: #666;
}

.log-badge {
  flex: 0 0 80px;
  padding: 2px 6px;
  margin-right: 10px;
  border-radius: 4px;
  background-color: #ddd;
  text-align: center;
  font-size: 12px;
  text-transform: uppercase;
}

.log-type-process {
  background-color: #bbdefb;
  color: #0d47a1;
}

.log-type-screenshot {
  background-color: #c8e6c9;
  color: #1b5e20;
}

.log-type-dialog {
  background-color: #ffecb3;
  color: #ff6f00;
}

.log-type-reservation {
  background-color: #e1bee7;
  color: #4a148c;
}

.log-type-server {
  background-color: #d1c4e9;
  color: #311b92;
}

.log-type-timer_summary {
  background-color: #b3e5fc;
  color: #01579b;
}

.log-message {
  flex: 1;
}

.message-content {
  margin-bottom: 5px;
}

.process-info {
  display: flex;
  gap: 10px;
  margin-top: 5px;
  font-size: 13px;
}

.process-name {
  font-weight: bold;
}

.process-duration {
  color: #555;
}

.process-status {
  padding: 2px 6px;
  border-radius: 4px;
  background-color: #eee;
}

.status-started {
  background-color: #e3f2fd;
  color: #0d47a1;
}

.status-completed {
  background-color: #e8f5e9;
  color: #1b5e20;
}

.status-error {
  background-color: #ffebee;
  color: #b71c1c;
}

.screenshot-preview {
  margin-top: 5px;
}

.screenshot-preview a {
  color: #2196F3;
  text-decoration: none;
}

.screenshot-preview a:hover {
  text-decoration: underline;
}

.btn-toggle {
  margin-top: 8px;
  padding: 3px 8px;
  background-color: #f1f1f1;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.log-details {
  margin-top: 10px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
  overflow-x: auto;
}

.log-details pre {
  font-family: monospace;
  margin: 0;
  white-space: pre-wrap;
}

.no-logs {
  padding: 30px;
  text-align: center;
  background-color: #f9f9f9;
  border-radius: 8px;
  color: #666;
}

.auth-error {
  padding: 20px;
  background-color: #ffebee;
  border-radius: 8px;
  margin-bottom: 20px;
  color: #b71c1c;
  text-align: center;
}

.auth-error p {
  margin-bottom: 15px;
  font-weight: bold;
}

.btn-login {
  display: inline-block;
  padding: 8px 16px;
  background-color: #2196F3;
  color: white;
  border-radius: 4px;
  text-decoration: none;
  font-weight: bold;
}

.btn-login:hover {
  background-color: #1976D2;
}
</style> 