'use client';

import { APIProvider, AdvancedMarker, Map, Pin } from '@vis.gl/react-google-maps';
import { useState } from 'react';

import type { ParkingSearchItem } from '@/db/repository';
import type { AvailabilityStatus, LatLng } from '@/domain/types';

/** Pin colours mirror the availability tones used across the list and badges. */
const PIN_COLORS: Record<AvailabilityStatus, { background: string; border: string }> = {
  available: { background: '#1a7f37', border: '#0f5c26' },
  crowded: { background: '#bf8700', border: '#8a6100' },
  full: { background: '#b42318', border: '#7f1d13' },
  unknown: { background: '#6b7280', border: '#4b5563' },
};

export type ParkingMapViewProps = {
  apiKey: string | null;
  mapId: string;
  center: LatLng;
  items: ParkingSearchItem[];
  selectedId: string | null;
  onSelect: (parkingId: string) => void;
  onRecenter: (center: LatLng) => void;
};

export function ParkingMapView({
  apiKey,
  mapId,
  center,
  items,
  selectedId,
  onSelect,
  onRecenter,
}: ParkingMapViewProps) {
  const [camera, setCamera] = useState<LatLng>(center);

  if (apiKey === null) {
    return (
      <div className="map map--disabled" role="note">
        <p>
          地図を表示するには <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> を設定してください。
          リスト表示は引き続き利用できます。
        </p>
      </div>
    );
  }

  return (
    <div className="map">
      <APIProvider apiKey={apiKey}>
        <Map
          className="map__canvas"
          defaultCenter={center}
          defaultZoom={15}
          mapId={mapId}
          gestureHandling="greedy"
          disableDefaultUI
          onCameraChanged={(event) => setCamera(event.detail.center)}
        >
          {items.map((item) => (
            <AdvancedMarker
              key={item.parking.id}
              position={item.parking.location}
              title={item.parking.name}
              onClick={() => onSelect(item.parking.id)}
            >
              <Pin
                background={PIN_COLORS[item.availability.status].background}
                borderColor={PIN_COLORS[item.availability.status].border}
                glyphColor="#ffffff"
                scale={item.parking.id === selectedId ? 1.4 : 1}
              />
            </AdvancedMarker>
          ))}
        </Map>
      </APIProvider>

      <button type="button" className="map__recenter" onClick={() => onRecenter(camera)}>
        この範囲で再検索
      </button>
    </div>
  );
}
