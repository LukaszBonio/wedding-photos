<script setup lang="ts">
import { useUploadStore } from '@/stores/uploadStore';

const store = useUploadStore();
</script>

<template>
  <section class="screen">
    <div class="screen__inner offline">
      <span class="offline__icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M2 2l20 20" />
          <path d="M8.5 16.5a5 5 0 0 1 7 0" />
          <path d="M5 12.5a10 10 0 0 1 3-2" />
          <path d="M19 12.5a10 10 0 0 0-6-2.8" />
          <path d="M2 8.8a15 15 0 0 1 4-2.4" />
          <path d="M22 8.8a15 15 0 0 0-8-3.6" />
          <path d="M12 20h.01" />
        </svg>
      </span>

      <header class="offline__head">
        <h2 class="title">Brak połączenia</h2>
        <p class="lead">
          Zdjęcie zapisane — wyślemy je automatycznie, gdy wróci internet. Nie zamykaj tej karty.
        </p>
        <p class="count">Oczekuje: {{ store.counts.pending }}</p>
      </header>
    </div>
  </section>
</template>

<style scoped>
.offline {
  align-items: center;
}
.offline__icon {
  align-self: center;
  width: 60px;
  height: 60px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--color-ink-soft);
  background: var(--color-sand-soft);
}
.offline__icon svg {
  width: 30px;
  height: 30px;
}
.offline__head {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.title {
  font-size: 1.6rem;
}
.lead {
  margin: 0;
  color: var(--color-text-muted);
}
.count {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-muted);
}
</style>
