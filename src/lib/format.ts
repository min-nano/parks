import type { AvailabilityStatus } from '@/domain/types';
import type { FitDimension, FitResult } from '@/domain/vehicle';

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}分`;
  if (rest === 0) return `${hours}時間`;
  return `${hours}時間${rest}分`;
}

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  available: '空車',
  crowded: '混雑',
  full: '満車',
  unknown: '不明',
};

export type Tone = 'good' | 'warn' | 'bad' | 'muted';

export const AVAILABILITY_TONES: Record<AvailabilityStatus, Tone> = {
  available: 'good',
  crowded: 'warn',
  full: 'bad',
  unknown: 'muted',
};

export const DIMENSION_LABELS: Record<FitDimension, string> = {
  length: '全長',
  width: '全幅',
  height: '全高',
  weight: '重量',
  tireWidth: 'タイヤ幅',
};

export function formatConfidence(confidence: number): string {
  return `確度 ${Math.round(confidence * 100)}%`;
}

/** One line describing whether the driver's car can actually use the lot. */
export function formatFitSummary(fit: FitResult): string {
  if (fit.violations.length > 0) {
    const parts = fit.violations.map(
      (violation) =>
        `${DIMENSION_LABELS[violation.dimension]} ${violation.actual}${violation.unit} > ${violation.limit}${violation.unit}`,
    );
    return `駐車不可: ${parts.join(' / ')}`;
  }
  if (fit.unknownDimensions.length > 0) {
    const parts = fit.unknownDimensions.map((dimension) => DIMENSION_LABELS[dimension]);
    return `要確認: ${parts.join('・')}が未入力`;
  }
  return '駐車可能';
}

export function formatObservedAt(observedAt: string | null, now: Date): string {
  if (observedAt === null) return '情報なし';
  const parsed = Date.parse(observedAt);
  if (Number.isNaN(parsed)) return '情報なし';

  const minutes = Math.floor((now.getTime() - parsed) / 60_000);
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}
