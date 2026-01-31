<template>
  <div v-if="showBottomNav" class="bottom-nav safe-area-bottom">
    <router-link
      v-for="(route, index) in navRoutes"
      :key="index"
      :to="route.path"
      :class="['nav-item', { active: isActive(route.name) }]"
    >
      <span class="icon">{{ route.meta.icon }}</span>
      <span class="label">{{ route.meta.title }}</span>
    </router-link>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// 获取有图标的导航路由 (底部标签栏显示的路由)
const navRoutes = computed(() => {
  return router.getRoutes().filter(r => r.meta?.showBottomNav)
})

// 检查当前路由是否活跃
const isActive = (name) => {
  return route.name === name
}

// 检查是否显示底部导航
const showBottomNav = computed(() => {
  return route.meta?.showBottomNav ?? true
})
</script>

<style scoped lang="scss">
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
  background: var(--white);
  border-top: 1px solid var(--gray-light);
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  z-index: 100;

  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 0;
    text-decoration: none;
    color: var(--gray);
    transition: color 0.3s;
    min-height: 60px;

    .icon {
      font-size: 24px;
    }

    .label {
      font-size: var(--font-xs);
      white-space: nowrap;
    }

    &.active {
      color: var(--primary);
      font-weight: 600;

      .icon {
        font-size: 28px;
      }
    }

    &:active {
      background: var(--light);
    }
  }
}

/* 安全区域支持 */
@supports (padding: max(0px)) {
  .bottom-nav.safe-area-bottom {
    padding-bottom: max(0px, env(safe-area-inset-bottom));
  }
}

@media (min-width: 768px) {
  .bottom-nav {
    display: none;
  }
}
</style>
