import 'react';

declare global {
  interface String {
    string2color(): string;
  }
}

String.prototype.string2color = function () {
  let hash = Math.random();
  this.split('').forEach((char) => {
    hash = char.charCodeAt(0) + ((hash << 5) - hash);
  });
  let colour = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    colour += value.toString(16).padStart(2, '0');
  }
  return colour;
};
