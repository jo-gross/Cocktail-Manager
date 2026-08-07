import { useTranslation } from 'react-i18next';

export default function LoadingText() {
  const { t } = useTranslation('common');

  return (
    <div className={'w-40 animate-pulse rounded bg-slate-700'}>
      {' '}
      <div className={'invisible'}>{t('loadingShort')}</div>
    </div>
  );
}
