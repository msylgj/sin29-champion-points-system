<template>
  <div id="app" class="app-container">
    <router-view />
    <BottomNav />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import BottomNav from '@/components/common/BottomNav.vue'

onMounted(() => {
  console.log('🚀 射箭赛事积分统计系统已启动')
})
</script>

<style lang="scss">
#app {
  width: 100%;
  height: 100%;
}

.app-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100vh;
}
</style>

