// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_FILTERS, type FilterState } from '@/lib/filters';

import { FilterPanel } from './FilterPanel';

const setup = (filters: FilterState = DEFAULT_FILTERS) => {
  const onChange = vi.fn();
  render(<FilterPanel filters={filters} onChange={onChange} />);
  return { onChange, user: userEvent.setup() };
};

describe('FilterPanel', () => {
  it('pre-fills the dimensions of the selected preset', () => {
    setup();

    expect(screen.getByLabelText('車種')).toHaveValue('compact');
    expect(screen.getByLabelText('全長 (mm)')).toHaveValue(4000);
    expect(screen.getByLabelText('タイヤ幅 (mm)')).toHaveValue(185);
  });

  it('swaps every dimension when the preset changes', async () => {
    const { onChange, user } = setup();

    await user.selectOptions(screen.getByLabelText('車種'), 'kei');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        presetId: 'kei',
        vehicle: expect.objectContaining({ lengthMm: 3400, heightMm: 1650 }),
      }),
    );
  });

  it('clears the vehicle filter when 指定なし is chosen', async () => {
    const { onChange, user } = setup();

    await user.selectOptions(screen.getByLabelText('車種'), '');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ vehicle: null, presetId: null }),
    );
  });

  it('hides the dimension inputs when no vehicle is selected', () => {
    setup({ ...DEFAULT_FILTERS, vehicle: null, presetId: null });

    expect(screen.queryByLabelText('全長 (mm)')).not.toBeInTheDocument();
  });

  it('lets a driver override a single dimension', async () => {
    const { onChange, user } = setup();

    await user.type(screen.getByLabelText('全高 (mm)'), '9');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ vehicle: expect.objectContaining({ heightMm: 15259 }) }),
    );
  });

  it('keeps the previous value when a required dimension is cleared', async () => {
    const { onChange, user } = setup();

    await user.clear(screen.getByLabelText('全長 (mm)'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ vehicle: expect.objectContaining({ lengthMm: 4000 }) }),
    );
  });

  it('renders an empty tyre width when the driver has not entered one', () => {
    setup({
      ...DEFAULT_FILTERS,
      vehicle: {
        lengthMm: 4000,
        widthMm: 1700,
        heightMm: 1500,
        weightKg: 1200,
        tireWidthMm: null,
      },
    });

    expect(screen.getByLabelText('タイヤ幅 (mm)')).toHaveValue(null);
    expect(screen.getByLabelText('全長 (mm)')).toHaveValue(4000);
  });

  it('allows the optional tyre width to be cleared', async () => {
    const { onChange, user } = setup();

    await user.clear(screen.getByLabelText('タイヤ幅 (mm)'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ vehicle: expect.objectContaining({ tireWidthMm: null }) }),
    );
  });

  it('updates the radius and the parking duration', async () => {
    const { onChange, user } = setup();

    await user.selectOptions(screen.getByLabelText('半径'), '1500');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ radiusMeters: 1500 }),
    );

    await user.selectOptions(screen.getByLabelText('駐車時間'), '180');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ durationMinutes: 180 }),
    );
  });

  it('selects a structure', async () => {
    const { onChange, user } = setup();

    await user.click(screen.getByLabelText('機械式'));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ structures: ['mechanical'] }),
    );
  });

  it('deselects a structure that is already on', async () => {
    const { onChange, user } = setup({ ...DEFAULT_FILTERS, structures: ['mechanical'] });

    await user.click(screen.getByLabelText('機械式'));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ structures: [] }));
  });

  it('toggles the EV and hide-full switches', async () => {
    const { onChange, user } = setup();

    await user.click(screen.getByLabelText('EV充電あり'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ requireEvCharging: true }),
    );

    await user.click(screen.getByLabelText('満車を除く'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ hideFull: true }));
  });

  it('never navigates away when the form is submitted', () => {
    setup();
    const form = screen.getByRole('form', { name: '検索条件' });

    // Results update as the filters change, so a submit must be swallowed.
    expect(fireEvent.submit(form)).toBe(false);
  });
});
