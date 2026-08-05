import type { UnitDto } from '@lib/schemas/units';
import { Formik } from 'formik';
import React, { useContext } from 'react';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { useRouter } from 'next/router';
import { Button, FormControl, Input, Label, LabelText, LabelTextAlt, Loading } from '@components/ui';
import { z } from 'zod';
import { zodFormikValidate } from '@lib/forms/zodFormikValidate';
import { createUnit } from '@lib/network/units';
import { upsertTranslation } from '@lib/network/workspaces';
import { alertApiV1Error } from '@lib/network/apiV1';

interface UnitModalProps {
  unit?: UnitDto;
  onSaved?: () => void;
}

const unitFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Ungültiger Identifier')
    .regex(/^[A-Z_]+$/, 'Nur A-Z und _ erlaubt'),
  lableDE: z.string().trim().min(1, 'Ungültiger Bezeichner'),
});

const validateUnit = zodFormikValidate(unitFormSchema);

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
            if (!workspaceId) return;
            if (props.unit == undefined) {
              await createUnit(workspaceId, {
                name: values.name,
                translations: {
                  de: values.lableDE,
                },
              });
              router.reload();
              modalContext.closeModal();
              props.onSaved?.();
              alertService.success('Einheit erfolgreich erstellt');
            } else {
              await upsertTranslation(workspaceId, {
                key: values.name,
                translations: {
                  de: values.lableDE,
                },
              });
              router.reload();
              modalContext.closeModal();
              props.onSaved?.();
              alertService.success('Einheit erfolgreich gespeichert');
            }
          } catch (error) {
            alertApiV1Error(error, props.unit == undefined ? 'Fehler beim Erstellen der Einheit' : 'Fehler beim Speichern der Einheit');
          }
        }}
        validate={(values) => validateUnit(values)}
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
