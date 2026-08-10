'use client';

import { useState } from 'react';

import type { ParkingSearchItem } from '@/db/repository';
import { formatYen } from '@/domain/pricing';
import { useParkingDetail } from '@/hooks/use-parking-detail';
import {
  AVAILABILITY_LABELS,
  DIMENSION_LABELS,
  formatDistance,
  formatDuration,
  formatFitSummary,
  formatObservedAt,
} from '@/lib/format';

import { AvailabilityBadge } from './AvailabilityBadge';
import { STRUCTURE_LABELS } from './FilterPanel';
import { ReportForm } from './ReportForm';

const LIMIT_ROWS = [
  { key: 'maxLengthMm', dimension: 'length', unit: 'mm' },
  { key: 'maxWidthMm', dimension: 'width', unit: 'mm' },
  { key: 'maxHeightMm', dimension: 'height', unit: 'mm' },
  { key: 'maxWeightKg', dimension: 'weight', unit: 'kg' },
  { key: 'maxTireWidthMm', dimension: 'tireWidth', unit: 'mm' },
] as const;

export type ParkingDetailProps = {
  item: ParkingSearchItem;
  durationMinutes: number;
  isSignedIn: boolean;
  now: Date;
  onClose: () => void;
  onReported: () => void;
};

export function ParkingDetail({
  item,
  durationMinutes,
  isSignedIn,
  now,
  onClose,
  onReported,
}: ParkingDetailProps) {
  const [nonce, setNonce] = useState(0);
  const detail = useParkingDetail(item.parking.id, nonce);
  const { parking, fee } = item;

  const handleReported = () => {
    setNonce((value) => value + 1);
    onReported();
  };

  return (
    <section className="detail" aria-label={`${parking.name} の詳細`}>
      <header className="detail__head">
        <div>
          <h2>{parking.name}</h2>
          <p className="detail__address">{parking.address}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="閉じる">
          ✕
        </button>
      </header>

      <div className="detail__summary">
        <AvailabilityBadge availability={item.availability} now={now} />
        <span>{formatDistance(item.distanceMeters)}</span>
        <span>{STRUCTURE_LABELS[parking.structure]}</span>
        {parking.capacity === null ? null : <span>{parking.capacity}台</span>}
        {parking.features.evCharging ? <span>EV充電</span> : null}
      </div>

      <h3>料金の目安（{formatDuration(durationMinutes)}）</h3>
      {fee.blocks.length === 0 ? (
        <p>料金情報が登録されていません。</p>
      ) : (
        <>
          <p className="detail__total">{formatYen(fee.totalYen)}</p>
          <ul className="detail__breakdown">
            {fee.blocks.map((block) => (
              <li key={`${block.segmentId}-${block.startMinute}`}>
                {block.label} × {block.units}単位 → {formatYen(block.yen)}
              </li>
            ))}
            {fee.appliedCaps.map((cap) => (
              <li key={`${cap.id}-${cap.rawYen}`}>
                {cap.label} 適用（-{formatYen(cap.savedYen)}）
              </li>
            ))}
          </ul>
          {fee.uncoveredMinutes > 0 ? (
            <p className="detail__warning">
              {formatDuration(fee.uncoveredMinutes)}は料金が未登録のため含まれていません。
            </p>
          ) : null}
        </>
      )}

      <h3>駐車可能な車両</h3>
      <p data-testid="detail-fit">{formatFitSummary(item.fit)}</p>
      <table className="detail__limits">
        <tbody>
          {LIMIT_ROWS.map((row) => (
            <tr key={row.key}>
              <th scope="row">{DIMENSION_LABELS[row.dimension]}</th>
              <td>
                {parking.limits[row.key] === null
                  ? '未公表'
                  : `${parking.limits[row.key]}${row.unit} まで`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>空き状況を報告</h3>
      <ReportForm
        parkingId={parking.id}
        isSignedIn={isSignedIn}
        onSubmitted={handleReported}
      />

      <h3>最近の報告</h3>
      {detail.status === 'loading' ? <p>読み込み中…</p> : null}
      {detail.status === 'error' ? <p role="alert">{detail.error}</p> : null}
      {detail.status === 'ready' && detail.data !== null ? (
        detail.data.reports.length === 0 ? (
          <p>まだ報告はありません。</p>
        ) : (
          <ul className="detail__reports">
            {detail.data.reports.map((report) => (
              <li key={report.id}>
                <strong>{AVAILABILITY_LABELS[report.status]}</strong>{' '}
                {formatObservedAt(report.createdAt, now)}
                {report.note === null ? null : <span> — {report.note}</span>}
              </li>
            ))}
          </ul>
        )
      ) : null}

      {parking.officialUrl === null ? null : (
        <p>
          <a href={parking.officialUrl} target="_blank" rel="noreferrer">
            公式サイトで確認
          </a>
        </p>
      )}
    </section>
  );
}
