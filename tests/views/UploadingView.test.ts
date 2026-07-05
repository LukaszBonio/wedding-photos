import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/imageProcessor', () => ({
  compressImage: vi.fn(),
  supportsCompressionWorker: () => false,
}));

import { useUploadStore } from '@/stores/uploadStore';
import UploadingView from '@/views/UploadingView.vue';

describe('UploadingView', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('shows the aggregate progress', () => {
    const store = useUploadStore();
    store.photos.push(
      { uploadId: 'a', objectUrl: 'blob:a', status: 'success', progress: 100, error: null },
      { uploadId: 'b', objectUrl: 'blob:b', status: 'uploading', progress: 0, error: null },
    );
    const wrapper = mount(UploadingView);
    expect(wrapper.text()).toContain('1 z 2 wysłane');
    expect(wrapper.find('.pb__fill').attributes('style')).toContain('width: 50%');
  });
});
