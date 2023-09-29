import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function App() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/').then();
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
