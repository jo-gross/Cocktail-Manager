import { Field, Formik, FormikProps } from 'formik';
import React, { useContext } from 'react';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { useRouter } from 'next/router';

interface AddWorkspaceJoinCodeModalProps {
  onCreated?: () => void;
}

export default function AddWorkspaceJoinCodeModal(props: AddWorkspaceJoinCodeModalProps) {
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const router = useRouter();

  const { workspaceId } = router.query;

  const formRef = React.useRef<
    FormikProps<{
      code: string;
      expires: string | undefined;
      onlyUseOnce: boolean;
    }>
  >(null);

  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'text-2xl font-bold'}>Einladungscode hinzufügen</div>
      <Formik
        innerRef={formRef}
        initialValues={{
          code: Math.random().toString(36).slice(2, 8).toLowerCase(),
          expires: undefined,
          onlyUseOnce: false,
        }}
        onSubmit={async (values) => {
          try {
            const body = {
              code: values.code,
              expires: values.expires,
              onlyUseOnce: values.onlyUseOnce,
            };

            const response = await fetch(`/api/workspaces/${workspaceId}/join-codes`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (response.status.toString().startsWith('2')) {
              modalContext.closeAllModals();
              props.onCreated?.();
              alertService.success('Beitrittcode erstellt');
            } else {
              formRef.current?.setFieldValue('code', Math.random().toString(36).slice(2, 8).toLowerCase());
              alertService.error('Da hat etwas nicht funktioniert, probiere es mit diesem neu generierten Code erneut!', response.status, response.statusText);
            }
          } catch (error) {
            console.error('CocktailRatingModal -> onSubmit', error);
            alertService.error('Es ist ein Fehler aufgetreten');
          }
        }}
        validate={(values) => {
          const errors: { [key: string]: string } = {};
          if (values.code.length <= 5) {
            errors.code = `Der Code muss länger als 5 Zeichen sein ${values.code.length}`;
          }
          if (values.expires && new Date(values.expires) < new Date()) {
            errors.expires = 'Das Ablaufdatum muss in der Zukunft liegen';
          }
          return errors;
        }}
      >
        {({ values, handleChange, handleSubmit, isSubmitting, errors, touched, handleBlur }) => (
          <form onSubmit={handleSubmit} className={'flex flex-col gap-2'}>
            <div className={'flex flex-col gap-2'}>
              <div className={'form-control'}>
                <label className={'label'} htmlFor={'code'}>
                  <div className={'label-text'}>
                    Beitrittcode <span className={'italic'}>(unveränderbar)</span>
                  </div>
                  <div className={'label-text-alt text-error'}>
                    <span>{errors.code && touched.code ? errors.code : ''}</span>
                  </div>
                </label>
                <input id={'code'} name={'code'} value={values.code} disabled={true} className={`input`} />
              </div>
              <div className={'form-control'}>
                <label className={'label'}>
                  <div className={'label-text'}>Ablaufdatum</div>
                  <div className={'label-text-alt text-error'}>
                    <span>{errors.expires && touched.expires ? errors.expires : ''}</span>
                  </div>
                </label>
                <input id={'expires'} name={'expires'} type={'date'} value={values.expires} onChange={handleChange} className={`input`} />
              </div>
              <div className={'form-control'}>
                <label className={'label'}>
                  <div className={'label-text'}>Einmal-Code</div>
                  <div className={'label-text-alt text-error'}>
                    <span>{errors.onlyUseOnce && touched.onlyUseOnce ? errors.onlyUseOnce : ''}</span>
                  </div>
                </label>
                <Field type={'checkbox'} name={`onlyUseOnce`} onChange={handleChange} onBlur={handleBlur} className={'toggle toggle-primary'} />
              </div>
            </div>
            <div className={'flex justify-end gap-2'}>
              <button
                className={'btn btn-outline btn-error'}
                type={'button'}
                onClick={() => {
                  modalContext.closeAllModals();
                }}
              >
                Abbrechen
              </button>
              <button className={'btn btn-primary'} type={'submit'}>
                {isSubmitting ? <span className={'spinner loading-spinner'} /> : <></>}
                Hinzufügen
              </button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  );
}
