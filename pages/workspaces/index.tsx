import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useTranslation } from 'react-i18next';

export default function App() {
  const router = useRouter();
  const { t } = useTranslation('common');

  useEffect(() => {
    if (router.query.code) {
      router.replace(`/?code=${router.query.code}`).then();
    } else {
      router.replace('/').then();
    }
  }, [router]);

  return (
    <>
      <Head>
        <title>{t('redirecting')}</title>
      </Head>
      <div></div>
    </>
  );
}
