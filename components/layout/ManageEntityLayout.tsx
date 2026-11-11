import { FaArrowLeft } from 'react-icons/fa';
import Head from 'next/head';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { Button } from '@components/ui';
import { RoutingContext } from '@lib/context/RoutingContextProvider';
import { UnsavedChangesContext, useUnsavedChanges } from '@lib/forms/useUnsavedChanges';
import { HeaderActionsSlotContext } from './HeaderActionsSlot';

interface FormikRefLike {
  isSubmitting?: boolean;
  submitForm: () => Promise<void>;
}

interface ManageEntityLayoutProps {
  children: React.ReactNode;
  backLink: string;
  title?: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  actions?: React.ReactNode;
  /**
   * Page-level dirty state. Children (forms, translation tabs, settings sections) report their own
   * state via `useReportUnsavedChanges` – everything is combined into one leave guard.
   */
  unsavedChanges?: boolean;
  /** Formik form submitted by the leave prompt's "Save" (the form redirects itself via `completeSave`). */
  formRef?: React.RefObject<FormikRefLike | null>;
  /** Custom "Save" of the leave prompt; resolve to `true` when saved to continue the navigation. */
  onSave?: () => Promise<boolean>;
  /** Stretch content to fill the viewport height (for overview tables). */
  fullHeight?: boolean;
  /** Always navigate to `backLink` instead of going back in the browser history (e.g. for areas with sub-pages). */
  alwaysUseBackLink?: boolean;
  /** Show the "unsaved changes" hint in the header (off for entity forms – their action bar shows it). */
  showUnsavedHint?: boolean;
}

/**
 * Exposes the sticky header's height as `--manage-header-h` on the root element, so sticky content
 * (form section navigation) and scroll offsets can sit right below it.
 */
function useHeaderHeightVariable() {
  const headerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const header = headerRef.current;
    if (!header || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty('--manage-header-h', `${header.offsetHeight}px`));
    observer.observe(header);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--manage-header-h');
    };
  }, []);
  return headerRef;
}

export function ManageEntityLayout(props: ManageEntityLayoutProps) {
  const routingContext = useContext(RoutingContext);
  const router = useRouter();
  const { t } = useTranslation('common');
  const goBack = () => (props.alwaysUseBackLink ? router.push(props.backLink) : routingContext.conditionalBack(props.backLink));
  const headerRef = useHeaderHeightVariable();
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null);

  const { formRef, onSave } = props;
  const unsavedChanges = useUnsavedChanges({
    dirty: props.unsavedChanges ?? false,
    onSave: onSave ?? (formRef ? () => formRef.current?.submitForm() ?? Promise.resolve() : undefined),
  });

  return (
    <UnsavedChangesContext.Provider value={unsavedChanges}>
      <HeaderActionsSlotContext.Provider value={{ slot: actionsSlot }}>
        <Head>
          <>{typeof props.title === 'string' ? <title>{`${t('appName')} • ${props.title}`}</title> : <title>{t('appName')}</title>}</>
        </Head>
        <div className={props.fullHeight ? 'flex h-dvh flex-col' : undefined}>
          <div
            ref={headerRef}
            className={
              'sticky top-0 z-20 grid w-full grid-cols-3 items-center justify-center justify-items-center bg-base-100 p-2 md:p-3 print:grid-cols-1 print:p-2'
            }
          >
            <div className={'col-span-1 justify-self-start print:hidden'}>
              <Button variant="primary" shape="square" size="md" className="md:h-11 md:min-h-11 md:w-11" onClick={() => unsavedChanges.confirmLeave(goBack)}>
                <FaArrowLeft className="text-xl" />
              </Button>
            </div>
            <div className={'justify-items-center'}>
              <div className="text-center text-3xl font-bold print:text-2xl">{props.title}</div>
              {props.subtitle && <div className="mt-1 text-center text-sm break-words text-base-content/70 print:hidden">{props.subtitle}</div>}
            </div>
            <div className={'flex flex-col-reverse items-center gap-2 justify-self-end md:flex-row print:hidden'}>
              {unsavedChanges.dirty && (props.showUnsavedHint ?? true) && <div className={'text-center italic print:hidden'}>{t('unsavedChanges')}</div>}
              {props.actions}
              {/* Filled by page content via <HeaderActionsPortal> (e.g. a form's save button). */}
              <div ref={setActionsSlot} className="flex items-center gap-2 empty:hidden" />
            </div>
          </div>
          <div className={props.fullHeight ? 'flex min-h-0 flex-1 flex-col p-4 md:p-5 print:p-2' : 'p-4 md:p-5 print:p-2'}>{props.children}</div>
        </div>
      </HeaderActionsSlotContext.Provider>
    </UnsavedChangesContext.Provider>
  );
}
