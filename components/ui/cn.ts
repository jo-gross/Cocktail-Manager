import classNames, { type Argument } from 'classnames';

/**
 * Thin wrapper around `classnames` used by all UI primitives so class merging is
 * consistent and easy to swap out later.
 */
export function cn(...inputs: Argument[]): string {
  return classNames(...inputs);
}
