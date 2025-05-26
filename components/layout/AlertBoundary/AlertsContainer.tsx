import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';
import PropTypes from 'prop-types';
import { Alert, alertService, AlertType } from '@lib/alertService';

export { AlertsContainer };

AlertsContainer.propTypes = {
  id: PropTypes.string,
};

interface AlertsContainerProps {
  id?: string;
  fade?: boolean;
}

const duration = 3000;

function AlertsContainer({ id = 'default-alert', fade }: AlertsContainerProps) {
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

  function cssClasses(alert: Alert) {
    const classes = ['alert-dismissible'];

    const alertTypeClass = {
      [AlertType.Success]: 'alert-success',
      [AlertType.Error]: 'alert-error',
      [AlertType.Info]: 'alert-info',
      [AlertType.Warning]: 'alert-warning',
    };

    classes.push(alertTypeClass[alert.type]);

    return classes.join(' ');
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
        <div role={'alert'} key={index} className={`alert flex w-fit flex-row justify-between ${cssClasses(alert)}`}>
          <div className={'w-10 p-2'}>{icon(alert)}</div>
          <div className={''}>
            <>
              {alert.status != undefined ? (
                <span className={'font-bold'}>
                  {alert.status} {alert.statusText} -{' '}
                </span>
              ) : (
                <></>
              )}
              <span>{alert.message}</span>
            </>
          </div>
          {/*TODO Enable after sync with open modal container and alertboundary container*/}
          {/*<div className="text-md btn btn-square btn-ghost btn-sm justify-self-end" onClick={() => removeAlert(alert)}>*/}
          {/*  <FaTimes />*/}
          {/*</div>*/}
          <div className={'pr-2'}></div>
        </div>
      ))}
    </div>
  );
}
