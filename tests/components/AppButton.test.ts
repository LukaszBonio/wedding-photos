import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import AppButton from '@/components/AppButton.vue';

describe('AppButton', () => {
  it('applies the variant class', () => {
    expect(
      mount(AppButton, { props: { variant: 'secondary' }, slots: { default: 'Klik' } }).classes(),
    ).toContain('btn--secondary');
    expect(mount(AppButton, { slots: { default: 'Klik' } }).classes()).toContain('btn--primary');
  });

  it('respects disabled', () => {
    const wrapper = mount(AppButton, { props: { disabled: true }, slots: { default: 'x' } });
    expect(wrapper.attributes('disabled')).toBeDefined();
  });

  it('emits click through to the host', async () => {
    const onClick = vi.fn();
    const wrapper = mount(AppButton, { attrs: { onClick }, slots: { default: 'x' } });
    await wrapper.trigger('click');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
