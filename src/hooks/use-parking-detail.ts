'use client';

import { useEffect, useState } from 'react';

import { fetchParkingDetail, type ParkingDetailResponse } from '@/lib/api-client';

export type DetailState = {
  status: 'loading' | 'ready' | 'error';
  data: ParkingDetailResponse | null;
  error: string | null;
};

/** Loads the report history for the selected lot; `nonce` forces a re-read. */
export function useParkingDetail(parkingId: string, nonce = 0): DetailState {
  const [state, setState] = useState<DetailState>({
    status: 'loading',
    data: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    // Fetching is exactly the kind of external synchronisation effects are for,
    // and the pending state has to be visible before the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((previous) => ({ ...previous, status: 'loading', error: null }));

    fetchParkingDetail(parkingId, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({ status: 'ready', data, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          data: null,
          error: error instanceof Error ? error.message : '読み込みに失敗しました',
        });
      });

    return () => controller.abort();
  }, [parkingId, nonce]);

  return state;
}
