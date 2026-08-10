'use client';

import { useState } from 'react';

import type { LatLng } from '@/domain/types';
import { useParkingSearch } from '@/hooks/use-parking-search';
import { DEFAULT_FILTERS, type FilterState } from '@/lib/filters';

import { FilterPanel } from './FilterPanel';
import { ParkingDetail } from './ParkingDetail';
import { ParkingList } from './ParkingList';
import { ParkingMapView } from './ParkingMapView';

export type ParkingExplorerProps = {
  googleMapsApiKey: string | null;
  mapId: string;
  initialCenter: LatLng;
  isSignedIn: boolean;
};

export function ParkingExplorer({
  googleMapsApiKey,
  mapId,
  initialCenter,
  isSignedIn,
}: ParkingExplorerProps) {
  const [center, setCenter] = useState<LatLng>(initialCenter);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [geolocationError, setGeolocationError] = useState<string | null>(null);

  const search = useParkingSearch(center, filters);
  const now = search.updatedAt;

  const selected = search.items.find((item) => item.parking.id === selectedId) ?? null;

  const handleLocate = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeolocationError('この端末では現在地を取得できません。');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeolocationError(null);
        setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => setGeolocationError('現在地を取得できませんでした。'),
    );
  };

  return (
    <div className="explorer">
      <aside className="explorer__sidebar">
        <div className="explorer__actions">
          <button type="button" onClick={handleLocate}>
            現在地から探す
          </button>
          <button type="button" onClick={search.refresh}>
            最新の情報に更新
          </button>
        </div>
        {geolocationError ? <p role="alert">{geolocationError}</p> : null}

        <FilterPanel filters={filters} onChange={setFilters} />

        {search.status === 'loading' ? <p role="status">検索中…</p> : null}
        {search.status === 'error' ? <p role="alert">{search.error}</p> : null}
        {search.status === 'ready' ? (
          <ParkingList
            items={search.items}
            selectedId={selectedId}
            onSelect={setSelectedId}
            durationMinutes={filters.durationMinutes}
            now={now}
          />
        ) : null}
      </aside>

      <main className="explorer__main">
        <ParkingMapView
          apiKey={googleMapsApiKey}
          mapId={mapId}
          center={center}
          items={search.items}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRecenter={setCenter}
        />

        {selected ? (
          <ParkingDetail
            item={selected}
            durationMinutes={filters.durationMinutes}
            isSignedIn={isSignedIn}
            now={now}
            onClose={() => setSelectedId(null)}
            onReported={search.refresh}
          />
        ) : null}
      </main>
    </div>
  );
}
