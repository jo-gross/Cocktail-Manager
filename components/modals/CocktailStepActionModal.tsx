import { WorkspaceCocktailRecipeStepAction } from '@prisma/client';
import { Field, Formik } from 'formik';
import React, { useContext } from 'react';
import { UserContext } from '../../lib/context/UserContextProvider';
import { ModalContext } from '../../lib/context/ModalContextProvider';

interface CocktailStepActionModalProps {
  cocktailStepAction?: WorkspaceCocktailRecipeStepAction;
  cocktailStepActionGroups?: string[];
  onSaved: () => void;
}

export default function CocktailStepActionModal(props: CocktailStepActionModalProps) {
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'text-2xl font-bold'}>Zubereitungsschritt Anpassen</div>
      <Formik
        initialValues={{
          actionGroup: props.cocktailStepAction?.actionGroup || '',
          action: props.cocktailStepAction?.name || '',
          description: '',
          newActionGroup: '',
          lableDE: props.cocktailStepAction != undefined ? userContext.getTranslation(props.cocktailStepAction.name, 'de') : '',
        }}
        onSubmit={(values) => {
          alert(JSON.stringify(values));
        }}
        validate={(values) => {
          const errors: { [key: string]: string } = {};

          if (values.actionGroup.trim() != '') {
            if (!/^[A-Z_]+$/.test(values.actionGroup)) {
              errors.newActionGroup = 'Nur A-Z und _ erlaubt';
            }
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

          console.log(errors);

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
                <input id={'action'} name={'action'} value={values.action} onChange={handleChange} className={'input input-bordered'} />
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
                className={'btn btn-error'}
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
