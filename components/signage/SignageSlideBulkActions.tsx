import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DAY_ORDER_MONDAY_FIRST, getDayName } from '@lib/dayConstants';
import { Button, Checkbox, FormControl, Input, Label, LabelText } from '@components/ui';

interface SignageSlideBulkActionsProps {
  selectedCount: number;
  onApply: (payload: { weekdays: number[]; validFrom: string | null; validTo: string | null; dateExclusive: boolean }) => Promise<void>;
  onDisable: () => Promise<void>;
  onEnable: () => Promise<void>;
  onClearSelection: () => void;
}

export function SignageSlideBulkActions({ selectedCount, onApply, onDisable, onEnable, onClearSelection }: SignageSlideBulkActionsProps) {
  const { t } = useTranslation(['monitor', 'common']);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [dateExclusive, setDateExclusive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (selectedCount === 0) {
    return null;
  }

  const toggleWeekday = (day: number) => {
    setWeekdays((current) => (current.includes(day) ? current.filter((value) => value !== day) : [...current, day]));
  };

  const handleApply = async () => {
    setSubmitting(true);
    try {
      await onApply({
        weekdays,
        validFrom: validFrom || null,
        validTo: validTo || null,
        dateExclusive,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="text-sm font-medium">{t('monitor:slidesSelected', { count: selectedCount })}</div>

      <div className="flex flex-wrap gap-1">
        {DAY_ORDER_MONDAY_FIRST.map((day) => (
          <Button key={day} type="button" size="sm" variant={weekdays.includes(day) ? 'primary' : 'outline'} onClick={() => toggleWeekday(day)}>
            {getDayName(day, true, true)}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <FormControl>
          <Label>
            <LabelText>{t('monitor:startDate')}</LabelText>
          </Label>
          <Input type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
        </FormControl>
        <FormControl>
          <Label>
            <LabelText>{t('monitor:endDate')}</LabelText>
          </Label>
          <Input type="date" value={validTo} onChange={(event) => setValidTo(event.target.value)} />
        </FormControl>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <Checkbox checked={dateExclusive} onChange={() => setDateExclusive((current) => !current)} />
        <span>
          {t('monitor:exclusivePeriod')}
          <span className="mt-0.5 block text-xs text-base-content/60">{t('monitor:exclusivePeriodHelp')}</span>
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" size="sm" disabled={submitting} onClick={handleApply}>
          {t('monitor:apply')}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={onEnable}>
          {t('monitor:activate')}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={onDisable}>
          {t('monitor:deactivate')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClearSelection}>
          {t('monitor:clearSelection')}
        </Button>
      </div>
    </div>
  );
}
