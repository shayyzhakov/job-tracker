export interface SessionUser {
  name?: string;
  email?: string;
}

export const displayNameOf = (user: SessionUser) => user.name || user.email || undefined;

/** "Shay Zhakov" -> "SZ", "shay.zhakov@x.com" -> "SZ", "shayyzhakov" -> "SH". */
export function initialsOf(nameOrEmail: string | undefined): string {
  const base = (nameOrEmail ?? '').split('@')[0] ?? '';
  const words = base.split(/[\s._+-]+/).filter(Boolean);
  if (words.length === 0) return '?';
  const [first = '', second] = words;
  const letters = second ? `${first[0]}${second[0]}` : first.slice(0, 2);
  return letters.toUpperCase();
}
