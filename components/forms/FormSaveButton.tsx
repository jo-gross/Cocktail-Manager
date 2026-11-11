import React, { useEffect, useRef } from 'react';
import { FormikErrors, useFormikContext } from 'formik';
import { useTranslation } from 'react-i18next';
import { Button } from '@components/ui';
import { useUnsavedChangesContext } from '@lib/forms/useUnsavedChanges';
import { HeaderActionsPortal } from '@components/layout/HeaderActionsSlot';

/** Number of leaf messages in a (nested) Formik error object. */
export function countFormErrors(errors: FormikErrors<unknown> | string | string[] | undefined): number {
  if (errors == null) return 0;
  if (typeof errors === 'string') return errors === '' ? 0 : 1;
  if (Array.isArray(errors)) return errors.reduce<number>((sum, entry) => sum + countFormErrors(entry as FormikErrors<unknown>), 0);
  return Object.values(errors).reduce<number>((sum, entry) => sum + countFormErrors(entry as FormikErrors<unknown>), 0);
}

/** Scrolls the first invalid field of `form` into view and focuses it. */
export function revealFirstInvalidField(form: HTMLFormElement | null | undefined) {
  const target = form?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]');
  if (!target) return;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
  const focusable = target.matches('input, select, textarea, button') ? target : target.querySelector<HTMLElement>('input, select, textarea, button');
  focusable?.focus({ preventScroll: true });
}

interface FormSaveButtonProps {
  label: string;
}

/**
 * Primary action of an entity form. Render it anywhere inside the <form>: it appears top right in the
 * page header (or next to the modal title) together with the form status – so no extra bar takes
 * up screen space, and it stays reachable while the on-screen keyboard is open. Also ⌘S / Ctrl+S.
 * The button stays enabled: a failed attempt jumps to the first invalid field instead.
 */
export function FormSaveButton({ label }: FormSaveButtonProps) {
  const { t } = useTranslation(['common']);
  const { isSubmitting, errors, submitCount } = useFormikContext();
  const unsavedChanges = useUnsavedChangesContext();
  // Lives inside the <form> – the button itself is portalled into the header.
  const anchorRef = useRef<HTMLSpanElement>(null);

  const errorCount = countFormErrors(errors);
  const showErrors = submitCount > 0 && errorCount > 0;
  const getForm = () => anchorRef.current?.closest('form');
  const submit = () => getForm()?.requestSubmit();

  // After a failed submit attempt (button, ⌘S or the leave prompt's "Save"): show the first problem.
  useEffect(() => {
    if (submitCount === 0 || isSubmitting) return;
    const form = anchorRef.current?.closest('form');
    if (form?.querySelector('[aria-invalid="true"], [data-invalid="true"]')) revealFirstInvalidField(form);
  }, [submitCount, isSubmitting]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 's') return;
      const form = anchorRef.current?.closest('form');
      if (!form) return;
      // A modal on top owns the shortcut.
      const openDialog = document.querySelector('dialog[open]');
      if (openDialog && !openDialog.contains(form)) return;
      event.preventDefault();
      form.requestSubmit();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const action = (
    <div className="flex items-center gap-3" aria-live="polite">
      {showErrors ? (
        <button
          type="button"
          className="cursor-pointer text-sm font-medium text-error underline-offset-2 hover:underline"
          onClick={() => revealFirstInvalidField(getForm())}
        >
          {t('common:form.fieldsToCheck', { count: errorCount })}
        </button>
      ) : unsavedChanges.dirty ? (
        <span className="flex items-center gap-1.5 text-xs text-base-content/70" title={t('common:unsavedChanges')}>
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-warning" />
          <span className="sr-only lg:not-sr-only">{t('common:unsavedChanges')}</span>
        </span>
      ) : null}
      <Button type="button" variant="primary" loading={isSubmitting} onClick={submit} title={t('common:form.saveShortcut', { label })}>
        {label}
      </Button>
    </div>
  );

  return (
    <>
      <span ref={anchorRef} hidden />
      <HeaderActionsPortal fallback={<div className="mt-4 flex justify-end">{action}</div>}>{action}</HeaderActionsPortal>
    </>
  );
}
