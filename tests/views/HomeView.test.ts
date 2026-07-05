import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Avoid pulling the compression worker into the test transform.
vi.mock('@/services/imageProcessor', () => ({
  compressImage: vi.fn(),
  supportsCompressionWorker: () => false,
}));

import HomeView from '@/views/HomeView.vue';

describe('HomeView', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('renders the greeting and all capture buttons', () => {
    const wrapper = mount(HomeView);
    expect(wrapper.text()).toContain('Anna & Łukasz');
    expect(wrapper.findAll('button')).toHaveLength(3);
    expect(wrapper.text()).toContain('Zrób zdjęcie');
    expect(wrapper.text()).toContain('Nagraj wideo');
    expect(wrapper.text()).toContain('Wybierz z galerii');
  });

  it('exposes camera, video and gallery file inputs', () => {
    const wrapper = mount(HomeView);
    const inputs = wrapper.findAll('input[type="file"]');
    expect(inputs).toHaveLength(3);
    expect(inputs[0]!.attributes('capture')).toBe('environment');
    expect(inputs[0]!.attributes('accept')).toBe('image/*');
    expect(inputs[1]!.attributes('capture')).toBe('environment');
    expect(inputs[1]!.attributes('accept')).toBe('video/*');
    expect(inputs[2]!.attributes('multiple')).toBeDefined();
    expect(inputs[2]!.attributes('capture')).toBeUndefined();
  });
});
