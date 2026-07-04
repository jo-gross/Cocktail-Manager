import { Field, Formik, FormikProps } from 'formik';
import React, { useContext } from 'react';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { useRouter } from 'next/router';
import { Button, FormControl, Input, Label, LabelText, LabelTextAlt, Loading, Toggle } from '@components/ui';

interface AddWorkspaceJoinCodeModalProps {
  onCreated?: () => void;
}

export default function AddWorkspaceJoinCodeModal(props: AddWorkspaceJoinCodeModalProps) {
  const _userContext = useContext(UserContext);
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
              <FormControl>
                <Label htmlFor={'code'} className="flex-row items-center justify-between">
                  <LabelText>
                    Beitrittcode <span className={'italic'}>(unveränderbar)</span>
                  </LabelText>
                  <LabelTextAlt className="text-error">
                    <span>{errors.code && touched.code ? errors.code : ''}</span>
                  </LabelTextAlt>
                </Label>
                <Input id={'code'} name={'code'} value={values.code} disabled={true} />
              </FormControl>
              <FormControl>
                <Label className="flex-row items-center justify-between">
                  <LabelText>Ablaufdatum</LabelText>
                  <LabelTextAlt className="text-error">
                    <span>{errors.expires && touched.expires ? errors.expires : ''}</span>
                  </LabelTextAlt>
                </Label>
                <Input id={'expires'} name={'expires'} type={'date'} value={values.expires} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <Label className="flex-row items-center justify-between">
                  <LabelText>Einmal-Code</LabelText>
                  <LabelTextAlt className="text-error">
                    <span>{errors.onlyUseOnce && touched.onlyUseOnce ? errors.onlyUseOnce : ''}</span>
                  </LabelTextAlt>
                </Label>
                <Field type={'checkbox'} as={Toggle} name={`onlyUseOnce`} onChange={handleChange} onBlur={handleBlur} />
              </FormControl>
            </div>
            <div className={'flex justify-end gap-2'}>
              <Button
                variant="outline"
                className="border-error text-error hover:bg-error/10"
                type={'button'}
                onClick={() => {
                  modalContext.closeAllModals();
                }}
              >
                Abbrechen
              </Button>
              <Button variant="primary" type={'submit'}>
                {isSubmitting ? <Loading size="sm" /> : null}
                Hinzufügen
              </Button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  );
}
