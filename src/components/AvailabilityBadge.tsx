import type { ResolvedAvailability } from '@/domain/availability';
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_TONES,
  formatConfidence,
  formatObservedAt,
} from '@/lib/format';

const SOURCE_LABELS: Record<ResolvedAvailability['source'], string> = {
  official: '公式',
  community: 'ユーザー報告',
  none: '情報なし',
};

export function AvailabilityBadge({
  availability,
  now,
}: {
  availability: ResolvedAvailability;
  now: Date;
}) {
  const tone = AVAILABILITY_TONES[availability.status];

  return (
    <span className={`badge badge--${tone}`} data-testid="availability-badge">
      <strong>{AVAILABILITY_LABELS[availability.status]}</strong>
      <small>
        {SOURCE_LABELS[availability.source]} · {formatObservedAt(availability.observedAt, now)}
        {availability.status === 'unknown' ? '' : ` · ${formatConfidence(availability.confidence)}`}
      </small>
    </span>
  );
}
