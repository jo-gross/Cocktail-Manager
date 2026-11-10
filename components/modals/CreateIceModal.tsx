import { Formik } from 'formik';
import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { UserContext } from '@lib/context/UserContextProvider';
import { alertService } from '@lib/alertService';
import { useRouter } from 'next/router';
import { Button, FormControl, Input, Label, LabelText, LabelTextAlt, Loading } from '@components/ui';
import { z } from 'zod';
import { zodFormikValidate } from '@lib/forms/zodFormikValidate';
import { createIce } from '@lib/network/ices';
import { alertApiV1Error } from '@lib/network/apiV1';
import { useLabelLocales } from '@components/settings/EntityTranslationLabels';
import { activeLabelValues, LabelTranslationInputs, labelValuesSchema, type LabelValues } from '@components/settings/LabelTranslationInputs';

interface CreateIceModalProps {
  onSaved?: () => void;
}

export default function CreateIceModal({ onSaved }: CreateIceModalProps) {
  const { t } = useTranslation(['settings', 'common', 'entity', 'errors']);
  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);

  const router = useRouter();

  const { workspaceId } = router.query;
  const labelLocales = useLabelLocales();

  const iceSchema = z.object({
    identifier: z
      .string()
      .min(1, t('settings:validation.invalidIdentifier'))
      .regex(/^[A-Z_]+$/, t('settings:validation.azOnly')),
    labels: labelValuesSchema(labelLocales, t('settings:validation.invalidLabel')),
  });

  const validateIce = zodFormikValidate(iceSchema);

  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'text-2xl font-bold'}>{t('settings:createIce')}</div>
      <Formik
        initialValues={{
          identifier: '',
          labels: {} as LabelValues,
        }}
        onSubmit={async (values) => {
          try {
            if (!workspaceId || labelLocales.length === 0) return;
            const translations = activeLabelValues(values.labels, labelLocales);
            await createIce(workspaceId, {
              name: values.identifier,
              translations,
            });
            userContext.patchTranslations(values.identifier, translations);
            onSaved?.();
            modalContext.closeModal();
            alertService.success(t('entity:iceCreated'));
            void userContext.refreshWorkspace();
          } catch (error) {
            alertApiV1Error(error, t('errors:create'));
          }
        }}
        validate={(values) => validateIce(values)}
      >
        {({ values, handleChange, handleSubmit, isSubmitting, errors, touched }) => (
          <form onSubmit={handleSubmit} className={'flex flex-col gap-2'}>
            <FormControl>
              <Label htmlFor={'identifier'} className="flex-row items-center justify-between">
                <LabelText>{t('common:identifierAz')}</LabelText>
                <LabelTextAlt className="text-error">
                  <span>{errors.identifier && touched.identifier ? errors.identifier : ''}</span>
                  <span>{t('common:required')}</span>
                </LabelTextAlt>
              </Label>
              <Input id={'identifier'} name={'identifier'} value={values.identifier} onChange={handleChange} />
            </FormControl>
            <LabelTranslationInputs locales={labelLocales} />
            <div className={'flex justify-end gap-2'}>
              <Button
                variant="outline"
                className="border-error text-error hover:bg-error/10"
                type={'button'}
                onClick={() => {
                  modalContext.closeModal();
                }}
              >
                {t('common:cancel')}
              </Button>
              <Button variant="primary" type={'submit'} disabled={isSubmitting || labelLocales.length === 0}>
                {isSubmitting ? <Loading size="sm" /> : null}
                {t('common:create')}
              </Button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  );
}
