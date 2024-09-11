import { Unit } from '@prisma/client';
import { Formik } from 'formik';
import React, { useContext } from 'react';
import { UserContext } from '../../lib/context/UserContextProvider';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import { alertService } from '../../lib/alertService';
import { useRouter } from 'next/router';

interface UnitModalProps {
  unit?: Unit;
  onSaved?: () => void;
}

export default function UnitModal(props: UnitModalProps) {
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const router = useRouter();

  const { workspaceId } = router.query;

  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'text-2xl font-bold'}>Einheit {props.unit == undefined ? 'Erfassen' : 'Anpassen'}</div>
      <Formik
        initialValues={{
          name: props.unit?.name || '',
          lableDE: props.unit != undefined ? userContext.getTranslation(props.unit.name, 'de') : '',
        }}
        onSubmit={async (values) => {
          try {
            if (props.unit == undefined) {
              const body = {
                name: values.name,
                translations: {
                  de: values.lableDE,
                },
              };
              const response = await fetch(`/api/workspaces/${workspaceId}/units`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
              if (response.status.toString().startsWith('2')) {
                router.reload();
                modalContext.closeModal();
                props.onSaved?.();
                alertService.success('Einheit erfolgreich erstellt');
              } else {
                const body = await response.json();
                console.error('UnitModal -> onSubmit[create]', response);
                alertService.error(body.message ?? 'Fehler beim Erstellen der Einheit', response.status, response.statusText);
              }
            } else {
              const body = {
                key: values.name,
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
                props.onSaved?.();
                alertService.success('Einheit erfolgreich gespeichert');
              } else {
                const body = await response.json();
                console.error('UnitModal -> onSubmit[update]', response);
                alertService.error(body.message ?? 'Fehler beim Speichern der Einheit', response.status, response.statusText);
              }
            }
          } catch (error) {
            console.error('UnitModal -> onSubmit', error);
            alertService.error('Es ist ein Fehler aufgetreten');
          }
        }}
        validate={(values) => {
          const errors: { [key: string]: string } = {};

          if (values.name.trim() != '') {
            if (!/^[A-Z_]+$/.test(values.name)) {
              errors.name = 'Nur A-Z und _ erlaubt';
            }
          } else {
            errors.name = 'Ungültiger Identifier';
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
                <label className={'label'}>
                  <div className={'label-text'}>Identifier (A-Z,_)</div>
                  <div className={'label-text-alt text-error'}>
                    <span>{errors.name && touched.name ? errors.name : ''}</span>
                    <span>*</span>
                  </div>
                </label>
                <input
                  id={'name'}
                  readOnly={props.unit != undefined}
                  name={'name'}
                  value={values.name}
                  onChange={handleChange}
                  className={`input input-bordered ${props.unit != undefined ? 'input-disabled' : ''}`}
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
                {props.unit == undefined ? 'Erstellen' : 'Speichern'}
              </button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  );
}
