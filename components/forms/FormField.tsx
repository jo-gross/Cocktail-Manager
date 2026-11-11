import React from 'react';
import { FormikContextType, getIn, useFormikContext } from 'formik';
import { FaTriangleExclamation } from 'react-icons/fa6';
import { cn } from '@components/ui';

export interface FormFieldProps {
  label: React.ReactNode;
  /** Id of the control; renders a real <label for>. Omit for composite controls (tags, chips). */
  htmlFor?: string;
  required?: boolean;
  /** Help text below the control (hidden while an error is shown). */
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** Non-blocking notice, e.g. "a similar entry already exists". */
  warning?: React.ReactNode;
  /** Right-aligned extra next to the label (e.g. a small action). */
  labelAside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Label, control, then hint / error / warning below – the standard layout of every form field. */
export function FormField({ label, htmlFor, required, hint, error, warning, labelAside, className, children }: FormFieldProps) {
  const hasError = error != null && error !== false && error !== '';
  const labelContent = (
    <>
      {label}
      {required && (
        <span aria-hidden="true" className="ml-0.5 text-error">
          *
        </span>
      )}
    </>
  );

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)} data-invalid={hasError || undefined}>
      <div className="flex min-h-5 items-end justify-between gap-2">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-sm font-medium text-base-content">
            {labelContent}
          </label>
        ) : (
          <span className="text-sm font-medium text-base-content">{labelContent}</span>
        )}
        {labelAside}
      </div>
      {children}
      {hasError ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="text-sm text-error">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-base-content/60">{hint}</p>
      ) : null}
      {warning ? (
        <p role="status" className="flex items-start gap-1.5 text-sm text-base-content/80">
          <FaTriangleExclamation aria-hidden className="mt-0.5 shrink-0 text-warning" />
          <span>{warning}</span>
        </p>
      ) : null}
    </div>
  );
}

type FormikErrorState = Pick<FormikContextType<unknown>, 'errors' | 'touched' | 'submitCount'>;

/**
 * Error of a Formik field (dot path), but only once the field was touched or a submit was attempted –
 * so a fresh form doesn't greet the user with a wall of "required" messages.
 */
export function visibleFieldError(formik: FormikErrorState, name: string): string | undefined {
  const error = getIn(formik.errors, name);
  if (typeof error !== 'string') return undefined;
  return getIn(formik.touched, name) || formik.submitCount > 0 ? error : undefined;
}

/** {@link visibleFieldError} for components rendered inside <Formik>. */
export function useFormikFieldError(name: string): string | undefined {
  return visibleFieldError(useFormikContext(), name);
}
