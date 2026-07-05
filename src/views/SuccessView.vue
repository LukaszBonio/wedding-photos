<script setup lang="ts">
import AppButton from '@/components/AppButton.vue';
import GoldRule from '@/components/GoldRule.vue';
import { useUploadStore } from '@/stores/uploadStore';

const store = useUploadStore();

function again(): void {
  store.reset();
}
</script>

<template>
  <section class="screen">
    <div class="screen__inner success">
      <GoldRule />

      <span class="success__mark" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>

      <header class="success__head">
        <h1 class="title">Dziękujemy!</h1>
        <p class="lead">Twoje zdjęcia są już w naszym albumie.</p>
        <p class="count">Wysłane zdjęcia: {{ store.counts.success }}</p>
      </header>

      <AppButton variant="primary" @click="again">Dodaj kolejne zdjęcia</AppButton>

      <GoldRule />
    </div>
  </section>
</template>

<style scoped>
.success {
  align-items: center;
}
.success__mark {
  align-self: center;
  width: 64px;
  height: 64px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--color-ink);
  background: var(--color-gold);
}
.success__mark svg {
  width: 32px;
  height: 32px;
}
.success__head {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.title {
  font-size: 2.2rem;
}
.lead {
  margin: 0;
  color: var(--color-text-muted);
}
.count {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-gold-deep);
}
</style>
