<template>
  <div v-if="success" class="success-message" role="status" aria-live="polite">{{ success }}</div>
  <div v-if="error" class="error-message" role="alert" aria-live="assertive">{{ error }}</div>
</template>

<script setup>
defineProps({
  success: { type: String, default: '' },
  error: { type: String, default: '' },
})
</script>

<style scoped lang="scss">
@use '../styles/feedback';

.success-message, .error-message { z-index: 998; }
.success-message { @include feedback.floating-message(150px, #2ed573); }
.error-message { @include feedback.floating-message(200px, #ff4757); }
@include feedback.floating-animation;
</style>
