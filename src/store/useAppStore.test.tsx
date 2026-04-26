import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './useAppStore';

function StoreProbe() {
  const screenValue = useAppStore((state) => state.screen);
  const audioEnabled = useAppStore((state) => state.audioEnabled);
  return (
    <div>
      <span data-testid="screen">{screenValue}</span>
      <span data-testid="audio">{audioEnabled ? 'on' : 'off'}</span>
    </div>
  );
}

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      screen: 'menu',
      audioEnabled: true,
      audioVolumePct: 85,
    });
  });

  it('updates state through actions', () => {
    useAppStore.getState().setScreen('howto');
    useAppStore.getState().toggleAudioEnabled();

    render(<StoreProbe />);
    expect(screen.getByTestId('screen')).toHaveTextContent('howto');
    expect(screen.getByTestId('audio')).toHaveTextContent('off');
  });
});
