import { Field, Formik, FormikProps } from 'formik';
import React, { useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { useRouter } from 'next/router';
import { Button, FormControl, Input, Label, LabelText, LabelTextAlt, Loading, Toggle } from '@components/ui';
import { z } from 'zod';
import { zodFormikValidate } from '@lib/forms/zodFormikValidate';
import { createJoinCode } from '@lib/network/workspaceUsers';
import { alertApiV1Error } from '@lib/network/apiV1';

interface AddWorkspaceJoinCodeModalProps {
  onCreated?: () => void;
}

function generateJoinCode() {
  return Math.random().toString(36).slice(2, 8).toLowerCase();
}

export default function AddWorkspaceJoinCodeModal(props: AddWorkspaceJoinCodeModalProps) {
  const _userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);
  const { t } = useTranslation(['settings', 'common', 'entity', 'errors']);

  const router = useRouter();

  const { workspaceId } = router.query;

  const formRef = React.useRef<
    FormikProps<{
      code: string;
      expires: string | undefined;
      onlyUseOnce: boolean;
    }>
  >(null);

  const initialCode = useMemo(() => generateJoinCode(), []);

  const joinCodeSchema = z.object({
    code: z.string().min(6, t('settings:validation.codeMinLength')),
    expires: z
      .string()
      .optional()
      .refine((expires) => !expires || new Date(expires) >= new Date(), { message: t('settings:validation.expiresInFuture') }),
    onlyUseOnce: z.boolean(),
  });

  const validateJoinCode = zodFormikValidate(joinCodeSchema);

  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'text-2xl font-bold'}>{t('settings:addJoinCode')}</div>
      <Formik
        innerRef={formRef}
        initialValues={{
          code: initialCode,
          expires: undefined,
          onlyUseOnce: false,
        }}
        onSubmit={async (values) => {
          try {
            if (!workspaceId) return;
            await createJoinCode(workspaceId, {
              code: values.code,
              expires: values.expires,
              onlyUseOnce: values.onlyUseOnce,
            });
            modalContext.closeAllModals();
            props.onCreated?.();
            alertService.success(t('settings:joinCodeCreated'));
          } catch (error) {
            formRef.current?.setFieldValue('code', generateJoinCode());
            alertApiV1Error(error, t('errors:create'));
          }
        }}
        validate={(values) => validateJoinCode(values)}
      >
        {({ values, handleChange, handleSubmit, isSubmitting, errors, touched, handleBlur }) => (
          <form onSubmit={handleSubmit} className={'flex flex-col gap-2'}>
            <div className={'flex flex-col gap-2'}>
              <FormControl>
                <Label htmlFor={'code'} className="flex-row items-center justify-between">
                  <LabelText>
                    {t('settings:joinCodeImmutable')} <span className={'italic'}>{t('settings:immutableHint')}</span>
                  </LabelText>
                  <LabelTextAlt className="text-error">
                    <span>{errors.code && touched.code ? errors.code : ''}</span>
                  </LabelTextAlt>
                </Label>
                <Input id={'code'} name={'code'} value={values.code} disabled={true} />
              </FormControl>
              <FormControl>
                <Label className="flex-row items-center justify-between">
                  <LabelText>{t('settings:expiryDate')}</LabelText>
                  <LabelTextAlt className="text-error">
                    <span>{errors.expires && touched.expires ? errors.expires : ''}</span>
                  </LabelTextAlt>
                </Label>
                <Input id={'expires'} name={'expires'} type={'date'} value={values.expires} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <Label className="flex-row items-center justify-between">
                  <LabelText>{t('settings:oneTimeCode')}</LabelText>
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
                {t('common:cancel')}
              </Button>
              <Button variant="primary" type={'submit'}>
                {isSubmitting ? <Loading size="sm" /> : null}
                {t('common:add')}
              </Button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  );
}
