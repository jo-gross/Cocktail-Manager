import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';
import { Alert as UiAlert } from '@components/ui';
import type { AlertVariant } from '@components/ui';
import { Alert, alertService, AlertType } from '@lib/alertService';

export { AlertsContainer };

interface AlertsContainerProps {
  id?: string;
  fade?: boolean;
}

const duration = 3000;

const alertVariantMap: Record<string, AlertVariant> = {
  [AlertType.Success]: 'success',
  [AlertType.Error]: 'error',
  [AlertType.Info]: 'info',
  [AlertType.Warning]: 'warning',
};

function AlertsContainer({ id = 'default-alert', fade: _fade }: AlertsContainerProps) {
  const mounted = useRef(false);
  const router = useRouter();

  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    mounted.current = true;

    // subscribe to new alert notifications
    const subscription = alertService.onAlert(id).subscribe((alert: Alert) => {
      // clear alerts when an empty alert is received
      if (!alert.message) {
        setAlerts([]);
      } else {
        // add alert to array with unique id
        alert.itemId = Math.random();
        setAlerts((alerts) => [...alerts, alert]);

        setTimeout(() => removeAlert(alert), duration);
      }
    });

    // clear alerts on location change
    const clearAlerts = () => alertService.clear(id);
    router.events.on('routeChangeStart', clearAlerts);

    // clean up function that runs when the component unmounts
    return () => {
      mounted.current = false;

      // unsubscribe to avoid memory leaks
      subscription.unsubscribe();
      router.events.off('routeChangeStart', clearAlerts);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function removeAlert(alert: Alert) {
    if (!mounted.current) return;

    setAlerts((alerts) => alerts.filter((x) => x.itemId !== alert.itemId));
  }

  function icon(alert: Alert) {
    const icons = {
      [AlertType.Success]: <FaCheckCircle />,
      [AlertType.Error]: <FaExclamationCircle />,
      [AlertType.Info]: <FaInfoCircle />,
      [AlertType.Warning]: <FaExclamationTriangle />,
    };

    return icons[alert.type];
  }

  if (!alerts.length) return null;

  return (
    <div className="space-y-2">
      {alerts.reverse().map((alert, index) => (
        <UiAlert key={index} variant={alertVariantMap[alert.type]} icon={icon(alert)} className="w-fit items-center">
          <div>
            {alert.status != undefined ? (
              <span className={'font-bold'}>
                {alert.status} {alert.statusText} -{' '}
              </span>
            ) : null}
            <span>{alert.message}</span>
          </div>
        </UiAlert>
      ))}
    </div>
  );
}
