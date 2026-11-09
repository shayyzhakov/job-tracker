import type { ContactDto } from '@job-tracker/shared';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SimilarContactBanner } from './SimilarContactBanner';

const dana: ContactDto = {
  id: 'ct1',
  applicationCount: 2,
  name: 'Dana Levi',
  role: 'Headhunter',
  email: 'dana@agency.com',
  phone: null,
  linkedinUrl: null,
  notes: null,
};

const show = (name: string, onUse = vi.fn(), exclude = new Set<string>()) =>
  render(
    <MantineProvider>
      <SimilarContactBanner name={name} known={[dana]} excludeIds={exclude} onUse={onUse} />
    </MantineProvider>,
  );

describe('SimilarContactBanner', () => {
  it('suggests a known contact with a similar name, ignoring case', () => {
    const onUse = vi.fn();
    show('dana LEVI', onUse);
    fireEvent.click(screen.getByRole('button', { name: 'Use this contact' }));
    expect(onUse).toHaveBeenCalledWith(dana);
  });

  it('stays hidden for unrelated names, short input and contacts already attached', () => {
    for (const [name, exclude] of [
      ['Avi', new Set<string>()],
      ['da', new Set<string>()],
      ['Dana Levi', new Set(['ct1'])],
    ] as const) {
      const { unmount } = show(name, vi.fn(), new Set(exclude));
      expect(screen.queryByText('Already in your contacts?')).not.toBeInTheDocument();
      unmount();
    }
  });
});
