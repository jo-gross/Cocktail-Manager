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

export function normalizeString(s: string | undefined): string {
  if (s == undefined) {
    return '';
  }
  // https://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
