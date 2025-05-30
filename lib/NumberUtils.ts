import 'react';

interface FormatProps {
  signDisplay?: 'always' | 'auto' | 'exceptZero' | 'negative' | 'never';
}

declare global {
  interface Number {
    formatPriceEfficent(props?: FormatProps): String;
    formatPrice(props?: FormatProps): String;
  }
}

Number.prototype.formatPriceEfficent = function (props: FormatProps) {
  return (Math.round(this.valueOf() * 10 ** 2) / 10 ** 2).toLocaleString(undefined, {
    signDisplay: props?.signDisplay,
    minimumFractionDigits: this.valueOf() % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

Number.prototype.formatPrice = function (props: FormatProps): String {
  return this.toLocaleString(undefined, {
    signDisplay: props?.signDisplay,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
