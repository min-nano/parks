// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchParkingDetail } from '@/lib/api-client';

import { useParkingDetail } from './use-parking-detail';

vi.mock('@/lib/api-client', () => ({ fetchParkingDetail: vi.fn() }));

const detailMock = vi.mocked(fetchParkingDetail);
const payload = { reports: [] } as never;

beforeEach(() => {
  detailMock.mockReset();
});

describe('useParkingDetail', () => {
  it('loads the detail for the given parking', async () => {
    detailMock.mockResolvedValue(payload);

    const { result } = renderHook(() => useParkingDetail('p1'));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data).toBe(payload);
    expect(detailMock).toHaveBeenCalledWith('p1', expect.anything());
  });

  it('reloads when the nonce changes', async () => {
    detailMock.mockResolvedValue(payload);
    const { rerender } = renderHook(({ nonce }) => useParkingDetail('p1', nonce), {
      initialProps: { nonce: 0 },
    });

    await waitFor(() => expect(detailMock).toHaveBeenCalledTimes(1));
    rerender({ nonce: 1 });

    await waitFor(() => expect(detailMock).toHaveBeenCalledTimes(2));
  });

  it('surfaces an error', async () => {
    detailMock.mockRejectedValue(new Error('parking not found'));

    const { result } = renderHook(() => useParkingDetail('p1'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('parking not found');
  });

  it('falls back to a generic message for a non-Error rejection', async () => {
    detailMock.mockRejectedValue('boom');

    const { result } = renderHook(() => useParkingDetail('p1'));

    await waitFor(() => expect(result.current.error).toBe('読み込みに失敗しました'));
  });

  it('ignores a resolution that arrives after the request was aborted', async () => {
    let resolveStale: ((value: never) => void) | undefined;
    detailMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStale = resolve;
        }),
    );
    detailMock.mockResolvedValue(payload);

    const { result, rerender } = renderHook(({ id }) => useParkingDetail(id), {
      initialProps: { id: 'p1' },
    });

    rerender({ id: 'p2' });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => resolveStale?.({ reports: [{ id: 'stale' }] } as never));
    expect(result.current.data).toBe(payload);
  });

  it('ignores a rejection that arrives after the request was aborted', async () => {
    let rejectStale: ((reason: unknown) => void) | undefined;
    detailMock.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectStale = reject;
        }),
    );
    detailMock.mockResolvedValue(payload);

    const { result, rerender } = renderHook(({ id }) => useParkingDetail(id), {
      initialProps: { id: 'p1' },
    });

    rerender({ id: 'p2' });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => rejectStale?.(new Error('aborted')));
    expect(result.current.status).toBe('ready');
  });
});
