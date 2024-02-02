import 'react';

declare global {
  interface Date {
    withoutTime(): Date;

    toFormatDateTimeString(): String;

    toFormatDateString(): String;
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

Date.prototype.toFormatDateString = function () {
  // format date to dd.mm.yyyy hh:mm
  const d = new Date(this);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};
