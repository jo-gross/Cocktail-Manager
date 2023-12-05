declare interface Date {
  withoutTime(): Date;
}

Date.prototype.withoutTime = function () {
  const d = new Date(this);
  d.setHours(0, 0, 0, 0);
  return d;
};
