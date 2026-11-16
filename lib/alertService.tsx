import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { installPageLifecycleTracking, waitForPageToStay } from './pageLifecycle';

// Must run before the first failure: an unload signal is only seen by an installed listener.
installPageLifecycleTracking();

export const alertService = {
  onAlert,
  success,
  error,
  info,
  warn,
  alert,
  clear,
};

export const AlertType = {
  Success: 'Success',
  Error: 'Error',
  Info: 'Info',
  Warning: 'Warning',
};

export interface Alert {
  alertContainerId: string;
  itemId: number;
  status?: number;
  statusText?: string;
  message: string;
  type: string;
}

const alertSubject = new Subject<Alert>();
const defaultId = 'default-alert';

/** Same as the display duration of AlertsContainer: an identical error that is still visible is not stacked again. */
export const DUPLICATE_ERROR_WINDOW_MS = 3000;
const lastErrorShownAt = new Map<string, number>();

/** Records the error and tells whether an identical one was shown within {@link DUPLICATE_ERROR_WINDOW_MS}. */
export function isDuplicateError(key: string, now: number = Date.now()): boolean {
  const last = lastErrorShownAt.get(key);
  if (last != undefined && now - last < DUPLICATE_ERROR_WINDOW_MS) return true;
  lastErrorShownAt.set(key, now);
  return false;
}

// enable subscribing to alerts observable
function onAlert(id = defaultId) {
  return alertSubject.asObservable().pipe(filter((x: Alert) => x && x.alertContainerId === id));
}

// convenience methods
function success(message: string, options?: Partial<Omit<Alert, 'message' | 'type'>>) {
  alert({ alertContainerId: defaultId, itemId: 0, ...options, type: AlertType.Success, message });
}

// Errors wait for the unload grace period: requests cancelled by a reload/navigation (login redirect,
// demo login reload) fail right before the page goes away and must not flash alerts.
function error(message: string, status?: number, statusText?: string, options?: Partial<Omit<Alert, 'message' | 'type'>>) {
  const raisedAt = Date.now();
  void waitForPageToStay(raisedAt).then((pageStays) => {
    if (!pageStays) return;
    const alertContainerId = options?.alertContainerId ?? defaultId;
    // Parallel loads failing for the same reason report one alert, not one per request
    if (isDuplicateError(`${alertContainerId}|${status ?? ''}|${statusText ?? ''}|${message}`)) return;
    alert({ alertContainerId: defaultId, itemId: 0, ...options, type: AlertType.Error, status: status, statusText: statusText, message: message });
  });
}

function info(message: string, options?: Partial<Omit<Alert, 'message' | 'type'>>) {
  alert({ alertContainerId: defaultId, itemId: 0, ...options, type: AlertType.Info, message });
}

function warn(message: string, options?: Partial<Omit<Alert, 'message' | 'type'>>) {
  alert({ alertContainerId: defaultId, itemId: 0, ...options, type: AlertType.Warning, message });
}

// core alert method
function alert(alert: Alert) {
  alert.alertContainerId = alert.alertContainerId || defaultId;
  alertSubject.next(alert);
}

// clear alerts
function clear(id = defaultId) {
  alertSubject.next({ alertContainerId: id } as Alert);
}
