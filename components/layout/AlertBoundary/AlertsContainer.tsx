import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaExclamationTriangle, FaInfoCircle, FaTimes } from 'react-icons/fa';
import PropTypes from 'prop-types';
import { Alert, alertService, AlertType } from '../../../lib/alertService';

export { AlertsContainer };

AlertsContainer.propTypes = {
  id: PropTypes.string,
};

AlertsContainer.defaultProps = {
  id: 'default-alert',
};

interface AlertsContainerProps {
  id?: string;
  fade?: boolean;
}

const duration = 5000;

function AlertsContainer(props: AlertsContainerProps) {
  const { id } = props;
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
        <div key={index} className={`alert shadow-lg ${cssClasses(alert)}`}>
          {icon(alert)}
          <div>
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
          <div className="btn btn-ghost btn-sm text-md" onClick={() => removeAlert(alert)}>
            <FaTimes />
          </div>
        </div>
      ))}
    </div>
  );
}
