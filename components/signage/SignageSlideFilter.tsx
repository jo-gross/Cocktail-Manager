import { DAY_ORDER_MONDAY_FIRST, getDayName } from '@lib/dayConstants';
import { SignageSlideFilterState } from '@lib/signage/types';
import { Button, FormControl, Input, Label, LabelText, Select } from '@components/ui';

interface SignageSlideFilterProps {
  value: SignageSlideFilterState;
  onChange: (value: SignageSlideFilterState) => void;
}

export function SignageSlideFilter({ value, onChange }: SignageSlideFilterProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-base-300/60 bg-base-100 p-3">
      <FormControl>
        <Label>
          <LabelText>Filter</LabelText>
        </Label>
        <Select
          value={value.mode}
          onChange={(event) =>
            onChange({
              ...value,
              mode: event.target.value as SignageSlideFilterState['mode'],
            })
          }
        >
          <option value="all">Alle</option>
          <option value="activeNow">Aktuell aktiv</option>
          <option value="weekday">Wochentag</option>
          <option value="dateRange">Zeitraum</option>
        </Select>
      </FormControl>

      {value.mode === 'weekday' ? (
        <div className="flex flex-wrap gap-1">
          {DAY_ORDER_MONDAY_FIRST.map((day) => (
            <Button
              key={day}
              type="button"
              size="sm"
              variant={value.weekday === day ? 'primary' : 'outline'}
              onClick={() => onChange({ ...value, weekday: day })}
            >
              {getDayName(day, true, true)}
            </Button>
          ))}
        </div>
      ) : null}

      {value.mode === 'dateRange' ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <FormControl>
            <Label>
              <LabelText>Von</LabelText>
            </Label>
            <Input type="date" value={value.dateFrom ?? ''} onChange={(event) => onChange({ ...value, dateFrom: event.target.value })} />
          </FormControl>
          <FormControl>
            <Label>
              <LabelText>Bis</LabelText>
            </Label>
            <Input type="date" value={value.dateTo ?? ''} onChange={(event) => onChange({ ...value, dateTo: event.target.value })} />
          </FormControl>
        </div>
      ) : null}
    </div>
  );
}
