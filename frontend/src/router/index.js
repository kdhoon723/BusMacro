import { createRouter, createWebHistory } from 'vue-router';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

// 라우트 컴포넌트 임포트
import Login from '../views/Login.vue';
import Dashboard from '../views/Dashboard.vue';
import ReservationSettings from '../views/ReservationSettings.vue';
import ReservationStatus from '../views/ReservationStatus.vue';
import LogViewer from '../views/LogViewer.vue';
import WeeklySchedule from '../views/WeeklySchedule.vue';
import NotFound from '../views/NotFound.vue';

const routes = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresAuth: false }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'ReservationSettings',
    component: ReservationSettings,
    meta: { requiresAuth: true }
  },
  {
    path: '/weekly',
    name: 'WeeklySchedule',
    component: WeeklySchedule,
    meta: { requiresAuth: true }
  },
  {
    path: '/status',
    name: 'ReservationStatus',
    component: ReservationStatus,
    meta: { requiresAuth: true }
  },
  {
    path: '/logs',
    name: 'LogViewer',
    component: LogViewer,
    meta: { requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFound
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// 네비게이션 가드
router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  
  // 인증이 필요하지 않은 페이지는 바로 접근 허용
  if (!requiresAuth) {
    next();
    return;
  }
  
  // 현재 로그인 상태 확인
  const auth = getAuth();

  // 사용자 인증 확인
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) {
        // 인증된 사용자는 요청한 페이지로 이동
        next();
      } else {
        // 인증되지 않은 사용자는 로그인 페이지로 리디렉션
        next('/login');
      }
      resolve();
    });
  });
});

export default router; 