import type { AvailabilitySnapshot, AvailabilityStatus, UserReport } from './types';

export type AvailabilitySource = 'official' | 'community' | 'none';

export type ResolvedAvailability = {
  status: AvailabilityStatus;
  /** 0-1. Combines how much evidence exists and how much of it agrees. */
  confidence: number;
  source: AvailabilitySource;
  observedAt: string | null;
  reportCount: number;
};

export type ResolveOptions = {
  /** Weight an official observation carries relative to a single user report. */
  officialWeight: number;
  officialHalfLifeMinutes: number;
  reportHalfLifeMinutes: number;
  /** Evidence lighter than this is treated as no evidence at all. */
  minimumWeight: number;
};

export const DEFAULT_RESOLVE_OPTIONS: ResolveOptions = {
  officialWeight: 2.5,
  officialHalfLifeMinutes: 45,
  reportHalfLifeMinutes: 30,
  minimumWeight: 0.05,
};

type Evidence = {
  status: AvailabilityStatus;
  weight: number;
  observedAt: string;
  source: Exclude<AvailabilitySource, 'none'>;
};

const decay = (ageMinutes: number, halfLifeMinutes: number): number => {
  if (ageMinutes <= 0) return 1;
  return 0.5 ** (ageMinutes / halfLifeMinutes);
};

const ageInMinutes = (observedAt: string, now: Date): number | null => {
  const observed = Date.parse(observedAt);
  if (Number.isNaN(observed)) return null;
  return (now.getTime() - observed) / 60_000;
};

const unresolved: ResolvedAvailability = {
  status: 'unknown',
  confidence: 0,
  source: 'none',
  observedAt: null,
  reportCount: 0,
};

/**
 * Merges the operator's own feed with community reports into a single answer.
 *
 * Both kinds of evidence decay exponentially, so a five-minute-old user report
 * legitimately outweighs an hour-old official snapshot. Statuses of `unknown`
 * carry no signal and are dropped.
 */
export function resolveAvailability(
  input: {
    official: AvailabilitySnapshot | null;
    reports: UserReport[];
    now: Date;
  },
  options: ResolveOptions = DEFAULT_RESOLVE_OPTIONS,
): ResolvedAvailability {
  const evidence: Evidence[] = [];

  if (input.official && input.official.status !== 'unknown') {
    const age = ageInMinutes(input.official.observedAt, input.now);
    if (age !== null) {
      evidence.push({
        status: input.official.status,
        weight: options.officialWeight * decay(age, options.officialHalfLifeMinutes),
        observedAt: input.official.observedAt,
        source: 'official',
      });
    }
  }

  for (const report of input.reports) {
    if (report.status === 'unknown') continue;
    const age = ageInMinutes(report.createdAt, input.now);
    if (age === null) continue;
    evidence.push({
      status: report.status,
      weight: decay(age, options.reportHalfLifeMinutes),
      observedAt: report.createdAt,
      source: 'community',
    });
  }

  const usable = evidence.filter((item) => item.weight >= options.minimumWeight);
  if (usable.length === 0) return unresolved;

  const weightByStatus = new Map<AvailabilityStatus, number>();
  for (const item of usable) {
    weightByStatus.set(item.status, (weightByStatus.get(item.status) ?? 0) + item.weight);
  }

  let winner: AvailabilityStatus = 'unknown';
  let winnerWeight = -1;
  for (const [status, weight] of weightByStatus) {
    if (weight > winnerWeight) {
      winner = status;
      winnerWeight = weight;
    }
  }

  const totalWeight = usable.reduce((sum, item) => sum + item.weight, 0);
  const agreement = winnerWeight / totalWeight;
  const saturation = totalWeight / (totalWeight + 1);

  const supporting = usable.filter((item) => item.status === winner);
  const heaviest = supporting.reduce((best, item) => (item.weight > best.weight ? item : best));
  const observedAt = supporting.reduce((latest, item) =>
    Date.parse(item.observedAt) > Date.parse(latest.observedAt) ? item : latest,
  ).observedAt;

  return {
    status: winner,
    confidence: Math.round(agreement * saturation * 100) / 100,
    source: heaviest.source,
    observedAt,
    reportCount: usable.filter((item) => item.source === 'community').length,
  };
}
