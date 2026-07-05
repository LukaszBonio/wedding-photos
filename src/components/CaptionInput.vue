<script setup lang="ts">
import { MAX_CAPTION_LENGTH } from '@/constants';

defineProps<{ modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
}
</script>

<template>
  <div class="caption">
    <label class="visually-hidden" for="caption-field">Opis zdjęcia (opcjonalnie)</label>
    <textarea
      id="caption-field"
      class="caption__field"
      :value="modelValue"
      :maxlength="MAX_CAPTION_LENGTH"
      rows="2"
      placeholder="Dodaj opis (opcjonalnie)"
      @input="onInput"
    />
    <span class="caption__count" aria-live="polite">
      {{ modelValue.length }}/{{ MAX_CAPTION_LENGTH }}
    </span>
  </div>
</template>

<style scoped>
.caption {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.caption__field {
  width: 100%;
  resize: none;
  padding: 0.75rem 0.9rem;
  font-family: inherit;
  font-size: 1rem;
  color: var(--color-ink);
  background: var(--color-ivory);
  border: 1.5px solid var(--color-sand);
  border-radius: var(--radius-sm);
}

.caption__field:focus-visible {
  outline: none;
  border-color: var(--color-gold);
}

.caption__count {
  align-self: flex-end;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
</style>
