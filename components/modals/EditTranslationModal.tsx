import { Formik } from 'formik';
import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { useRouter } from 'next/router';
import { Button, FormControl, Input, Label, LabelText, LabelTextAlt, Loading } from '@components/ui';
import { z } from 'zod';
import { zodFormikValidate } from '@lib/forms/zodFormikValidate';
import { upsertTranslation } from '@lib/network/workspaces';
import { alertApiV1Error } from '@lib/network/apiV1';
import { useLabelLocales } from '@components/settings/EntityTranslationLabels';
import { activeLabelValues, initialLabelValues, LabelTranslationInputs, labelValuesSchema } from '@components/settings/LabelTranslationInputs';

interface TranslationModalProps {
  slang: string;
  identifier: string;
}

export default function EditTranslationModal(props: TranslationModalProps) {
  const { t } = useTranslation(['settings', 'common']);
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const router = useRouter();

  const { workspaceId } = router.query;
  const labelLocales = useLabelLocales();

  const translationSchema = z.object({
    labels: labelValuesSchema(labelLocales, t('settings:validation.invalidLabel')),
  });

  const validateTranslation = zodFormikValidate(translationSchema);

  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'text-2xl font-bold'}>{t('settings:slang.adjust', { name: props.slang })}</div>
      <Formik
        initialValues={{
          labels: initialLabelValues(userContext.translations, props.identifier),
        }}
        onSubmit={async (values) => {
          try {
            if (!workspaceId || labelLocales.length === 0) return;
            const translations = activeLabelValues(values.labels, labelLocales);
            await upsertTranslation(workspaceId, {
              key: props.identifier,
              translations,
            });
            userContext.patchTranslations(props.identifier, translations);
            modalContext.closeModal();
            alertService.success(t('settings:savedTranslation', { name: props.slang }));
            void userContext.refreshWorkspace();
          } catch (error) {
            alertApiV1Error(error, t('settings:errorSaveTranslation', { name: props.slang }));
          }
        }}
        validate={(values) => validateTranslation(values)}
      >
        {({ handleChange, handleSubmit, isSubmitting }) => (
          <form onSubmit={handleSubmit} className={'flex flex-col gap-2'}>
            <FormControl>
              <Label className="flex-row items-center justify-between">
                <LabelText>{t('common:identifier')}</LabelText>
                <LabelTextAlt className="text-error"></LabelTextAlt>
              </Label>
              <Input id={'identifier'} readOnly={true} name={'identifier'} value={props.identifier} onChange={handleChange} disabled />
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
                {t('common:save')}
              </Button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  );
}
