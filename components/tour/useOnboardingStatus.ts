import { useEffect, useState } from 'react';
import { fetchOnboardingStatus, type OnboardingStatus } from '@lib/network/onboarding';

/** Setup checklist of the workspace; `status` stays `null` if the API is unavailable (e.g. 404 on older servers). */
export function useOnboardingStatus(workspaceId: string | undefined, enabled = true) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!workspaceId || !enabled) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    fetchOnboardingStatus(workspaceId)
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch((error) => {
        console.debug('useOnboardingStatus', error);
        if (!cancelled) {
          setStatus(null);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, enabled]);

  return { status, setStatus, loading, failed };
}
