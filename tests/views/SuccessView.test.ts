import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/imageProcessor', () => ({
  compressImage: vi.fn(),
  supportsCompressionWorker: () => false,
}));

import { useUploadStore } from '@/stores/uploadStore';
import SuccessView from '@/views/SuccessView.vue';

describe('SuccessView', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('thanks the guest and shows the sent count', () => {
    const store = useUploadStore();
    store.photos.push(
      { uploadId: 'a', objectUrl: 'blob:a', mimeType: 'image/jpeg', status: 'success', progress: 100, error: null },
      { uploadId: 'b', objectUrl: 'blob:b', mimeType: 'image/jpeg', status: 'success', progress: 100, error: null },
    );
    const wrapper = mount(SuccessView);
    expect(wrapper.text()).toContain('Dziękujemy!');
    expect(wrapper.text()).toContain('Wysłane zdjęcia: 2');
    expect(wrapper.text()).toContain('Dodaj kolejne zdjęcia');
  });
});
