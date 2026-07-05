import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/imageProcessor', () => ({
  compressImage: vi.fn(),
  supportsCompressionWorker: () => false,
}));

import { useUploadStore } from '@/stores/uploadStore';
import PreviewView from '@/views/PreviewView.vue';

describe('PreviewView', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('renders a thumbnail per staged photo and a send button with the count', () => {
    const store = useUploadStore();
    store.photos.push(
      { uploadId: 'a', objectUrl: 'blob:a', mimeType: 'image/jpeg', status: 'ready', progress: 100, error: null },
      { uploadId: 'b', objectUrl: 'blob:b', mimeType: 'image/jpeg', status: 'ready', progress: 100, error: null },
    );
    const wrapper = mount(PreviewView);
    expect(wrapper.findAll('.thumb')).toHaveLength(2);
    expect(wrapper.text()).toContain('Wyślij (2)');
    expect(wrapper.findAll('[aria-label="Usuń zdjęcie"]')).toHaveLength(2);
  });
});
