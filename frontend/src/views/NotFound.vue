<!-- 404 페이지 -->
<template>
  <div class="not-found container">
    <div class="not-found-content">
      <div class="error-code">404</div>
      <h1>페이지를 찾을 수 없습니다</h1>
      <p>요청하신 페이지가 존재하지 않거나 이동되었습니다.</p>
      <router-link to="/" class="btn-home">홈으로 돌아가기</router-link>
    </div>
  </div>
</template>

<script setup>
// 스크립트 없음
</script>

<style scoped>
.not-found {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
  text-align: center;
}

.not-found-content {
  max-width: 500px;
}

.error-code {
  font-size: 8rem;
  font-weight: bold;
  color: var(--primary-color);
  line-height: 1;
  margin-bottom: 20px;
  opacity: 0.5;
}

h1 {
  color: var(--dark-color);
  margin-bottom: 20px;
}

p {
  color: #666;
  margin-bottom: 30px;
  font-size: 1.1rem;
}

.btn-home {
  display: inline-block;
  padding: 12px 30px;
  background-color: var(--primary-color);
  color: white;
  text-decoration: none;
  border-radius: 4px;
  font-weight: bold;
  transition: background-color 0.3s;
}

.btn-home:hover {
  background-color: #2980b9;
}
</style> 