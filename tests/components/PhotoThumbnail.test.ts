import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import PhotoThumbnail from '@/components/PhotoThumbnail.vue';
import type { PhotoVm } from '@/stores/uploadStore';

const photo = (status: PhotoVm['status']): PhotoVm => ({
  uploadId: 'x1',
  objectUrl: 'blob:x1',
  status,
  progress: 100,
  error: null,
});

describe('PhotoThumbnail', () => {
  it('shows a success badge and no remove button by default', () => {
    const wrapper = mount(PhotoThumbnail, { props: { photo: photo('success') } });
    expect(wrapper.find('.thumb--success').exists()).toBe(true);
    expect(wrapper.find('[role="img"]').attributes('aria-label')).toBe('Wysłane');
    expect(wrapper.find('[aria-label="Usuń zdjęcie"]').exists()).toBe(false);
  });

  it('shows a spinner while uploading', () => {
    const wrapper = mount(PhotoThumbnail, { props: { photo: photo('uploading') } });
    expect(wrapper.find('.thumb__spinner').exists()).toBe(true);
  });

  it('emits remove when removable', async () => {
    const wrapper = mount(PhotoThumbnail, { props: { photo: photo('ready'), removable: true } });
    await wrapper.find('[aria-label="Usuń zdjęcie"]').trigger('click');
    expect(wrapper.emitted('remove')?.[0]).toEqual(['x1']);
  });

  it('shows an error badge', () => {
    const wrapper = mount(PhotoThumbnail, { props: { photo: photo('error') } });
    expect(wrapper.find('.thumb--error').exists()).toBe(true);
    expect(wrapper.find('[role="img"]').attributes('aria-label')).toBe('Nie udało się wysłać');
  });
});
