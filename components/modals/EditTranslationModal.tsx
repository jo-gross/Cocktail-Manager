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

  const translationSchema = z.object({
    labelDe: z.string().trim().min(1, t('settings:validation.invalidLabel')),
    labelEn: z.string(),
  });

  const validateTranslation = zodFormikValidate(translationSchema);

  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'text-2xl font-bold'}>{t('settings:slang.adjust', { name: props.slang })}</div>
      <Formik
        initialValues={{
          labelDe: userContext.translations?.de?.[props.identifier] ?? '',
          labelEn: userContext.translations?.en?.[props.identifier] ?? '',
        }}
        onSubmit={async (values) => {
          try {
            if (!workspaceId) return;
            await upsertTranslation(workspaceId, {
              key: props.identifier,
              translations: {
                de: values.labelDe.trim(),
                en: values.labelEn.trim(),
              },
            });
            userContext.patchTranslations(props.identifier, {
              de: values.labelDe.trim(),
              en: values.labelEn.trim(),
            });
            modalContext.closeModal();
            alertService.success(t('settings:savedTranslation', { name: props.slang }));
            void userContext.refreshWorkspace();
          } catch (error) {
            alertApiV1Error(error, t('settings:errorSaveTranslation', { name: props.slang }));
          }
        }}
        validate={(values) => validateTranslation(values)}
      >
        {({ values, handleChange, handleSubmit, isSubmitting, errors, touched }) => (
          <form onSubmit={handleSubmit} className={'flex flex-col gap-2'}>
            <FormControl>
              <Label className="flex-row items-center justify-between">
                <LabelText>{t('common:identifier')}</LabelText>
                <LabelTextAlt className="text-error"></LabelTextAlt>
              </Label>
              <Input id={'identifier'} readOnly={true} name={'identifier'} value={props.identifier} onChange={handleChange} disabled />
            </FormControl>
            <div className={'grid grid-cols-2 gap-2'}>
              <FormControl>
                <Label className="flex-row items-center justify-between">
                  <LabelText>{t('settings:labelDe')}</LabelText>
                  <LabelTextAlt className="text-error">
                    <span>{errors.labelDe && touched.labelDe ? errors.labelDe : ''}</span>
                    <span>{t('common:required')}</span>
                  </LabelTextAlt>
                </Label>
                <Input id={'labelDe'} name={'labelDe'} value={values.labelDe} onChange={handleChange} />
              </FormControl>
              <FormControl>
                <Label className="flex-row items-center justify-between">
                  <LabelText>{t('settings:labelEn')}</LabelText>
                  <LabelTextAlt className="text-error">
                    <span>{errors.labelEn && touched.labelEn ? errors.labelEn : ''}</span>
                  </LabelTextAlt>
                </Label>
                <Input id={'labelEn'} name={'labelEn'} value={values.labelEn} onChange={handleChange} />
                {!values.labelEn.trim() ? <span className="text-xs text-base-content/60">{t('settings:missingEnHint')}</span> : null}
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
                {t('common:cancel')}
              </Button>
              <Button variant="primary" type={'submit'}>
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
