// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ParkingSearchItem } from '@/db/repository';
import { fetchParkingDetail, submitReport } from '@/lib/api-client';
import { RENDER_NOW, makeSearchItem } from '@/test/search-items';

import { ParkingDetail } from './ParkingDetail';

vi.mock('@/lib/api-client', () => ({
  fetchParkingDetail: vi.fn(),
  submitReport: vi.fn(),
}));

const detailMock = vi.mocked(fetchParkingDetail);
const submitMock = vi.mocked(submitReport);

const detailResponse = (reports: unknown[] = []) =>
  Promise.resolve({ reports } as never);

const setup = (item: ParkingSearchItem = makeSearchItem(), isSignedIn = true) => {
  const onClose = vi.fn();
  const onReported = vi.fn();
  render(
    <ParkingDetail
      item={item}
      durationMinutes={60}
      isSignedIn={isSignedIn}
      now={RENDER_NOW}
      onClose={onClose}
      onReported={onReported}
    />,
  );
  return { onClose, onReported, user: userEvent.setup(), item };
};

beforeEach(() => {
  detailMock.mockReset();
  submitMock.mockReset();
  detailMock.mockReturnValue(detailResponse());
});

describe('ParkingDetail', () => {
  it('shows the name, address, availability and fee breakdown', async () => {
    const { item } = setup();

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(item.parking.name);
    expect(screen.getByText(item.parking.address)).toBeInTheDocument();
    expect(screen.getByTestId('availability-badge')).toHaveTextContent('空車');
    expect(screen.getByText('400円')).toBeInTheDocument();
    expect(screen.getByText(/終日 200円\/30分 × 2単位/)).toBeInTheDocument();
    await waitFor(() => expect(detailMock).toHaveBeenCalledWith(item.parking.id, expect.anything()));
  });

  it('renders applied caps and unpriced time', () => {
    const item = makeSearchItem();
    setup({
      ...item,
      fee: {
        ...item.fee,
        appliedCaps: [
          { id: 'cap', label: '24時間最大 1200円', capYen: 1200, rawYen: 3000, savedYen: 1800 },
        ],
        uncoveredMinutes: 90,
      },
    });

    expect(screen.getByText(/24時間最大 1200円 適用（-1,800円）/)).toBeInTheDocument();
    expect(screen.getByText(/1時間30分は料金が未登録/)).toBeInTheDocument();
  });

  it('says when no fee is registered', () => {
    const item = makeSearchItem();
    setup({ ...item, fee: { ...item.fee, blocks: [], totalYen: 0 } });

    expect(screen.getByText('料金情報が登録されていません。')).toBeInTheDocument();
  });

  it('lists the published vehicle limits and marks the unpublished ones', () => {
    setup(makeSearchItem());

    expect(screen.getByRole('row', { name: /全高/ })).toHaveTextContent('2100mm まで');
    expect(screen.getByRole('row', { name: /タイヤ幅/ })).toHaveTextContent('未公表');
  });

  it('summarises whether the car fits', () => {
    const item = makeSearchItem();
    setup({
      ...item,
      fit: {
        fits: false,
        violations: [{ dimension: 'height', limit: 1550, actual: 2285, unit: 'mm' }],
        unknownDimensions: [],
      },
    });

    expect(screen.getByTestId('detail-fit')).toHaveTextContent('駐車不可: 全高 2285mm > 1550mm');
  });

  it('shows the optional capacity, EV badge and official link only when present', () => {
    const item = makeSearchItem({
      parking: {
        sourceId: 'rich',
        capacity: 24,
        officialUrl: 'https://example.com/lot',
        features: {
          evCharging: true,
          hasRoof: false,
          cashless: true,
          open24h: true,
          accessible: false,
        },
      },
    });
    setup(item);

    expect(screen.getByText('24台')).toBeInTheDocument();
    expect(screen.getByText('EV充電')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '公式サイトで確認' })).toHaveAttribute(
      'href',
      'https://example.com/lot',
    );
  });

  it('omits the optional details when the operator publishes none', () => {
    setup(makeSearchItem({ parking: { sourceId: 'sparse', capacity: null } }));

    expect(screen.queryByText('EV充電')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '公式サイトで確認' })).not.toBeInTheDocument();
  });

  it('closes on request', async () => {
    const { onClose, user } = setup();

    await user.click(screen.getByRole('button', { name: '閉じる' }));

    expect(onClose).toHaveBeenCalled();
  });
});

describe('ParkingDetail report history', () => {
  it('shows a loading state and then the reports', async () => {
    detailMock.mockReturnValue(
      detailResponse([
        {
          id: 'r1',
          parkingId: 'p1',
          userId: 'u1',
          status: 'crowded',
          vacantCount: 1,
          note: '残り1台',
          createdAt: '2026-08-10T11:30:00.000Z',
        },
      ]),
    );

    setup();

    expect(await screen.findByText(/混雑/)).toBeInTheDocument();
    expect(screen.getByText(/30分前/)).toBeInTheDocument();
    expect(screen.getByText(/残り1台/)).toBeInTheDocument();
  });

  it('renders a report without a note', async () => {
    detailMock.mockReturnValue(
      detailResponse([
        {
          id: 'r1',
          parkingId: 'p1',
          userId: 'u1',
          status: 'full',
          vacantCount: null,
          note: null,
          createdAt: '2026-08-10T11:59:00.000Z',
        },
      ]),
    );

    setup();

    expect(await screen.findByText(/1分前/)).toBeInTheDocument();
  });

  it('says when there are no reports yet', async () => {
    setup();

    expect(await screen.findByText('まだ報告はありません。')).toBeInTheDocument();
  });

  it('surfaces a load failure', async () => {
    detailMock.mockRejectedValue(new Error('読み込みに失敗しました'));

    setup();

    expect(await screen.findByRole('alert')).toHaveTextContent('読み込みに失敗しました');
  });

  it('reloads the history and tells the parent after a new report', async () => {
    submitMock.mockResolvedValue({ report: null as never });
    const { onReported, user } = setup();

    await screen.findByText('まだ報告はありません。');
    detailMock.mockClear();

    await user.click(screen.getByRole('button', { name: '報告する' }));

    await waitFor(() => expect(onReported).toHaveBeenCalled());
    expect(detailMock).toHaveBeenCalled();
  });
});
