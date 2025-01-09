import { FaArrowLeft } from 'react-icons/fa';
import Head from 'next/head';
import React, { useContext } from 'react';
import { NotSavedLeaveConfirmation } from '../modals/NotSavedLeaveConfirmation';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import { FormikProps } from 'formik';
import { RoutingContext } from '../../lib/context/RoutingContextProvider';

interface ManageEntityLayoutProps {
  children: React.ReactNode;
  backLink: string;
  title?: string | React.ReactNode;
  actions?: React.ReactNode;
  unsavedChanges?: boolean;
  formRef?: React.RefObject<FormikProps<any>>;
  // Remove after calculation is migrated to formik
  onSave?: () => void;
}

export function ManageEntityLayout(props: ManageEntityLayoutProps) {
  const modalContext = useContext(ModalContext);
  const routingContext = useContext(RoutingContext);

  return (
    <>
      <Head>
        <>{typeof props.title === 'string' ? <title>{`The Cocktail-Manager • ${props.title}`}</title> : <title>The Cocktail-Manager</title>}</>
      </Head>
      <div>
        {/*<div className={'flex flex-col p-1 md:p-4 print:p-1'}>*/}
        <div
          className={
            'sticky top-0 z-10 grid w-full grid-cols-3 items-center justify-center justify-items-center bg-base-100 p-1 md:p-2 print:grid-cols-1 print:p-1'
          }
        >
          <div className={'col-span-1 justify-self-start print:hidden'}>
            <div
              className={'btn btn-square btn-primary btn-sm md:btn-md'}
              onClick={() => {
                (props.unsavedChanges ?? false)
                  ? modalContext.openModal(
                      <NotSavedLeaveConfirmation
                        isSaving={props.formRef?.current?.isSubmitting}
                        onSave={async () => {
                          props.onSave?.();
                          await props.formRef?.current?.submitForm();
                        }}
                        onNotSave={() => routingContext.conditionalBack(props.backLink)}
                      />,
                    )
                  : routingContext.conditionalBack(props.backLink);
              }}
            >
              <FaArrowLeft />
            </div>
          </div>
          <div className={'justify-items-center text-3xl font-bold print:text-2xl'}>{props.title}</div>
          <div className={'flex flex-col-reverse items-center gap-2 justify-self-end md:flex-row print:hidden'}>
            {props.unsavedChanges && <div className={'text-center italic print:hidden'}>Nicht gespeicherte Änderungen</div>}
            {props.actions}
          </div>
        </div>
        <div className={'p-2 md:p-4 print:p-2'}>{props.children}</div>
      </div>
    </>
  );
}
