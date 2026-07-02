import React, { forwardRef } from 'react';
import { cn } from './cn';

/**
 * Styling primitives for the native `<dialog>` based modal system
 * (see components/modals/GlobalModal.tsx). These replace the DaisyUI
 * `modal` / `modal-box` / `modal-backdrop` classes. The modal stack /
 * open-close logic (via document.getElementById) stays untouched.
 */

/** Class for the `<dialog>` element. Shows as a centered overlay while `open`. */
export const modalClassName = cn(
  'z-40 m-0 max-h-none max-w-none border-0 bg-transparent p-0 text-base-content',
  'backdrop:bg-black/0 backdrop:backdrop-blur-none backdrop:transition-[backdrop-filter,background-color] backdrop:duration-200 motion-reduce:backdrop:transition-none',
  // Native `<dialog>` defaults to fit-content + margin:auto, which shrink-wraps the
  // element and breaks viewport centering. Force full viewport when open.
  'open:fixed open:inset-0 open:m-0 open:box-border open:flex open:h-dvh open:w-dvw open:max-h-dvh open:max-w-dvw open:items-center open:justify-center open:p-4',
  'open:backdrop:bg-black/50 open:backdrop:backdrop-blur-sm',
);

/** Class for the modal content box. */
export const modalBoxClassName = cn(
  'relative z-10 max-h-[90vh] w-max max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl bg-base-100 text-base-content shadow-xl animate-fade-in motion-reduce:animate-none',
);

/** Class for the full-screen backdrop element (a `<form method="dialog">`). */
export const modalBackdropClassName = cn('fixed inset-0 z-0 cursor-default');

export type ModalProps = React.DialogHTMLAttributes<HTMLDialogElement>;

/** Native <dialog> element wrapper. Keep the `id` so the modal stack can open it. */
export const Modal = forwardRef<HTMLDialogElement, ModalProps>(function Modal({ className, children, ...props }, ref) {
  return (
    <dialog ref={ref} className={cn(modalClassName, className)} {...props}>
      {children}
    </dialog>
  );
});

export type ModalBoxProps = React.HTMLAttributes<HTMLDivElement>;

export const ModalBox = forwardRef<HTMLDivElement, ModalBoxProps>(function ModalBox({ className, children, ...props }, ref) {
  return (
    <div ref={ref} className={cn(modalBoxClassName, 'p-4', className)} {...props}>
      {children}
    </div>
  );
});

export type ModalBackdropProps = React.FormHTMLAttributes<HTMLFormElement>;

export const ModalBackdrop = forwardRef<HTMLFormElement, ModalBackdropProps>(function ModalBackdrop({ className, children, ...props }, ref) {
  return (
    <form method="dialog" ref={ref} className={cn(modalBackdropClassName, className)} {...props}>
      {children}
    </form>
  );
});

export type ModalActionsProps = React.HTMLAttributes<HTMLDivElement>;

export function ModalActions({ className, children, ...props }: ModalActionsProps) {
  return (
    <div className={cn('mt-4 flex items-center justify-end gap-2', className)} {...props}>
      {children}
    </div>
  );
}
