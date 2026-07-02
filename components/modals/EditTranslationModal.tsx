import { Formik } from 'formik';
import React, { useContext } from 'react';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { useRouter } from 'next/router';
import { Button, FormControl, Input, Label, LabelText, LabelTextAlt, Loading } from '@components/ui';

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
