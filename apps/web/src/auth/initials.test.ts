import { describe, expect, it } from 'vitest';
import { displayNameOf, initialsOf } from './initials';

describe('initialsOf', () => {
  it('uses the first letters of the first two words of a name', () => {
    expect(initialsOf('Shay Zhakov')).toBe('SZ');
    expect(initialsOf('ada king lovelace')).toBe('AK');
  });
  it('uses two letters for a single word', () => {
    expect(initialsOf('shayyzhakov')).toBe('SH');
  });
  it('splits an email local part on separators', () => {
    expect(initialsOf('shay.zhakov@gmail.com')).toBe('SZ');
    expect(initialsOf('shayyzhakov@gmail.com')).toBe('SH');
  });
  it('falls back to a question mark when there is nothing to use', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf(undefined)).toBe('?');
  });
});

describe('displayNameOf', () => {
  it('prefers the name, then the email', () => {
    expect(displayNameOf({ name: 'Shay', email: 's@x.com' })).toBe('Shay');
    expect(displayNameOf({ email: 's@x.com' })).toBe('s@x.com');
    expect(displayNameOf({})).toBeUndefined();
  });
});
