import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function App() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/').then();
  }, [router]);

  return null;
}
