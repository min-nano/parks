'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { AvailabilityStatus } from '@/domain/types';
import { submitReport } from '@/lib/api-client';
import { AVAILABILITY_LABELS } from '@/lib/format';

const OPTIONS: Exclude<AvailabilityStatus, 'unknown'>[] = ['available', 'crowded', 'full'];

export type ReportFormProps = {
  parkingId: string;
  isSignedIn: boolean;
  onSubmitted: () => void;
};

export function ReportForm({ parkingId, isSignedIn, onSubmitted }: ReportFormProps) {
  const [status, setStatus] = useState<Exclude<AvailabilityStatus, 'unknown'>>('available');
  const [vacantCount, setVacantCount] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!isSignedIn) {
    return (
      <p className="report__signin">
        空き状況を報告するには<Link href="/sign-in">サインイン</Link>してください。
      </p>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const parsedCount = Number(vacantCount);
    try {
      await submitReport(parkingId, {
        status,
        vacantCount: vacantCount === '' || Number.isNaN(parsedCount) ? null : parsedCount,
        note: note.trim() === '' ? null : note.trim(),
      });
      setDone(true);
      setVacantCount('');
      setNote('');
      onSubmitted();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : '報告に失敗しました');
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="report" aria-label="空き状況を報告" onSubmit={handleSubmit}>
      <div className="report__statuses" role="group" aria-label="空き状況">
        {OPTIONS.map((option) => (
          <label key={option}>
            <input
              type="radio"
              name="status"
              value={option}
              checked={status === option}
              onChange={() => setStatus(option)}
            />
            {AVAILABILITY_LABELS[option]}
          </label>
        ))}
      </div>

      <label>
        空き台数（任意）
        <input
          type="number"
          min={0}
          value={vacantCount}
          onChange={(event) => setVacantCount(event.target.value)}
        />
      </label>

      <label>
        メモ（任意）
        <textarea
          maxLength={280}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      {error ? <p role="alert">{error}</p> : null}
      {done && error === null ? <p role="status">報告ありがとうございます。</p> : null}

      <button type="submit" disabled={pending}>
        {pending ? '送信中…' : '報告する'}
      </button>
    </form>
  );
}
