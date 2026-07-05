import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/imageProcessor', () => ({
  compressImage: vi.fn(),
  supportsCompressionWorker: () => false,
}));

import { useUploadStore } from '@/stores/uploadStore';
import ErrorView from '@/views/ErrorView.vue';

describe('ErrorView', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('summarises the outcome and retries failed photos', async () => {
    const store = useUploadStore();
    store.photos.push(
      { uploadId: 'a', objectUrl: 'blob:a', status: 'success', progress: 100, error: null },
      { uploadId: 'b', objectUrl: 'blob:b', status: 'error', progress: 0, error: 'x' },
    );
    const retry = vi.spyOn(store, 'retryFailed').mockImplementation(() => {});
    const wrapper = mount(ErrorView);
    expect(wrapper.text()).toContain('Wysłano 1 z 2');
    await wrapper.findAll('button')[0]!.trigger('click');
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
