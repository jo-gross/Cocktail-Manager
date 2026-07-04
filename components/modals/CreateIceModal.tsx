import { Formik } from 'formik';
import React, { useContext } from 'react';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { useRouter } from 'next/router';
import { Button, FormControl, Input, Label, LabelText, LabelTextAlt, Loading } from '@components/ui';

export default function CreateIceModal() {
  const _userContext = useContext(UserContext);
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
        {({ values, handleChange, handleSubmit, isSubmitting, errors, touched, setFieldValue: _setFieldValue }) => (
          <form onSubmit={handleSubmit} className={'flex flex-col gap-2'}>
            <div className={'grid grid-cols-2 gap-2'}>
              <FormControl>
                <Label htmlFor={'identifier'} className="flex-row items-center justify-between">
                  <LabelText>Identifier (A-Z,_)</LabelText>
                  <LabelTextAlt className="text-error">
                    <span>{errors.identifier && touched.identifier ? errors.identifier : ''}</span>
                    <span>*</span>
                  </LabelTextAlt>
                </Label>
                <Input id={'identifier'} name={'identifier'} value={values.identifier} onChange={handleChange} />
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
                Erstellen
              </Button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  );
}
