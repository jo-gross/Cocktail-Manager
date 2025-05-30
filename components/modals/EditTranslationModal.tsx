import { Formik } from 'formik';
import React, { useContext } from 'react';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { useRouter } from 'next/router';

interface TranslationModalProps {
  slang: string;
  identifier: string;
}

export default function EditTranslationModal(props: TranslationModalProps) {
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const router = useRouter();

  const { workspaceId } = router.query;

  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'text-2xl font-bold'}>{props.slang} Anpassen</div>
      <Formik
        initialValues={{
          lableDE: userContext.getTranslationOrNull(props.identifier, 'de') ?? '',
        }}
        onSubmit={async (values) => {
          try {
            const body = {
              key: props.identifier,
              translations: {
                de: values.lableDE,
              },
            };
            const response = await fetch(`/api/workspaces/${workspaceId}/admin/translation`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (response.status.toString().startsWith('2')) {
              router.reload();
              modalContext.closeModal();
              alertService.success(`${props.slang} erfolgreich gespeichert`);
            } else {
              const body = await response.json();
              console.error('EditTranslationModal -> onSubmit[update]', response);
              alertService.error(body.message ?? `Fehler beim Speichern der ${props.slang}`, response.status, response.statusText);
            }
          } catch (error) {
            console.error('EditTranslationModal -> onSubmit', error);
            alertService.error('Es ist ein Fehler aufgetreten');
          }
        }}
        validate={(values) => {
          const errors: { [key: string]: string } = {};

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
                <label className={'label'}>
                  <div className={'label-text'}>Identifier</div>
                  <div className={'label-text-alt text-error'}></div>
                </label>
                <input
                  id={'identifier'}
                  readOnly={true}
                  name={'identifier'}
                  value={props.identifier}
                  onChange={handleChange}
                  className={`input input-bordered input-disabled`}
                />
              </div>
              <div className={'form-control'}>
                <label className={'label'}>
                  <div className={'label-text'}>Deutsch</div>
                  <div className={'label-text-alt text-error'}>
                    <span>{errors.lableDE && touched.lableDE ? errors.lableDE : ''}</span>
                    <span>*</span>
                  </div>
                </label>
                <input id={'lableDE'} name={'lableDE'} value={values.lableDE} onChange={handleChange} className={'input input-bordered'} />
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
                Speichern
              </button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  );
}
