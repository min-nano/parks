// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ParkingSearchItem } from '@/db/repository';
import { RENDER_NOW, makeSearchItem } from '@/test/search-items';

import { ParkingList } from './ParkingList';

const setup = (items: ParkingSearchItem[], selectedId: string | null = null) => {
  const onSelect = vi.fn();
  render(
    <ParkingList
      items={items}
      selectedId={selectedId}
      onSelect={onSelect}
      durationMinutes={60}
      now={RENDER_NOW}
    />,
  );
  return { onSelect, user: userEvent.setup() };
};

describe('ParkingList', () => {
  it('explains an empty result set', () => {
    setup([]);

    expect(screen.getByText('条件に合う駐車場が見つかりませんでした。')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows distance, structure and the estimated fee', () => {
    setup([makeSearchItem({ parking: { sourceId: 'list-1', name: '渋谷パーク' } })]);

    expect(screen.getByText('渋谷パーク')).toBeInTheDocument();
    expect(screen.getByText(/240m/)).toHaveTextContent('平面');
    expect(screen.getByText(/240m/)).toHaveTextContent('60分 400円');
  });

  it('says so when no fee is registered', () => {
    const item = makeSearchItem();
    setup([{ ...item, fee: { ...item.fee, blocks: [], totalYen: 0 } }]);

    expect(screen.getByText(/料金情報なし/)).toBeInTheDocument();
  });

  it('marks a lot the car cannot enter', () => {
    const item = makeSearchItem({ parking: { sourceId: 'blocked' } });
    setup([
      {
        ...item,
        fit: {
          fits: false,
          violations: [{ dimension: 'height', limit: 1550, actual: 2285, unit: 'mm' }],
          unknownDimensions: [],
        },
      },
    ]);

    const fit = screen.getByTestId(`fit-${item.parking.id}`);
    expect(fit).toHaveTextContent('駐車不可');
    expect(fit.className).toContain('result__fit--blocked');
  });

  it('reports the selection back to the parent', async () => {
    const item = makeSearchItem({ parking: { sourceId: 'clickable', name: 'クリック' } });
    const { onSelect, user } = setup([item]);

    await user.click(screen.getByRole('button', { name: /クリック/ }));

    expect(onSelect).toHaveBeenCalledWith(item.parking.id);
  });

  it('highlights the selected row', () => {
    const item = makeSearchItem({ parking: { sourceId: 'selected' } });
    setup([item], item.parking.id);

    const button = screen.getByRole('button');
    expect(button.className).toContain('result--selected');
    expect(button).toHaveAttribute('aria-current', 'true');
  });
});
