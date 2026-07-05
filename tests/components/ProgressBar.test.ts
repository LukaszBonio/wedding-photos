import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ProgressBar from '@/components/ProgressBar.vue';

describe('ProgressBar', () => {
  it('renders a determinate fill width and aria value', () => {
    const wrapper = mount(ProgressBar, { props: { value: 50 } });
    expect(wrapper.find('.pb__fill').attributes('style')).toContain('width: 50%');
    expect(wrapper.attributes('aria-valuenow')).toBe('50');
  });

  it('renders an indeterminate bar without a value', () => {
    const wrapper = mount(ProgressBar, { props: { indeterminate: true } });
    expect(wrapper.find('.pb__fill--indeterminate').exists()).toBe(true);
    expect(wrapper.attributes('aria-valuenow')).toBeUndefined();
  });

  it('clamps out-of-range values', () => {
    expect(
      mount(ProgressBar, { props: { value: 150 } })
        .find('.pb__fill')
        .attributes('style'),
    ).toContain('width: 100%');
    expect(
      mount(ProgressBar, { props: { value: -20 } })
        .find('.pb__fill')
        .attributes('style'),
    ).toContain('width: 0%');
  });
});
