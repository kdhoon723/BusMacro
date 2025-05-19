import { defineStore } from 'pinia';
import { auth } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    loading: true,
    error: null
  }),
  
  getters: {
    isAuthenticated: (state) => !!state.user,
    userEmail: (state) => state.user?.email || '',
    userId: (state) => state.user?.uid || null
  },
  
  actions: {
    // 로그인
    async login(email, password) {
      this.loading = true;
      this.error = null;
      
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        this.user = userCredential.user;
        return true;
      } catch (error) {
        console.error('로그인 오류:', error);
        
        // 사용자 친화적인 오류 메시지
        if (error.code === 'auth/invalid-email') {
          this.error = '유효하지 않은 학번 형식입니다.';
        } else if (error.code === 'auth/user-not-found') {
          this.error = '등록되지 않은 학번입니다.';
        } else if (error.code === 'auth/wrong-password') {
          this.error = '비밀번호가 일치하지 않습니다.';
        } else if (error.code === 'auth/too-many-requests') {
          this.error = '너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.';
        } else if (error.code === 'auth/operation-not-allowed') {
          this.error = '이메일/비밀번호 로그인이 Firebase에서 활성화되지 않았습니다.';
        } else if (error.code === 'auth/invalid-credential') {
          this.error = '학번 또는 비밀번호가 올바르지 않습니다.';
        } else {
          this.error = '로그인 중 오류가 발생했습니다. 다시 시도해주세요.';
        }
        
        return false;
      } finally {
        this.loading = false;
      }
    },
    
    // 로그아웃
    async logout() {
      this.loading = true;
      
      try {
        await signOut(auth);
        this.user = null;
        return true;
      } catch (error) {
        this.error = error.message;
        console.error('로그아웃 오류:', error);
        return false;
      } finally {
        this.loading = false;
      }
    },
    
    // 인증 상태 초기화
    initAuth() {
      this.loading = true;
      
      return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            this.user = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName
            };
          } else {
            this.user = null;
          }
          
          this.loading = false;
          resolve(this.user);
        });
        
        // $onAction으로 스토어가 파괴될 때 구독 해제
        this.$onAction(({ after, onError, name }) => {
          if (name === 'initAuth') {
            onError(() => {
              unsubscribe();
            });
            after(() => {
              // initAuth가 완료된 후에도 유지
            });
          }
        });
      });
    }
  }
}); 