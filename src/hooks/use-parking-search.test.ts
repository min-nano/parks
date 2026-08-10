// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, searchParkings } from '@/lib/api-client';
import { DEFAULT_FILTERS } from '@/lib/filters';
import { makeSearchItem } from '@/test/search-items';

import { useParkingSearch } from './use-parking-search';

vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  searchParkings: vi.fn(),
}));

const searchMock = vi.mocked(searchParkings);

const CENTER = { lat: 35.658, lng: 139.7016 };
const response = (items: ReturnType<typeof makeSearchItem>[]) =>
  ({ items, count: items.length }) as never;

beforeEach(() => {
  searchMock.mockReset();
});

describe('useParkingSearch', () => {
  it('starts loading and settles into results', async () => {
    const item = makeSearchItem({ parking: { sourceId: 'hook-1' } });
    searchMock.mockResolvedValue(response([item]));

    const { result } = renderHook(() => useParkingSearch(CENTER, DEFAULT_FILTERS));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.items).toEqual([item]);
    expect(result.current.error).toBeNull();
  });

  it('surfaces an API error', async () => {
    searchMock.mockRejectedValue(new ApiError(400, 'invalid search query'));

    const { result } = renderHook(() => useParkingSearch(CENTER, DEFAULT_FILTERS));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('invalid search query');
    expect(result.current.items).toEqual([]);
  });

  it('falls back to a generic message for a non-Error rejection', async () => {
    searchMock.mockRejectedValue('boom');

    const { result } = renderHook(() => useParkingSearch(CENTER, DEFAULT_FILTERS));

    await waitFor(() => expect(result.current.error).toBe('検索に失敗しました'));
  });

  it('re-runs the search on refresh', async () => {
    searchMock.mockResolvedValue(response([]));
    const { result } = renderHook(() => useParkingSearch(CENTER, DEFAULT_FILTERS));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.refresh());

    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(2));
  });

  it('re-runs when the centre moves', async () => {
    searchMock.mockResolvedValue(response([]));
    const { rerender } = renderHook(({ center }) => useParkingSearch(center, DEFAULT_FILTERS), {
      initialProps: { center: CENTER },
    });

    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(1));
    rerender({ center: { lat: 34.7, lng: 135.5 } });

    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(2));
  });

  it('never lets a superseded response overwrite a newer one', async () => {
    const stale = makeSearchItem({ parking: { sourceId: 'stale' } });
    const fresh = makeSearchItem({ parking: { sourceId: 'fresh' } });

    let resolveStale: ((value: never) => void) | undefined;
    searchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStale = resolve;
        }),
    );
    searchMock.mockResolvedValue(response([fresh]));

    const { result, rerender } = renderHook(
      ({ center }) => useParkingSearch(center, DEFAULT_FILTERS),
      { initialProps: { center: CENTER } },
    );

    rerender({ center: { lat: 34.7, lng: 135.5 } });
    await waitFor(() => expect(result.current.items).toEqual([fresh]));

    act(() => resolveStale?.(response([stale])));
    await waitFor(() => expect(result.current.items).toEqual([fresh]));
  });

  it('ignores a rejection from an aborted request', async () => {
    let rejectStale: ((reason: unknown) => void) | undefined;
    searchMock.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectStale = reject;
        }),
    );
    searchMock.mockResolvedValue(response([]));

    const { result, rerender } = renderHook(
      ({ center }) => useParkingSearch(center, DEFAULT_FILTERS),
      { initialProps: { center: CENTER } },
    );

    rerender({ center: { lat: 34.7, lng: 135.5 } });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => rejectStale?.(new Error('aborted')));
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });
});
