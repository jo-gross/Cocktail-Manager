import { WorkspaceCocktailRecipeStepAction } from '@prisma/client';
import { Field, Formik } from 'formik';
import React, { useContext } from 'react';
import { UserContext } from '../../lib/context/UserContextProvider';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import { alertService } from '../../lib/alertService';
import { useRouter } from 'next/router';

interface CocktailStepActionModalProps {
  cocktailStepAction?: WorkspaceCocktailRecipeStepAction;
  cocktailStepActionGroups?: string[];
}

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
            const body = {
              name: values.action,
              actionGroup: values.actionGroup?.trim() == '' ? null : values.actionGroup?.trim(),
              translations: {
                de: values.lableDE,
              },
            };
            if (props.cocktailStepAction == undefined) {
              const response = await fetch(`/api/workspaces/${workspaceId}/actions`, {
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
            } else {
              const response = await fetch(`/api/workspaces/${workspaceId}/actions/${props.cocktailStepAction.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
              if (response.status.toString().startsWith('2')) {
                router.reload();
                modalContext.closeModal();
                alertService.success('Zubereitungsmethode erfolgreich gespeichert');
              } else {
                const body = await response.json();
                console.error('CocktailStepActionModal -> onSubmit[update]', response);
                alertService.error(body.message ?? 'Fehler beim Speichern der Zubereitungsmethode', response.status, response.statusText);
              }
            }
          } catch (error) {
            console.error('CocktailStepActionModal -> onSubmit', error);
            alertService.error('Es ist ein Fehler aufgetreten');
          }
        }}
        validate={(values) => {
          const errors: { [key: string]: string } = {};

          if (values.actionGroup.trim() != '') {
            if (!/^[A-Z_]+$/.test(values.actionGroup)) {
              errors.newActionGroup = 'Nur A-Z und _ erlaubt';
            }
          } else {
            errors.newActionGroup = 'Ungültiger Identifier';
          }

          if (!values.action || values.action.trim() == '') {
            errors.action = 'Ungültiger Identifier';
          } else {
            if (!/^[A-Z_]+$/.test(values.action)) {
              errors.action = 'Nur A-Z und _ erlaubt';
            }
          }

          if (!values.lableDE || values.lableDE.trim() == '') {
            errors.lableDE = 'Ungültiger Bezeichner';
          }

          return errors;
        }}
      >
        {({ values, handleChange, handleSubmit, isSubmitting, errors, touched, setFieldValue }) => (
          <form onSubmit={handleSubmit} className={'flex flex-col gap-2'}>
            <div role={'group'}>
              {props.cocktailStepActionGroups?.map((actionGroup) => (
                <div key={`action-group-radio-${actionGroup}`} className={'form-control'}>
                  <label className={'label cursor-pointer justify-start gap-2'}>
                    <Field type={'radio'} className={'radio'} name={'actionGroup'} value={actionGroup} />
                    <span className={'label-text w-full'}>
                      {userContext.getTranslation(actionGroup, 'de')} ({actionGroup})
                    </span>
                  </label>
                </div>
              ))}
              <div key={`action-group-radio-new-group`} className={'form-control'}>
                <label className={'label cursor-pointer justify-start gap-2'}>
                  <Field type={'radio'} name={'actionGroup'} className={'radio'} value={values.newActionGroup} />
                  <div className={'label-text'}>Neuen Gruppe-Identifier (A-Z,_)</div>
                  <div>
                    <div className={'label-text-alt text-end text-error'}>
                      <span>{errors.newActionGroup && touched.newActionGroup ? errors.newActionGroup : ''}</span>
                    </div>
                    <input
                      id={'newActionGroup'}
                      name={'newActionGroup'}
                      value={values.newActionGroup}
                      onChange={async (event) => {
                        handleChange(event);
                        await setFieldValue('actionGroup', event.target.value);
                      }}
                      className={'input input-bordered w-full'}
                    />
                  </div>
                </label>
              </div>
            </div>
            <div className={'grid grid-cols-2 gap-2'}>
              <div className={'form-control'}>
                <label className={'label'}>
                  <div className={'label-text'}>Identifier (A-Z,_)</div>
                  <div className={'label-text-alt text-error'}>
                    <span>{errors.action && touched.action ? errors.action : ''}</span>
                    <span>*</span>
                  </div>
                </label>
                <input
                  id={'action'}
                  readOnly={props.cocktailStepAction != undefined}
                  name={'action'}
                  value={values.action}
                  onChange={handleChange}
                  className={`input input-bordered ${props.cocktailStepAction != undefined ? 'input-disabled' : ''}`}
                />
              </div>
              <div className={'form-control'}>
                <label className={'label'}>
                  <div className={'label-text'}>Deutsch</div>
                  <div className={'label-text-alt text-error'}>
                    <span>{errors.lableDE && touched.lableDE ? errors.lableDE : ''}</span>
                    <span>*</span>
                  </div>
                </label>
                <input id={'lableDE'} name={'lableDE'} value={values.lableDE} onChange={handleChange} className={'input input-bordered'} />
              </div>
            </div>
            <div className={'flex justify-end gap-2'}>
              <button
                className={'btn btn-outline btn-error'}
                type={'button'}
                onClick={() => {
                  modalContext.closeModal();
                }}
              >
                Abbrechen
              </button>
              <button className={'btn btn-primary'} type={'submit'}>
                {isSubmitting ? <span className={'spinner loading-spinner'} /> : <></>}
                {props.cocktailStepAction == undefined ? 'Erstellen' : 'Speichern'}
              </button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  );
}
