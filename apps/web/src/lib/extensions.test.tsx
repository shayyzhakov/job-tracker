import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { emitAppEvent, onAppEvent } from './app-events';
import { registerSlot, Slot } from './extensions';

describe('Slot', () => {
  it('renders nothing when empty and picks up registrations live', () => {
    const { container } = render(<Slot name="overview.top" />);
    expect(container).toBeEmptyDOMElement();
    let off = () => {};
    act(() => {
      off = registerSlot('overview.top', 'test', () => <p>hello</p>);
    });
    expect(screen.getByText('hello')).toBeInTheDocument();
    act(() => off());
    expect(screen.queryByText('hello')).not.toBeInTheDocument();
  });

  it('passes props through to the registered component', () => {
    const off = registerSlot('application.detail.top', 'props', (p) => <p>{String(p.id)}</p>);
    render(<Slot name="application.detail.top" id="app-1" />);
    expect(screen.getByText('app-1')).toBeInTheDocument();
    off();
  });
});

describe('app events', () => {
  it('delivers events, supports unsubscribe, and isolates faulty listeners', () => {
    const spy = vi.fn();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const offBad = onAppEvent(() => {
      throw new Error('boom');
    });
    const off = onAppEvent(spy);
    emitAppEvent({ type: 'application.created', applicationId: 'a' });
    expect(spy).toHaveBeenCalledWith({ type: 'application.created', applicationId: 'a' });
    off();
    offBad();
    emitAppEvent({ type: 'application.created', applicationId: 'b' });
    expect(spy).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });
});
