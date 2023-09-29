import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

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

// enable subscribing to alerts observable
function onAlert(id = defaultId) {
  return alertSubject.asObservable().pipe(filter((x: Alert) => x && x.alertContainerId === id));
}

// convenience methods
function success(message: string, options?: any) {
  alert({ ...options, type: AlertType.Success, message });
}

function error(message: string, status?: number, statusText?: string, options?: any) {
  alert({ ...options, type: AlertType.Error, status: status, statusText: statusText, message: message });
}

function info(message: string, options?: any) {
  alert({ ...options, type: AlertType.Info, message });
}

function warn(message: string, options?: any) {
  alert({ ...options, type: AlertType.Warning, message });
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
