import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import CaptionInput from '@/components/CaptionInput.vue';

describe('CaptionInput', () => {
  it('shows the character counter and max length', () => {
    const wrapper = mount(CaptionInput, { props: { modelValue: 'abc' } });
    expect(wrapper.text()).toContain('3/200');
    expect(wrapper.find('textarea').attributes('maxlength')).toBe('200');
  });

  it('emits update:modelValue on input', async () => {
    const wrapper = mount(CaptionInput, { props: { modelValue: 'abc' } });
    await wrapper.find('textarea').setValue('abcd');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['abcd']);
  });
});
