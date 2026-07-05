import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/imageProcessor', () => ({
  compressImage: vi.fn(),
  supportsCompressionWorker: () => false,
}));

import { useUploadStore } from '@/stores/uploadStore';
import OfflineView from '@/views/OfflineView.vue';

describe('OfflineView', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('reassures the guest and shows the pending count', () => {
    const store = useUploadStore();
    store.photos.push(
      { uploadId: 'a', objectUrl: 'blob:a', status: 'offline', progress: 0, error: null },
      { uploadId: 'b', objectUrl: 'blob:b', status: 'offline', progress: 0, error: null },
    );
    const wrapper = mount(OfflineView);
    expect(wrapper.text()).toContain('wyślemy je automatycznie');
    expect(wrapper.text()).toContain('Oczekuje: 2');
  });
});
