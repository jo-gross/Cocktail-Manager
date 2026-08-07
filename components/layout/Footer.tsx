import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation('common');

  return (
    <div className={'flex items-center gap-2'}>
      <span>{t('byAuthor')}</span>
      <Link className={'font-bold text-primary underline-offset-2 hover:underline'} href={''}>
        {t('authorName')}
      </Link>
    </div>
  );
}
