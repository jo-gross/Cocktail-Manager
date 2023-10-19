import { FaArrowLeft } from 'react-icons/fa';
import Head from 'next/head';
import React, { useContext } from 'react';
import { NotSavedConfirmation } from '../modals/NotSavedConfirmation';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import { useRouter } from 'next/router';
import { FormikProps } from 'formik';

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
  const router = useRouter();

  return (
    <>
      <Head>
        <>
          {typeof props.title === 'string' ? (
            <title>{`${props.title} - The Cocktail-Manager`}</title>
          ) : (
            <title>The Cocktail-Manager</title>
          )}
        </>
      </Head>
      <div className={'flex flex-col md:p-4 p-1 print:p-1'}>
        <div className={'grid grid-cols-3 print:grid-cols-1 w-full justify-center items-center justify-items-center'}>
          <div className={'col-span-1 justify-self-start print:hidden'}>
            <div
              className={'btn btn-primary btn-square rounded-xl'}
              onClick={() => {
                props.unsavedChanges ?? false
                  ? modalContext.openModal(
                      <NotSavedConfirmation
                        isSaving={props.formRef?.current?.isSubmitting}
                        onSave={async () => {
                          props.onSave?.();
                          await props.formRef?.current?.submitForm();
                        }}
                        onNotSave={() => router.push(props.backLink)}
                      />,
                    )
                  : router.push(props.backLink);
              }}
            >
              <FaArrowLeft />
            </div>
          </div>
          <div className={'justify-items-center text-3xl font-bold print:text-2xl'}>{props.title}</div>
          <div className={'justify-self-end space-x-2 items-center flex print:hidden'}>
            {props.unsavedChanges && <div className={'print:hidden italic'}>Nicht gespeicherte Änderungen</div>}
            {props.actions}
          </div>
        </div>
        <div className={'md:p-8 p-2 print:p-2'}>{props.children}</div>
      </div>
    </>
  );
}
