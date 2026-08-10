// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { submitReport } from '@/lib/api-client';

import { ReportForm } from './ReportForm';

vi.mock('@/lib/api-client', () => ({ submitReport: vi.fn() }));

const submitMock = vi.mocked(submitReport);

const setup = (isSignedIn = true) => {
  const onSubmitted = vi.fn();
  render(<ReportForm parkingId="p1" isSignedIn={isSignedIn} onSubmitted={onSubmitted} />);
  return { onSubmitted, user: userEvent.setup() };
};

beforeEach(() => {
  submitMock.mockReset();
  submitMock.mockResolvedValue({
    report: {
      id: 'r1',
      parkingId: 'p1',
      userId: 'u1',
      status: 'full',
      vacantCount: null,
      note: null,
      createdAt: '2026-08-10T12:00:00.000Z',
    },
  });
});

describe('ReportForm', () => {
  it('asks anonymous visitors to sign in', () => {
    setup(false);

    expect(screen.getByRole('link', { name: 'サインイン' })).toHaveAttribute('href', '/sign-in');
    expect(screen.queryByRole('button', { name: '報告する' })).not.toBeInTheDocument();
  });

  it('submits 空車 by default with no optional fields', async () => {
    const { onSubmitted, user } = setup();

    await user.click(screen.getByRole('button', { name: '報告する' }));

    expect(submitMock).toHaveBeenCalledWith('p1', {
      status: 'available',
      vacantCount: null,
      note: null,
    });
    expect(onSubmitted).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('報告ありがとうございます');
  });

  it('sends the chosen status, count and trimmed note', async () => {
    const { user } = setup();

    await user.click(screen.getByLabelText('満車'));
    await user.type(screen.getByLabelText('空き台数（任意）'), '0');
    await user.type(screen.getByLabelText('メモ（任意）'), '  行列あり  ');
    await user.click(screen.getByRole('button', { name: '報告する' }));

    expect(submitMock).toHaveBeenCalledWith('p1', {
      status: 'full',
      vacantCount: 0,
      note: '行列あり',
    });
  });

  it('clears the optional fields after a successful report', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText('空き台数（任意）'), '3');
    await user.click(screen.getByRole('button', { name: '報告する' }));

    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(screen.getByLabelText('空き台数（任意）')).toHaveValue(null);
    expect(screen.getByLabelText('メモ（任意）')).toHaveValue('');
  });

  it('surfaces a failure and keeps the form usable', async () => {
    submitMock.mockRejectedValue(new Error('sign in required'));
    const { onSubmitted, user } = setup();

    await user.click(screen.getByRole('button', { name: '報告する' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('sign in required');
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '報告する' })).toBeEnabled();
  });

  it('falls back to a generic message for a non-Error rejection', async () => {
    submitMock.mockRejectedValue('boom');
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: '報告する' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('報告に失敗しました');
  });

  it('disables the button while the request is in flight', async () => {
    let resolve: (() => void) | undefined;
    submitMock.mockReturnValue(
      new Promise((done) => {
        resolve = () => done({ report: null as never });
      }),
    );
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: '報告する' }));

    expect(screen.getByRole('button', { name: '送信中…' })).toBeDisabled();
    resolve?.();
    expect(await screen.findByRole('button', { name: '報告する' })).toBeEnabled();
  });
});
