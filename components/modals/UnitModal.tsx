import { Unit } from '@generated/prisma/client';
import { Formik } from 'formik';
import React, { useContext } from 'react';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { useRouter } from 'next/router';
import { Button, FormControl, Input, Label, LabelText, LabelTextAlt, Loading } from '@components/ui';

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
        {({ values, handleChange, handleSubmit, isSubmitting, errors, touched, setFieldValue: _setFieldValue }) => (
          <form onSubmit={handleSubmit} className={'flex flex-col gap-2'}>
            <div className={'grid grid-cols-2 gap-2'}>
              <FormControl>
                <Label className="flex-row items-center justify-between">
                  <LabelText>Identifier (A-Z,_)</LabelText>
                  <LabelTextAlt className="text-error">
                    <span>{errors.name && touched.name ? errors.name : ''}</span>
                    <span>*</span>
                  </LabelTextAlt>
                </Label>
                <Input
                  id={'name'}
                  readOnly={props.unit != undefined}
                  name={'name'}
                  value={values.name}
                  onChange={handleChange}
                  disabled={props.unit != undefined}
                />
              </FormControl>
              <FormControl>
                <Label className="flex-row items-center justify-between">
                  <LabelText>Deutsch</LabelText>
                  <LabelTextAlt className="text-error">
                    <span>{errors.lableDE && touched.lableDE ? errors.lableDE : ''}</span>
                    <span>*</span>
                  </LabelTextAlt>
                </Label>
                <Input id={'lableDE'} name={'lableDE'} value={values.lableDE} onChange={handleChange} />
              </FormControl>
            </div>
            <div className={'flex justify-end gap-2'}>
              <Button
                variant="outline"
                className="border-error text-error hover:bg-error/10"
                type={'button'}
                onClick={() => {
                  modalContext.closeModal();
                }}
              >
                Abbrechen
              </Button>
              <Button variant="primary" type={'submit'}>
                {isSubmitting ? <Loading size="sm" /> : null}
                {props.unit == undefined ? 'Erstellen' : 'Speichern'}
              </Button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  );
}
