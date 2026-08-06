import type { ActionDto } from '@lib/schemas/actions';
import { Field, Formik } from 'formik';
import React, { useContext } from 'react';
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
}

const cocktailStepActionSchema = z
  .object({
    actionGroup: z.string(),
    action: z.string(),
    lableDE: z.string(),
  })
  .superRefine((values, ctx) => {
    // The action-group identifier is edited via the "newActionGroup" field, so
    // its error is reported on that path (mirrors the original inline validation).
    if (values.actionGroup.trim() != '') {
      if (!/^[A-Z_]+$/.test(values.actionGroup)) {
        ctx.addIssue({ code: 'custom', message: 'Nur A-Z und _ erlaubt', path: ['newActionGroup'] });
      }
    } else {
      ctx.addIssue({ code: 'custom', message: 'Ungültiger Identifier', path: ['newActionGroup'] });
    }

    if (!values.action || values.action.trim() == '') {
      ctx.addIssue({ code: 'custom', message: 'Ungültiger Identifier', path: ['action'] });
    } else if (!/^[A-Z_]+$/.test(values.action)) {
      ctx.addIssue({ code: 'custom', message: 'Nur A-Z und _ erlaubt', path: ['action'] });
    }

    if (!values.lableDE || values.lableDE.trim() == '') {
      ctx.addIssue({ code: 'custom', message: 'Ungültiger Bezeichner', path: ['lableDE'] });
    }
  });

const validateCocktailStepAction = zodFormikValidate(cocktailStepActionSchema);

export default function CocktailStepActionModal(props: CocktailStepActionModalProps) {
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const router = useRouter();

  const { workspaceId } = router.query;

  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'text-2xl font-bold'}>Zubereitungsschritt {props.cocktailStepAction == undefined ? 'Erstellen' : 'Anpassen'}</div>
      <Formik
        initialValues={{
          actionGroup: props.cocktailStepAction?.actionGroup || '',
          action: props.cocktailStepAction?.name || '',
          description: '',
          newActionGroup: '',
          lableDE: props.cocktailStepAction != undefined ? userContext.getTranslation(props.cocktailStepAction.name, 'de') : '',
        }}
        onSubmit={async (values) => {
          try {
            if (!workspaceId) return;
            const actionGroup = values.actionGroup?.trim();
            if (!actionGroup) {
              alertService.error('Aktionsgruppe ist erforderlich');
              return;
            }
            const body = {
              name: values.action,
              actionGroup,
              translations: {
                de: values.lableDE,
              },
            };
            if (props.cocktailStepAction == undefined) {
              await createAction(workspaceId, body);
              router.reload();
              modalContext.closeModal();
              alertService.success('Zubereitungsmethode erfolgreich erstellt');
            } else {
              await updateAction(workspaceId, props.cocktailStepAction.id, body);
              router.reload();
              modalContext.closeModal();
              alertService.success('Zubereitungsmethode erfolgreich gespeichert');
            }
          } catch (error) {
            alertApiV1Error(
              error,
              props.cocktailStepAction == undefined ? 'Fehler beim Erstellen der Zubereitungsmethode' : 'Fehler beim Speichern der Zubereitungsmethode',
            );
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
                      {userContext.getTranslation(actionGroup, 'de')} ({actionGroup})
                    </LabelText>
                  </Label>
                </FormControl>
              ))}
              <FormControl key={`action-group-radio-new-group`}>
                <Label className="cursor-pointer flex-row items-center justify-start gap-2">
                  <Field type={'radio'} as={Radio} name={'actionGroup'} value={values.newActionGroup} />
                  <div className="flex w-full flex-col">
                    <LabelText>Neuen Gruppe-Identifier (A-Z,_)</LabelText>
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
            <div className={'grid grid-cols-2 gap-2'}>
              <FormControl>
                <Label className="flex-row items-center justify-between">
                  <LabelText>Identifier (A-Z,_)</LabelText>
                  <LabelTextAlt className="text-error">
                    <span>{errors.action && touched.action ? errors.action : ''}</span>
                    <span>*</span>
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
                {props.cocktailStepAction == undefined ? 'Erstellen' : 'Speichern'}
              </Button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  );
}
