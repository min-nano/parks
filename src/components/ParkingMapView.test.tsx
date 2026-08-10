// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ParkingSearchItem } from '@/db/repository';
import { makeSearchItem } from '@/test/search-items';

import { ParkingMapView } from './ParkingMapView';

type MapProps = {
  children?: ReactNode;
  mapId?: string;
  onCameraChanged?: (event: { detail: { center: { lat: number; lng: number } } }) => void;
};

vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children, apiKey }: { children?: ReactNode; apiKey: string }) => (
    <div data-testid="api-provider" data-api-key={apiKey}>
      {children}
    </div>
  ),
  Map: ({ children, mapId, onCameraChanged }: MapProps) => (
    <div data-testid="map-canvas" data-map-id={mapId}>
      <button
        type="button"
        onClick={() => onCameraChanged?.({ detail: { center: { lat: 34.7, lng: 135.5 } } })}
      >
        パン
      </button>
      {children}
    </div>
  ),
  AdvancedMarker: ({
    children,
    title,
    onClick,
  }: {
    children?: ReactNode;
    title: string;
    onClick: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {title}
      {children}
    </button>
  ),
  Pin: ({ background, scale }: { background: string; scale: number }) => (
    <span data-testid="pin" data-background={background} data-scale={scale} />
  ),
}));

const CENTER = { lat: 35.658, lng: 139.7016 };

const setup = (
  items: ParkingSearchItem[] = [],
  overrides: Partial<Parameters<typeof ParkingMapView>[0]> = {},
) => {
  const onSelect = vi.fn();
  const onRecenter = vi.fn();
  render(
    <ParkingMapView
      apiKey="key-123"
      mapId="map-abc"
      center={CENTER}
      items={items}
      selectedId={null}
      onSelect={onSelect}
      onRecenter={onRecenter}
      {...overrides}
    />,
  );
  return { onSelect, onRecenter, user: userEvent.setup() };
};

describe('ParkingMapView', () => {
  it('explains how to enable the map when no API key is set', () => {
    setup([], { apiKey: null });

    expect(screen.getByRole('note')).toHaveTextContent('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
    expect(screen.queryByTestId('map-canvas')).not.toBeInTheDocument();
  });

  it('passes the API key and map id through', () => {
    setup();

    expect(screen.getByTestId('api-provider')).toHaveAttribute('data-api-key', 'key-123');
    expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-map-id', 'map-abc');
  });

  it('renders one pin per result, coloured by availability', () => {
    const available = makeSearchItem({ parking: { sourceId: 'ok', name: '空きあり' } });
    const full = makeSearchItem({ parking: { sourceId: 'full', name: '満車' } });

    setup([
      available,
      { ...full, availability: { ...full.availability, status: 'full' } },
    ]);

    const pins = screen.getAllByTestId('pin');
    expect(pins).toHaveLength(2);
    expect(pins[0]).toHaveAttribute('data-background', '#1a7f37');
    expect(pins[1]).toHaveAttribute('data-background', '#b42318');
  });

  it('enlarges the selected pin', () => {
    const item = makeSearchItem({ parking: { sourceId: 'sel', name: '選択中' } });
    setup([item], { selectedId: item.parking.id });

    expect(screen.getByTestId('pin')).toHaveAttribute('data-scale', '1.4');
  });

  it('selects a parking when its marker is clicked', async () => {
    const item = makeSearchItem({ parking: { sourceId: 'pin', name: 'ピン' } });
    const { onSelect, user } = setup([item]);

    await user.click(screen.getByRole('button', { name: 'ピン' }));

    expect(onSelect).toHaveBeenCalledWith(item.parking.id);
  });

  it('searches the panned viewport rather than the original centre', async () => {
    const { onRecenter, user } = setup();

    await user.click(screen.getByRole('button', { name: 'パン' }));
    await user.click(screen.getByRole('button', { name: 'この範囲で再検索' }));

    expect(onRecenter).toHaveBeenCalledWith({ lat: 34.7, lng: 135.5 });
  });

  it('falls back to the current centre when the map has not moved', async () => {
    const { onRecenter, user } = setup();

    await user.click(screen.getByRole('button', { name: 'この範囲で再検索' }));

    expect(onRecenter).toHaveBeenCalledWith(CENTER);
  });
});
