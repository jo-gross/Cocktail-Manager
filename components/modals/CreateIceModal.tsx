import { Formik } from 'formik';
import React, { useContext } from 'react';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { useRouter } from 'next/router';

export default function CreateIceModal() {
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const router = useRouter();

  const { workspaceId } = router.query;

  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'text-2xl font-bold'}>Eis erstellen</div>
      <Formik
        initialValues={{
          identifier: '',
          lableDE: '',
        }}
        onSubmit={async (values) => {
          try {
            const body = {
              name: values.identifier,
              translations: {
                de: values.lableDE,
              },
            };

            const response = await fetch(`/api/workspaces/${workspaceId}/ice`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (response.status.toString().startsWith('2')) {
              router.reload();
              modalContext.closeModal();
              alertService.success('Zubereitungsmethode erfolgreich erstellt');
            } else {
              const body = await response.json();
              console.error('CocktailStepActionModal -> onSubmit[create]', response);
              alertService.error(body.message ?? 'Fehler beim Erstellen der Zubereitungsmethode', response.status, response.statusText);
            }
          } catch (error) {
            console.error('CocktailStepActionModal -> onSubmit', error);
            alertService.error('Es ist ein Fehler aufgetreten');
          }
        }}
        validate={(values) => {
          const errors: { [key: string]: string } = {};

          if (!values.identifier || values.identifier.trim() == '') {
            errors.identifier = 'Ungültiger Identifier';
          } else {
            if (!/^[A-Z_]+$/.test(values.identifier)) {
              errors.identifier = 'Nur A-Z und _ erlaubt';
            }
          }

          if (!values.lableDE || values.lableDE.trim() == '') {
            errors.lableDE = 'Ungültiger Bezeichner';
          }

          return errors;
        }}
      >
        {({ values, handleChange, handleSubmit, isSubmitting, errors, touched, setFieldValue }) => (
          <form onSubmit={handleSubmit} className={'flex flex-col gap-2'}>
            <div className={'grid grid-cols-2 gap-2'}>
              <div className={'form-control'}>
                <label className={'label'} htmlFor={'identifier'}>
                  <div className={'label-text'}>Identifier (A-Z,_)</div>
                  <div className={'label-text-alt text-error'}>
                    <span>{errors.identifier && touched.identifier ? errors.identifier : ''}</span>
                    <span>*</span>
                  </div>
                </label>
                <input id={'identifier'} name={'identifier'} value={values.identifier} onChange={handleChange} className={`input`} />
              </div>
              <div className={'form-control'}>
                <label className={'label'}>
                  <div className={'label-text'}>Deutsch</div>
                  <div className={'label-text-alt text-error'}>
                    <span>{errors.lableDE && touched.lableDE ? errors.lableDE : ''}</span>
                    <span>*</span>
                  </div>
                </label>
                <input id={'lableDE'} name={'lableDE'} value={values.lableDE} onChange={handleChange} className={'input'} />
              </div>
            </div>
            <div className={'flex justify-end gap-2'}>
              <button
                className={'btn btn-outline btn-error'}
                type={'button'}
                onClick={() => {
                  modalContext.closeModal();
                }}
              >
                Abbrechen
              </button>
              <button className={'btn btn-primary'} type={'submit'}>
                {isSubmitting ? <span className={'spinner loading-spinner'} /> : <></>}
                Erstellen
              </button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  );
}
