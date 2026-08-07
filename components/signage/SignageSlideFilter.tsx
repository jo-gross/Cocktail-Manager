import { useTranslation } from 'react-i18next';
import { DAY_ORDER_MONDAY_FIRST, getDayName } from '@lib/dayConstants';
import { SignageSlideFilterState } from '@lib/signage/types';
import { Button, FormControl, Input, Label, LabelText, Select } from '@components/ui';

interface SignageSlideFilterProps {
  value: SignageSlideFilterState;
  onChange: (value: SignageSlideFilterState) => void;
}

export function SignageSlideFilter({ value, onChange }: SignageSlideFilterProps) {
  const { t } = useTranslation('monitor');

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-base-300/60 bg-base-100 p-3">
      <FormControl>
        <Label>
          <LabelText>{t('filter')}</LabelText>
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
          <option value="all">{t('all')}</option>
          <option value="activeNow">{t('currentlyActive')}</option>
          <option value="weekday">{t('weekday')}</option>
          <option value="dateRange">{t('timeRange')}</option>
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
              <LabelText>{t('from')}</LabelText>
            </Label>
            <Input type="date" value={value.dateFrom ?? ''} onChange={(event) => onChange({ ...value, dateFrom: event.target.value })} />
          </FormControl>
          <FormControl>
            <Label>
              <LabelText>{t('to')}</LabelText>
            </Label>
            <Input type="date" value={value.dateTo ?? ''} onChange={(event) => onChange({ ...value, dateTo: event.target.value })} />
          </FormControl>
        </div>
      ) : null}
    </div>
  );
}
