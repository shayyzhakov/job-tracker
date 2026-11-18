import { Anchor, Text } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import type { ReactNode } from 'react';

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}]+$/;

/** A short readable label for a URL: host without "www.", plus a hint of the path. */
export function linkLabel(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    const host = hostname.replace(/^www\./, '');
    const first = pathname.split('/').filter(Boolean)[0];
    return first ? `${host}/${first.length > 24 ? `${first.slice(0, 24)}…` : first}` : host;
  } catch {
    return url;
  }
}

/** Splits text into plain strings and links, keeping trailing punctuation out of the URL. */
export function splitLinks(text: string): Array<string | { url: string }> {
  const parts: Array<string | { url: string }> = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const url = match[0].replace(TRAILING_PUNCTUATION, '');
    if (start > last) parts.push(text.slice(last, start));
    parts.push({ url });
    last = start + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** Multi-line text where URLs become short, clickable links instead of raw text. */
export function LinkifiedText({ text }: { text: string }) {
  const nodes: ReactNode[] = splitLinks(text).map((part, i) =>
    typeof part === 'string' ? (
      part
    ) : (
      <Anchor
        // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and static
        key={i}
        href={part.url}
        target="_blank"
        rel="noopener noreferrer"
        title={part.url}
      >
        {linkLabel(part.url)}
        <IconExternalLink size={13} style={{ marginLeft: 3, verticalAlign: '-2px' }} />
      </Anchor>
    ),
  );
  return <Text style={{ whiteSpace: 'pre-wrap' }}>{nodes}</Text>;
}
