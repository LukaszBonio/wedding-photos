import 'fake-indexeddb/auto';

import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/imageProcessor', () => ({
  compressImage: vi.fn(),
  supportsCompressionWorker: () => false,
}));

import App from '@/App.vue';
import { useUploadStore } from '@/stores/uploadStore';

describe('App', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    window.location.hash = '';
  });

  it('starts on the home view', async () => {
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.text()).toContain('Podziel się chwilą');
  });

  it('switches views with the state machine', async () => {
    const wrapper = mount(App);
    await flushPromises();
    const store = useUploadStore();
    store.view = 'preview';
    await flushPromises();
    expect(wrapper.text()).toContain('Twoje zdjęcia');
  });
});
