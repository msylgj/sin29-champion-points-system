<template>
  <div id="app" class="app-container">
    <router-view />
  </div>
</template>

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

