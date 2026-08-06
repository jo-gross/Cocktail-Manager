import { Formik } from 'formik';
import React, { useContext } from 'react';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { useRouter } from 'next/router';
import { Button, FormControl, Input, Label, LabelText, LabelTextAlt, Loading } from '@components/ui';
import { z } from 'zod';
import { zodFormikValidate } from '@lib/forms/zodFormikValidate';
import { upsertTranslation } from '@lib/network/workspaces';
import { alertApiV1Error } from '@lib/network/apiV1';

interface TranslationModalProps {
  slang: string;
  identifier: string;
}

const translationSchema = z.object({
  lableDE: z.string().trim().min(1, 'Ungültiger Bezeichner'),
});

const validateTranslation = zodFormikValidate(translationSchema);

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
            if (!workspaceId) return;
            await upsertTranslation(workspaceId, {
              key: props.identifier,
              translations: {
                de: values.lableDE,
              },
            });
            userContext.refreshWorkspace();
            modalContext.closeModal();
            alertService.success(`${props.slang} erfolgreich gespeichert`);
          } catch (error) {
            alertApiV1Error(error, `Fehler beim Speichern der ${props.slang}`);
          }
        }}
        validate={(values) => validateTranslation(values)}
      >
        {({ values, handleChange, handleSubmit, isSubmitting, errors, touched, setFieldValue: _setFieldValue }) => (
          <form onSubmit={handleSubmit} className={'flex flex-col gap-2'}>
            <div className={'grid grid-cols-2 gap-2'}>
              <FormControl>
                <Label className="flex-row items-center justify-between">
                  <LabelText>Identifier</LabelText>
                  <LabelTextAlt className="text-error"></LabelTextAlt>
                </Label>
                <Input id={'identifier'} readOnly={true} name={'identifier'} value={props.identifier} onChange={handleChange} disabled />
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
                Speichern
              </Button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  );
}
