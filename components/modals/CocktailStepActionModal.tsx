import type { ActionDto } from '@lib/schemas/actions';
import { Field, Formik } from 'formik';
import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { useRouter } from 'next/router';
import { Button, FormControl, Input, Label, LabelText, LabelTextAlt, Loading, Radio } from '@components/ui';
import { z } from 'zod';
import { zodFormikValidate } from '@lib/forms/zodFormikValidate';
import { createAction, updateAction } from '@lib/network/actions';
import { alertApiV1Error } from '@lib/network/apiV1';

interface CocktailStepActionModalProps {
  cocktailStepAction?: ActionDto;
  cocktailStepActionGroups?: string[];
  onSaved?: () => void;
}

export default function CocktailStepActionModal(props: CocktailStepActionModalProps) {
  const { t } = useTranslation(['settings', 'common', 'entity', 'errors']);
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const router = useRouter();

  const { workspaceId } = router.query;

  const cocktailStepActionSchema = z
    .object({
      actionGroup: z.string(),
      action: z.string(),
      labelDe: z.string(),
      labelEn: z.string(),
    })
    .superRefine((values, ctx) => {
      // The action-group identifier is edited via the "newActionGroup" field, so
      // its error is reported on that path (mirrors the original inline validation).
      if (values.actionGroup.trim() != '') {
        if (!/^[A-Z_]+$/.test(values.actionGroup)) {
          ctx.addIssue({ code: 'custom', message: t('settings:validation.azOnly'), path: ['newActionGroup'] });
        }
      } else {
        ctx.addIssue({ code: 'custom', message: t('settings:validation.invalidIdentifier'), path: ['newActionGroup'] });
      }

      if (!values.action || values.action.trim() == '') {
        ctx.addIssue({ code: 'custom', message: t('settings:validation.invalidIdentifier'), path: ['action'] });
      } else if (!/^[A-Z_]+$/.test(values.action)) {
        ctx.addIssue({ code: 'custom', message: t('settings:validation.azOnly'), path: ['action'] });
      }

      if (!values.labelDe || values.labelDe.trim() == '') {
        ctx.addIssue({ code: 'custom', message: t('settings:validation.invalidLabel'), path: ['labelDe'] });
      }
    });

  const validateCocktailStepAction = zodFormikValidate(cocktailStepActionSchema);

  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'text-2xl font-bold'}>{props.cocktailStepAction == undefined ? t('settings:actionModal.create') : t('settings:actionModal.edit')}</div>
      <Formik
        initialValues={{
          actionGroup: props.cocktailStepAction?.actionGroup || '',
          action: props.cocktailStepAction?.name || '',
          description: '',
          newActionGroup: '',
          labelDe: props.cocktailStepAction != undefined ? (userContext.translations?.de?.[props.cocktailStepAction.name] ?? '') : '',
          labelEn: props.cocktailStepAction != undefined ? (userContext.translations?.en?.[props.cocktailStepAction.name] ?? '') : '',
        }}
        onSubmit={async (values) => {
          try {
            if (!workspaceId) return;
            const actionGroup = values.actionGroup?.trim();
            if (!actionGroup) {
              alertService.error(t('settings:validation.actionGroupRequired'));
              return;
            }
            const body = {
              name: values.action,
              actionGroup,
              translations: {
                de: values.labelDe.trim(),
                en: values.labelEn.trim(),
              },
            };
            if (props.cocktailStepAction == undefined) {
              await createAction(workspaceId, body);
              alertService.success(t('entity:actionCreated'));
            } else {
              await updateAction(workspaceId, props.cocktailStepAction.id, body);
              alertService.success(t('entity:actionSaved'));
            }
            userContext.patchTranslations(values.action, body.translations);
            props.onSaved?.();
            modalContext.closeModal();
            void userContext.refreshWorkspace();
          } catch (error) {
            alertApiV1Error(error, props.cocktailStepAction == undefined ? t('errors:create') : t('errors:save'));
          }
        }}
        validate={(values) => validateCocktailStepAction(values)}
      >
        {({ values, handleChange, handleSubmit, isSubmitting, errors, touched, setFieldValue }) => (
          <form onSubmit={handleSubmit} className={'flex flex-col gap-2'}>
            <div role={'group'}>
              {props.cocktailStepActionGroups?.map((actionGroup) => (
                <FormControl key={`action-group-radio-${actionGroup}`}>
                  <Label className="cursor-pointer flex-row items-center justify-start gap-2">
                    <Field type={'radio'} as={Radio} name={'actionGroup'} value={actionGroup} />
                    <LabelText className="w-full">
                      {userContext.getTranslation(actionGroup)} ({actionGroup})
                    </LabelText>
                  </Label>
                </FormControl>
              ))}
              <FormControl key={`action-group-radio-new-group`}>
                <Label className="cursor-pointer flex-row items-center justify-start gap-2">
                  <Field type={'radio'} as={Radio} name={'actionGroup'} value={values.newActionGroup} />
                  <div className="flex w-full flex-col">
                    <LabelText>{t('settings:newGroupIdentifier')}</LabelText>
                    <LabelTextAlt className="text-end text-error">
                      <span>{errors.newActionGroup && touched.newActionGroup ? errors.newActionGroup : ''}</span>
                    </LabelTextAlt>
                    <Input
                      id={'newActionGroup'}
                      name={'newActionGroup'}
                      value={values.newActionGroup}
                      onChange={async (event) => {
                        handleChange(event);
                        await setFieldValue('actionGroup', event.target.value);
                      }}
                      className="w-full"
                    />
                  </div>
                </Label>
              </FormControl>
            </div>
            <FormControl>
              <Label className="flex-row items-center justify-between">
                <LabelText>{t('common:identifierAz')}</LabelText>
                <LabelTextAlt className="text-error">
                  <span>{errors.action && touched.action ? errors.action : ''}</span>
                  <span>{t('common:required')}</span>
                </LabelTextAlt>
              </Label>
              <Input
                id={'action'}
                readOnly={props.cocktailStepAction != undefined}
                name={'action'}
                value={values.action}
                onChange={handleChange}
                disabled={props.cocktailStepAction != undefined}
              />
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
                {props.cocktailStepAction == undefined ? t('common:create') : t('common:save')}
              </Button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  );
}
