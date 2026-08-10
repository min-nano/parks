// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ResolvedAvailability } from '@/domain/availability';
import { RENDER_NOW } from '@/test/search-items';

import { AvailabilityBadge } from './AvailabilityBadge';

const availability = (overrides: Partial<ResolvedAvailability> = {}): ResolvedAvailability => ({
  status: 'available',
  confidence: 0.82,
  source: 'official',
  observedAt: '2026-08-10T11:55:00.000Z',
  reportCount: 0,
  ...overrides,
});

describe('AvailabilityBadge', () => {
  it('shows the status, source, age and confidence', () => {
    render(<AvailabilityBadge availability={availability()} now={RENDER_NOW} />);

    const badge = screen.getByTestId('availability-badge');
    expect(badge).toHaveTextContent('空車');
    expect(badge).toHaveTextContent('公式');
    expect(badge).toHaveTextContent('5分前');
    expect(badge).toHaveTextContent('確度 82%');
    expect(badge.className).toContain('badge--good');
  });

  it('credits community reports', () => {
    render(
      <AvailabilityBadge
        availability={availability({ status: 'full', source: 'community' })}
        now={RENDER_NOW}
      />,
    );

    const badge = screen.getByTestId('availability-badge');
    expect(badge).toHaveTextContent('満車');
    expect(badge).toHaveTextContent('ユーザー報告');
    expect(badge.className).toContain('badge--bad');
  });

  it('hides the confidence when nothing is known', () => {
    render(
      <AvailabilityBadge
        availability={availability({ status: 'unknown', source: 'none', observedAt: null })}
        now={RENDER_NOW}
      />,
    );

    const badge = screen.getByTestId('availability-badge');
    expect(badge).toHaveTextContent('情報なし');
    expect(badge).not.toHaveTextContent('確度');
    expect(badge.className).toContain('badge--muted');
  });

  it('uses the warning tone when crowded', () => {
    render(
      <AvailabilityBadge availability={availability({ status: 'crowded' })} now={RENDER_NOW} />,
    );

    expect(screen.getByTestId('availability-badge').className).toContain('badge--warn');
  });
});
