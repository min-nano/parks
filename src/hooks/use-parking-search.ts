'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ParkingSearchItem } from '@/db/repository';
import type { LatLng } from '@/domain/types';
import { ApiError, searchParkings } from '@/lib/api-client';
import type { FilterState } from '@/lib/filters';

export type SearchState = {
  status: 'loading' | 'ready' | 'error';
  items: ParkingSearchItem[];
  error: string | null;
  /**
   * When the current results were produced. Relative timestamps ("5分前") are
   * rendered against this so every row in a result set agrees, and so a
   * re-render on its own cannot shift them.
   */
  updatedAt: Date;
};

/**
 * Keeps the result list in sync with the map centre and the filter panel.
 *
 * Every run supersedes the previous one: the in-flight request is aborted so a
 * slow response for an old viewport can never overwrite a newer result.
 */
export function useParkingSearch(center: LatLng, filters: FilterState) {
  const [state, setState] = useState<SearchState>(() => ({
    status: 'loading',
    items: [],
    error: null,
    updatedAt: new Date(),
  }));
  const [nonce, setNonce] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    // Fetching is exactly the kind of external synchronisation effects are for,
    // and the pending state has to be visible before the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((previous) => ({ ...previous, status: 'loading', error: null }));

    searchParkings(center, filters, { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'ready',
          items: response.items,
          error: null,
          updatedAt: new Date(),
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          error instanceof ApiError || error instanceof Error
            ? error.message
            : '検索に失敗しました';
        setState({ status: 'error', items: [], error: message, updatedAt: new Date() });
      });

    return () => controller.abort();
    // `filters` is replaced wholesale by the panel, so identity is the right key.
  }, [center, filters, nonce]);

  return { ...state, refresh };
}
