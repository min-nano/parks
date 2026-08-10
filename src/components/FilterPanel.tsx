'use client';

import { PARKING_STRUCTURES, type ParkingStructure, type VehicleSpec } from '@/domain/types';
import { VEHICLE_PRESETS } from '@/domain/vehicle';
import { presetFilters, toggleStructure, type FilterState } from '@/lib/filters';
import { formatDuration } from '@/lib/format';

export const STRUCTURE_LABELS: Record<ParkingStructure, string> = {
  flat: '平面',
  mechanical: '機械式',
  multistory: '立体',
  underground: '地下',
  roadside: '路上',
};

const RADIUS_OPTIONS = [300, 500, 800, 1500, 3000];
const DURATION_OPTIONS = [30, 60, 120, 180, 360, 720, 1440];

const DIMENSION_FIELDS = [
  { key: 'lengthMm', label: '全長 (mm)' },
  { key: 'widthMm', label: '全幅 (mm)' },
  { key: 'heightMm', label: '全高 (mm)' },
  { key: 'weightKg', label: '重量 (kg)' },
  { key: 'tireWidthMm', label: 'タイヤ幅 (mm)' },
] as const;

/** Rendered only once a vehicle is selected, so `vehicle` is always present. */
function VehicleDimensions({
  vehicle,
  onChange,
}: {
  vehicle: VehicleSpec;
  onChange: (vehicle: VehicleSpec) => void;
}) {
  const handle = (key: (typeof DIMENSION_FIELDS)[number]['key'], raw: string) => {
    const parsed = Number(raw);
    const value = raw === '' || Number.isNaN(parsed) ? null : Math.round(parsed);

    onChange({
      ...vehicle,
      // Only the tyre width is optional; the rest keep their previous value so a
      // half-typed number never silently widens the search.
      [key]: key === 'tireWidthMm' ? value : (value ?? vehicle[key]),
    });
  };

  return (
    <div className="filters__dimensions">
      {DIMENSION_FIELDS.map((field) => (
        <label key={field.key}>
          {field.label}
          <input
            type="number"
            min={1}
            value={vehicle[field.key] ?? ''}
            onChange={(event) => handle(field.key, event.target.value)}
          />
        </label>
      ))}
    </div>
  );
}

export type FilterPanelProps = {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
};

export function FilterPanel({ filters, onChange }: FilterPanelProps) {
  const handlePreset = (presetId: string) => {
    onChange({
      ...filters,
      ...(presetId === '' ? { vehicle: null, presetId: null } : presetFilters(presetId)),
    });
  };

  return (
    <form className="filters" aria-label="検索条件" onSubmit={(event) => event.preventDefault()}>
      <fieldset>
        <legend>自車の情報</legend>
        <label>
          車種
          <select
            value={filters.presetId ?? ''}
            onChange={(event) => handlePreset(event.target.value)}
          >
            <option value="">指定なし（すべて表示）</option>
            {VEHICLE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        {filters.vehicle ? (
          <VehicleDimensions
            vehicle={filters.vehicle}
            onChange={(vehicle) => onChange({ ...filters, vehicle })}
          />
        ) : null}
      </fieldset>

      <fieldset>
        <legend>検索範囲</legend>
        <label>
          半径
          <select
            value={filters.radiusMeters}
            onChange={(event) =>
              onChange({ ...filters, radiusMeters: Number(event.target.value) })
            }
          >
            {RADIUS_OPTIONS.map((radius) => (
              <option key={radius} value={radius}>
                {radius}m
              </option>
            ))}
          </select>
        </label>

        <label>
          駐車時間
          <select
            value={filters.durationMinutes}
            onChange={(event) =>
              onChange({ ...filters, durationMinutes: Number(event.target.value) })
            }
          >
            {DURATION_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatDuration(minutes)}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>駐車場のタイプ</legend>
        <div className="filters__checks">
          {PARKING_STRUCTURES.map((structure) => (
            <label key={structure}>
              <input
                type="checkbox"
                checked={filters.structures.includes(structure)}
                onChange={() =>
                  onChange({
                    ...filters,
                    structures: toggleStructure(filters.structures, structure),
                  })
                }
              />
              {STRUCTURE_LABELS[structure]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>その他</legend>
        <div className="filters__checks">
          <label>
            <input
              type="checkbox"
              checked={filters.requireEvCharging}
              onChange={(event) =>
                onChange({ ...filters, requireEvCharging: event.target.checked })
              }
            />
            EV充電あり
          </label>
          <label>
            <input
              type="checkbox"
              checked={filters.hideFull}
              onChange={(event) => onChange({ ...filters, hideFull: event.target.checked })}
            />
            満車を除く
          </label>
        </div>
      </fieldset>
    </form>
  );
}
