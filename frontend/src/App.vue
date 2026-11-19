<template>
  <div id="app" class="app-container">
    <router-view v-if="!awaitingAdminAuth" v-slot="{ Component }">
      <component :is="Component" :key="viewKey" />
    </router-view>
    <section v-else class="auth-redirecting" role="status">
      <p>管理验证已失效，正在返回积分首页重新验证口令…</p>
      <div class="auth-redirect-actions">
        <button type="button" @click="requestAdminAuthentication()">重试返回首页</button>
        <a :href="homeHref">返回积分首页</a>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminAuthRequest, requestAdminAuthentication } from '@/utils/adminAuth'

const route = useRoute()
const router = useRouter()
const awaitingAdminAuth = computed(() => !!adminAuthRequest.value && !!route.meta?.requiresAdminAuth)
// A different event must get a fresh form, including its local upload draft.
const viewKey = computed(() => route.meta?.keyedByEvent
  ? JSON.stringify([route.path, Object.hasOwn(route.query, 'event_id'), route.query.event_id])
  : route.path)
const homeHref = computed(() => router.resolve('/points-display').href)
</script>

<style lang="scss">
@use './styles/feedback';
@use './styles/managementControls' as controls;
#app {
  width: 100%;
  height: 100%;
}

.auth-redirecting {
  @include feedback.empty-tip;
  margin: 15px;

  .auth-redirect-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  button { @include controls.primary-button; }
  a { @include controls.action-button(#eef1fb, #4c5684); text-decoration: none; }
}

.app-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100vh;
}
</style>

