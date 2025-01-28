import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function App() {
  const router = useRouter();

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
        <title>Leite weiter...</title>
      </Head>
      <div></div>
    </>
  );
}
