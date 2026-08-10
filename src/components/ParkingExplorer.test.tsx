// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchParkingDetail, searchParkings, submitReport } from '@/lib/api-client';
import { makeSearchItem } from '@/test/search-items';

import { ParkingExplorer } from './ParkingExplorer';

vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  searchParkings: vi.fn(),
  fetchParkingDetail: vi.fn(),
  submitReport: vi.fn(),
}));

vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Map: ({ children }: { children?: ReactNode }) => <div data-testid="map">{children}</div>,
  AdvancedMarker: ({ title, onClick }: { title: string; onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      {title}
    </button>
  ),
  Pin: () => <span />,
}));

const searchMock = vi.mocked(searchParkings);
const detailMock = vi.mocked(fetchParkingDetail);
const submitMock = vi.mocked(submitReport);

const CENTER = { lat: 35.658, lng: 139.7016 };
const ITEM = makeSearchItem({ parking: { sourceId: 'explorer-1', name: '渋谷デモパーク' } });

/** The name appears twice — once in the list, once as a map marker. */
const waitForResults = () => screen.findByRole('list', { name: '検索結果' });

const listButton = async () =>
  within(await waitForResults()).getByRole('button', { name: /渋谷デモパーク/ });

const markerButton = () =>
  within(screen.getByTestId('map')).getByRole('button', { name: '渋谷デモパーク' });

const setup = (isSignedIn = false) => {
  render(
    <ParkingExplorer
      googleMapsApiKey="key-123"
      mapId="DEMO_MAP_ID"
      initialCenter={CENTER}
      isSignedIn={isSignedIn}
    />,
  );
  return userEvent.setup();
};

beforeEach(() => {
  searchMock.mockReset();
  detailMock.mockReset();
  submitMock.mockReset();
  searchMock.mockResolvedValue({ items: [ITEM], count: 1 } as never);
  detailMock.mockResolvedValue({ reports: [] } as never);
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'geolocation');
});

const stubGeolocation = (value: unknown) => {
  Object.defineProperty(navigator, 'geolocation', { value, configurable: true });
};

describe('ParkingExplorer', () => {
  it('shows a loading state and then the results', async () => {
    setup();

    expect(screen.getByRole('status')).toHaveTextContent('検索中…');
    expect(await listButton()).toBeInTheDocument();
  });

  it('surfaces a search failure', async () => {
    searchMock.mockRejectedValue(new Error('invalid search query'));
    setup();

    expect(await screen.findByRole('alert')).toHaveTextContent('invalid search query');
  });

  it('re-searches when a filter changes', async () => {
    const user = setup();
    await waitForResults();

    await user.selectOptions(screen.getByLabelText('半径'), '1500');

    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(2));
    expect(searchMock.mock.calls[1]?.[1]).toMatchObject({ radiusMeters: 1500 });
  });

  it('refreshes on demand', async () => {
    const user = setup();
    await waitForResults();

    await user.click(screen.getByRole('button', { name: '最新の情報に更新' }));

    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(2));
  });

  it('opens and closes the detail panel from the list', async () => {
    const user = setup();

    await user.click(await listButton());
    expect(await screen.findByRole('region', { name: /の詳細/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '閉じる' }));
    expect(screen.queryByRole('region', { name: /の詳細/ })).not.toBeInTheDocument();
  });

  it('opens the detail panel from a map marker', async () => {
    const user = setup();
    await waitForResults();

    await user.click(markerButton());

    expect(await screen.findByRole('region', { name: /の詳細/ })).toBeInTheDocument();
  });

  it('lets a signed-in user report and then refreshes the list', async () => {
    submitMock.mockResolvedValue({ report: null as never });
    const user = setup(true);

    await user.click(await listButton());
    await user.click(await screen.findByRole('button', { name: '報告する' }));

    await waitFor(() => expect(submitMock).toHaveBeenCalledWith(ITEM.parking.id, expect.anything()));
    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(2));
  });

  it('asks a signed-out visitor to sign in before reporting', async () => {
    const user = setup(false);

    await user.click(await listButton());

    expect(await screen.findByRole('link', { name: 'サインイン' })).toBeInTheDocument();
  });

  it('re-centres on the driver location', async () => {
    stubGeolocation({
      getCurrentPosition: (onSuccess: PositionCallback) =>
        onSuccess({ coords: { latitude: 34.7, longitude: 135.5 } } as GeolocationPosition),
    });
    const user = setup();
    await waitForResults();

    await user.click(screen.getByRole('button', { name: '現在地から探す' }));

    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(2));
    expect(searchMock.mock.calls[1]?.[0]).toEqual({ lat: 34.7, lng: 135.5 });
  });

  it('reports a geolocation failure', async () => {
    stubGeolocation({
      getCurrentPosition: (_onSuccess: PositionCallback, onError: PositionErrorCallback) =>
        onError({ code: 1 } as GeolocationPositionError),
    });
    const user = setup();
    await waitForResults();

    await user.click(screen.getByRole('button', { name: '現在地から探す' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('現在地を取得できませんでした。');
  });

  it('explains when the device has no geolocation at all', async () => {
    stubGeolocation(undefined);
    const user = setup();
    await waitForResults();

    await user.click(screen.getByRole('button', { name: '現在地から探す' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'この端末では現在地を取得できません。',
    );
  });
});
