<script setup lang="ts">
// Signature motif: a thin gold hairline with a centred diamond — a nod to
// gold-foil detailing on wedding stationery. Decorative only.
</script>

<template>
  <div class="rule" role="presentation" aria-hidden="true">
    <span class="rule__line" />
    <span class="rule__diamond" />
    <span class="rule__line" />
  </div>
</template>

<style scoped>
.rule {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  max-width: 11rem;
  margin: 0 auto;
}

.rule__line {
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, transparent, var(--color-gold), transparent);
}

.rule__diamond {
  flex: none;
  width: 7px;
  height: 7px;
  background: var(--color-gold);
  transform: rotate(45deg);
}
</style>
