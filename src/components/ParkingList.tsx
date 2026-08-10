'use client';

import type { ParkingSearchItem } from '@/db/repository';
import { formatYen } from '@/domain/pricing';
import { formatDistance, formatFitSummary } from '@/lib/format';

import { AvailabilityBadge } from './AvailabilityBadge';
import { STRUCTURE_LABELS } from './FilterPanel';

export type ParkingListProps = {
  items: ParkingSearchItem[];
  selectedId: string | null;
  onSelect: (parkingId: string) => void;
  durationMinutes: number;
  now: Date;
};

export function ParkingList({
  items,
  selectedId,
  onSelect,
  durationMinutes,
  now,
}: ParkingListProps) {
  if (items.length === 0) {
    return <p className="empty">条件に合う駐車場が見つかりませんでした。</p>;
  }

  return (
    <ul className="results" aria-label="検索結果">
      {items.map((item) => (
        <li key={item.parking.id}>
          <button
            type="button"
            className={`result${item.parking.id === selectedId ? ' result--selected' : ''}`}
            aria-current={item.parking.id === selectedId}
            onClick={() => onSelect(item.parking.id)}
          >
            <span className="result__head">
              <span className="result__name">{item.parking.name}</span>
              <AvailabilityBadge availability={item.availability} now={now} />
            </span>
            <span className="result__meta">
              {formatDistance(item.distanceMeters)} ·{' '}
              {STRUCTURE_LABELS[item.parking.structure]} ·{' '}
              {item.fee.blocks.length === 0
                ? '料金情報なし'
                : `${durationMinutes}分 ${formatYen(item.fee.totalYen)}`}
            </span>
            <span
              className={`result__fit${item.fit.fits ? '' : ' result__fit--blocked'}`}
              data-testid={`fit-${item.parking.id}`}
            >
              {formatFitSummary(item.fit)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
