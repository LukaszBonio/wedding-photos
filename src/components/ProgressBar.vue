<script setup lang="ts">
withDefaults(defineProps<{ value?: number; indeterminate?: boolean; label?: string }>(), {
  value: 0,
  indeterminate: false,
  label: 'Postęp',
});
</script>

<template>
  <div
    class="pb"
    role="progressbar"
    :aria-label="label"
    :aria-valuenow="indeterminate ? undefined : Math.round(value)"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div v-if="indeterminate" class="pb__fill pb__fill--indeterminate" />
    <div v-else class="pb__fill" :style="{ width: `${Math.max(0, Math.min(100, value))}%` }" />
  </div>
</template>

<style scoped>
.pb {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: var(--color-sand-soft);
  overflow: hidden;
}

.pb__fill {
  height: 100%;
  border-radius: inherit;
  background: var(--color-gold);
  transition: width var(--dur) var(--ease);
}

.pb__fill--indeterminate {
  width: 40%;
  animation: slide 1.2s ease-in-out infinite;
}

@keyframes slide {
  0% {
    margin-left: -40%;
  }
  100% {
    margin-left: 100%;
  }
}
</style>
