import { ActionIcon, Anchor, Badge, Button, Card, createTheme, Loader, Table } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'indigo',
  // Light mode uses 6 (AA contrast against white); dark mode uses a lighter 4 so
  // filled buttons and links don't look muddy on dark surfaces.
  primaryShade: { light: 6, dark: 4 },
  // Flip text to black/white automatically when a filled color is too light/dark.
  autoContrast: true,
  luminanceThreshold: 0.35,
  defaultRadius: 'md',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  headings: { fontWeight: '650' },
  // Pointer cursor on checkboxes, switches, etc. (Mantine defaults to the arrow).
  cursorType: 'pointer',
  focusRing: 'auto',
  respectReducedMotion: true,
  // Slightly softer than pure black/white: less glare, still AAA contrast.
  black: '#16181d',
  components: {
    Button: Button.extend({ defaultProps: { fw: 600 } }),
    // 28px icon buttons are below the recommended 32-44px touch target.
    ActionIcon: ActionIcon.extend({ defaultProps: { size: 'lg', variant: 'subtle' } }),
    Anchor: Anchor.extend({ defaultProps: { underline: 'hover' } }),
    Badge: Badge.extend({ defaultProps: { fw: 600 } }),
    Card: Card.extend({ defaultProps: { shadow: 'xs' } }),
    Table: Table.extend({ defaultProps: { stickyHeader: false, verticalSpacing: 'sm' } }),
    Loader: Loader.extend({ defaultProps: { type: 'dots' } }),
  },
});
