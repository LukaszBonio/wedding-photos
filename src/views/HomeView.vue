<script setup lang="ts">
import GoldRule from '@/components/GoldRule.vue';
import PhotoSourceButtons from '@/components/PhotoSourceButtons.vue';
import ProgressBar from '@/components/ProgressBar.vue';
import { useUploadStore } from '@/stores/uploadStore';

const store = useUploadStore();
const heroSrc = `${import.meta.env.BASE_URL}hero.jpg`;

function onSelect(files: File[]): void {
  void store.pickFiles(files);
}
</script>

<template>
  <section class="screen home-screen">
    <div class="hero" aria-hidden="true">
      <img
        :src="heroSrc"
        alt=""
        class="hero__photo"
      />
      <div class="hero__overlay" />
    </div>

    <div class="screen__inner">
      <GoldRule />

      <header class="intro">
        <p class="eyebrow">Wesele</p>
        <h1 class="title">Anna & Łukasz</h1>
        <p class="lead">Zrób zdjęcie, nagraj filmik albo wybierz z galerii — trafi wprost do naszego albumu.</p>
      </header>

      <PhotoSourceButtons @select="onSelect" />

      <p v-if="store.pickError" class="alert" role="alert">{{ store.pickError }}</p>

      <GoldRule />
    </div>

    <div v-if="store.processing" class="overlay" role="status" aria-live="polite">
      <div class="overlay__card surface-glass">
        <p class="overlay__title">Przygotowuję zdjęcia…</p>
        <ProgressBar
          :value="store.processingTotal ? (store.processingDone / store.processingTotal) * 100 : 0"
          label="Przygotowywanie zdjęć"
        />
        <p class="overlay__count">{{ store.processingDone }} z {{ store.processingTotal }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-screen {
  position: relative;
  padding-top: 0 !important;
  overflow: hidden;
}

.hero {
  position: absolute;
  top: 0;
  left: -1.5rem;
  right: -1.5rem;
  height: 50vh;
  overflow: hidden;
}

.hero__photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 20%;
  display: block;
}

.hero__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    transparent 30%,
    color-mix(in srgb, var(--color-cream) 50%, transparent) 65%,
    var(--color-cream) 100%
  );
}

.home-screen > .screen__inner {
  margin-top: 42vh;
}

.intro {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.eyebrow {
  margin: 0;
  font-size: 0.8rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--color-gold-deep);
}

.title {
  font-size: 2.35rem;
}

.lead {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 1.05rem;
}

.alert {
  margin: 0;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  background: var(--color-error-soft);
  color: var(--color-error);
  font-size: 0.95rem;
}

.overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: color-mix(in srgb, var(--color-cream) 70%, transparent);
}

.overlay__card {
  width: 100%;
  max-width: 22rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  text-align: center;
}

.overlay__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.2rem;
}

.overlay__count {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-muted);
}
</style>
