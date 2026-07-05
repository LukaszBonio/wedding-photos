<script setup lang="ts">
// Primary = gold foil with dark ink label (WCAG AA ~6.7:1); secondary = quiet outline.
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary';
    type?: 'button' | 'submit';
    disabled?: boolean;
  }>(),
  { variant: 'primary', type: 'button', disabled: false },
);
</script>

<template>
  <button :type="type" :disabled="disabled" class="btn" :class="`btn--${variant}`">
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  width: 100%;
  min-height: var(--tap-target-min);
  padding: 0.95rem 1.25rem;
  font-size: 1.05rem;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 1.5px solid transparent;
  cursor: pointer;
  transition:
    transform 120ms var(--ease),
    background-color var(--dur) var(--ease),
    border-color var(--dur) var(--ease);
}

.btn:active {
  transform: scale(0.985);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn:focus-visible {
  outline: 3px solid var(--color-gold-deep);
  outline-offset: 2px;
}

.btn--primary {
  background: var(--color-gold);
  color: var(--color-ink);
  box-shadow: 0 6px 18px color-mix(in srgb, var(--color-gold) 32%, transparent);
}

.btn--primary:hover {
  background: var(--color-gold-deep);
}

.btn--secondary {
  background: transparent;
  color: var(--color-ink);
  border-color: var(--color-sand);
}

.btn--secondary:hover {
  border-color: var(--color-gold);
}
</style>
