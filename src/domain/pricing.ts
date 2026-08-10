import type { FeeSchedule, MaxFeeRule, RateSegment } from './types';

const MINUTES_PER_DAY = 1440;

/** Estimates longer than 30 days are clamped; coin parking tariffs stop making sense there. */
export const MAX_ESTIMATE_MINUTES = MINUTES_PER_DAY * 30;

export type ChargeBlock = {
  segmentId: string;
  label: string;
  /** Minutes since arrival. */
  startMinute: number;
  endMinute: number;
  minutes: number;
  /** Billing units consumed (`ceil(minutes / unitMinutes)`). */
  units: number;
  /** Cost before any 打ち切り cap was applied. */
  rawYen: number;
  /** Cost after caps. */
  yen: number;
};

export type AppliedCap = {
  id: string;
  label: string;
  capYen: number;
  rawYen: number;
  savedYen: number;
};

export type FeeEstimate = {
  totalYen: number;
  blocks: ChargeBlock[];
  appliedCaps: AppliedCap[];
  /** Minutes the schedule does not price at all — surfaced so the UI can warn. */
  uncoveredMinutes: number;
  clamped: boolean;
};

export type EstimateInput = {
  arrival: Date;
  durationMinutes: number;
};

type Occurrence = { start: number; end: number; priority: number };

const minuteOfDay = (date: Date): number => date.getHours() * 60 + date.getMinutes();

const emptyEstimate = (clamped = false): FeeEstimate => ({
  totalYen: 0,
  blocks: [],
  appliedCaps: [],
  uncoveredMinutes: 0,
  clamped,
});

function dayOffsets(from: number, to: number): number[] {
  const first = Math.floor(from / MINUTES_PER_DAY) - 1;
  const last = Math.floor(to / MINUTES_PER_DAY) + 1;
  const offsets: number[] = [];
  for (let day = first; day <= last; day += 1) offsets.push(day);
  return offsets;
}

function segmentOccurrences(segments: RateSegment[], from: number, to: number): Occurrence[] {
  const occurrences: Occurrence[] = [];
  const offsets = dayOffsets(from, to);

  segments.forEach((segment, priority) => {
    if (segment.unitMinutes <= 0) return;
    for (const day of offsets) {
      const start = day * MINUTES_PER_DAY + segment.window.startMinute;
      const end = day * MINUTES_PER_DAY + segment.window.endMinute;
      if (end <= start) continue;
      if (end <= from || start >= to) continue;
      occurrences.push({ start, end, priority });
    }
  });

  return occurrences;
}

function capOccurrences(cap: MaxFeeRule, from: number, to: number): Occurrence[] {
  const length = cap.window.endMinute - cap.window.startMinute;
  if (length <= 0) return [];

  if (cap.repeat === 'once') {
    const start = from + cap.window.startMinute;
    return [{ start, end: start + length, priority: 0 }];
  }

  return dayOffsets(from, to)
    .map((day) => {
      const start = day * MINUTES_PER_DAY + cap.window.startMinute;
      return { start, end: start + length, priority: 0 };
    })
    .filter((occurrence) => occurrence.end > from && occurrence.start < to);
}

/** Splits [from, to) at every occurrence edge so each slice has one owning segment. */
function sliceTimeline(occurrences: Occurrence[], from: number, to: number): number[] {
  const boundaries = new Set<number>([from, to]);
  for (const occurrence of occurrences) {
    if (occurrence.start > from && occurrence.start < to) boundaries.add(occurrence.start);
    if (occurrence.end > from && occurrence.end < to) boundaries.add(occurrence.end);
  }
  return [...boundaries].sort((a, b) => a - b);
}

function ownerOf(occurrences: Occurrence[], start: number, end: number): Occurrence | null {
  const midpoint = (start + end) / 2;
  let owner: Occurrence | null = null;
  for (const occurrence of occurrences) {
    if (occurrence.start > midpoint || occurrence.end <= midpoint) continue;
    if (owner === null || occurrence.priority < owner.priority) owner = occurrence;
  }
  return owner;
}

/**
 * Reduces `yen` on the given blocks so their sum equals `capYen`, keeping the
 * split proportional and the total exact (largest-remainder distribution).
 */
function applyCapToBlocks(blocks: ChargeBlock[], subtotal: number, capYen: number): void {
  const factor = capYen / subtotal;
  const entries = blocks.map((block) => {
    const scaled = block.yen * factor;
    const floored = Math.floor(scaled);
    return { block, yen: floored, fraction: scaled - floored };
  });

  let remainder = capYen - entries.reduce((sum, entry) => sum + entry.yen, 0);
  for (const entry of [...entries].sort((a, b) => b.fraction - a.fraction)) {
    entry.yen += remainder > 0 ? 1 : 0;
    remainder -= 1;
  }

  for (const entry of entries) entry.block.yen = entry.yen;
}

/**
 * Estimates what a stay costs.
 *
 * The meter is modelled per rate segment: a contiguous stretch of time under one
 * segment is billed as `ceil(minutes / unitMinutes) * unitYen`. Caps are then
 * applied in declaration order, each one scaling down the blocks that started
 * inside its window.
 */
export function estimateFee(schedule: FeeSchedule, input: EstimateInput): FeeEstimate {
  if (!Number.isFinite(input.durationMinutes) || input.durationMinutes <= 0) {
    return emptyEstimate();
  }

  const clamped = input.durationMinutes > MAX_ESTIMATE_MINUTES;
  const duration = clamped ? MAX_ESTIMATE_MINUTES : input.durationMinutes;

  const from = minuteOfDay(input.arrival);
  const to = from + duration;

  const occurrences = segmentOccurrences(schedule.segments, from, to);
  const points = sliceTimeline(occurrences, from, to);

  const blocks: ChargeBlock[] = [];
  let uncoveredMinutes = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index] as number;
    const end = points[index + 1] as number;
    const owner = ownerOf(occurrences, start, end);

    if (owner === null) {
      uncoveredMinutes += end - start;
      continue;
    }

    const segment = schedule.segments[owner.priority] as RateSegment;
    const previous = blocks[blocks.length - 1];

    // Merge contiguous slices owned by the same segment so the meter is not
    // restarted at, say, midnight for a 24h tariff.
    if (previous && previous.segmentId === segment.id && previous.endMinute === start - from) {
      previous.endMinute = end - from;
      previous.minutes = previous.endMinute - previous.startMinute;
      previous.units = Math.ceil(previous.minutes / segment.unitMinutes);
      previous.rawYen = previous.units * segment.unitYen;
      previous.yen = previous.rawYen;
      continue;
    }

    const minutes = end - start;
    const units = Math.ceil(minutes / segment.unitMinutes);
    blocks.push({
      segmentId: segment.id,
      label: segment.label,
      startMinute: start - from,
      endMinute: end - from,
      minutes,
      units,
      rawYen: units * segment.unitYen,
      yen: units * segment.unitYen,
    });
  }

  const appliedCaps: AppliedCap[] = [];

  for (const cap of schedule.caps) {
    for (const occurrence of capOccurrences(cap, from, to)) {
      const members = blocks.filter((block) => {
        const absoluteStart = block.startMinute + from;
        return absoluteStart >= occurrence.start && absoluteStart < occurrence.end;
      });
      if (members.length === 0) continue;

      const subtotal = members.reduce((sum, block) => sum + block.yen, 0);
      if (subtotal <= cap.capYen) continue;

      applyCapToBlocks(members, subtotal, cap.capYen);
      appliedCaps.push({
        id: cap.id,
        label: cap.label,
        capYen: cap.capYen,
        rawYen: subtotal,
        savedYen: subtotal - cap.capYen,
      });
    }
  }

  return {
    totalYen: blocks.reduce((sum, block) => sum + block.yen, 0),
    blocks,
    appliedCaps,
    uncoveredMinutes,
    clamped,
  };
}

export function formatYen(yen: number): string {
  return `${Math.round(yen).toLocaleString('ja-JP')}円`;
}

/** Cheapest published unit rate, used for the "from ¥N" badge on map pins. */
export function cheapestUnitRate(schedule: FeeSchedule): RateSegment | null {
  let cheapest: RateSegment | null = null;
  for (const segment of schedule.segments) {
    if (segment.unitMinutes <= 0) continue;
    const rate = segment.unitYen / segment.unitMinutes;
    if (cheapest === null || rate < cheapest.unitYen / cheapest.unitMinutes) {
      cheapest = segment;
    }
  }
  return cheapest;
}
