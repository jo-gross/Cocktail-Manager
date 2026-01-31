import 'react';

declare global {
  interface Date {
    withoutTime(): Date;

    toFormatDateTimeString(): String;

    toFormatDateTimeShort(): String;

    toFormatTimeString(): String;

    toFormatDateString(): String;

    toFormatDateStringShort(): String;

    toFormatDateStringNoYear(): String;
  }
}

Date.prototype.withoutTime = function () {
  const d = new Date(this);
  d.setHours(0, 0, 0, 0);
  return d;
};

Date.prototype.toFormatDateTimeString = function () {
  // format date to dd.mm.yyyy hh:mm
  const d = new Date(this);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
};

Date.prototype.toFormatDateTimeShort = function () {
  // format date to dd.mm.yyyy hh:mm
  const d = new Date(this);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${day}.${month}. ${hours}:${minutes}`;
};

Date.prototype.toFormatDateString = function () {
  // format date to dd.mm.yyyy
  const d = new Date(this);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};

/** Format date as dd.MM.yy (2-digit year) */
Date.prototype.toFormatDateStringShort = function () {
  const d = new Date(this);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear() % 100;
  return `${day}.${month}.${year.toString().padStart(2, '0')}`;
};

/** Format date as dd.MM. (no year, for same-year range start) */
Date.prototype.toFormatDateStringNoYear = function () {
  const d = new Date(this);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${day}.${month}.`;
};

Date.prototype.toFormatTimeString = function () {
  // format date to hh:mm
  const d = new Date(this);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};
