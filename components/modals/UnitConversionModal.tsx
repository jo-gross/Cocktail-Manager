import { Unit, UnitConversion } from '@prisma/client';
import { Formik } from 'formik';
import React, { useContext } from 'react';
import { UserContext } from '../../lib/context/UserContextProvider';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import { useRouter } from 'next/router';
import { FaArrowsLeftRight } from 'react-icons/fa6';
import { alertService } from '../../lib/alertService';

interface UnitConversionModalProps {
  unitConversion?: UnitConversion;
  units: Unit[];
  existingConversions?: UnitConversion[];
  onSaved?: () => void;
}

export default function UnitConversionModal(props: UnitConversionModalProps) {
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const router = useRouter();

  const { workspaceId } = router.query;

  return (
    <div className={'flex flex-col gap-2'}>
      <div className={'text-2xl font-bold'}>Einheit Umrechnen</div>
      <Formik
        initialValues={{
          fromUnitId: props.unitConversion?.fromUnitId || '',
          toUnitId: props.unitConversion?.toUnitId || '',
          factor: props.unitConversion?.factor || 1,
        }}
        onSubmit={async (values) => {
          try {
            if (props.unitConversion == undefined) {
              const body = {
                fromUnitId: values.fromUnitId,
                toUnitId: values.toUnitId,
                factor: 1 / values.factor,
              };
              const response = await fetch(`/api/workspaces/${workspaceId}/units/conversions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
              if (response.status.toString().startsWith('2')) {
                props.onSaved?.();
                modalContext.closeModal();
                alertService.success('Umrechnung erfolgreich erstellt');
              } else {
                const body = await response.json();
                console.error('UnitConversionModal -> onSubmit[create]', response);
                alertService.error(body.message ?? 'Fehler beim Erstellen der Umrechnung', response.status, response.statusText);
              }
            } else {
              const body = {
                factor: values.factor,
              };
              const response = await fetch(`/api/workspaces/${workspaceId}/units/conversions/${props.unitConversion.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
              if (response.status.toString().startsWith('2')) {
                props.onSaved?.();
                modalContext.closeModal();
                alertService.success('Umrechnung erfolgreich gespeichert');
              } else {
                const body = await response.json();
                console.error('UnitConversionModal -> onSubmit[update]', response);
                alertService.error(body.message ?? 'Fehler beim Speichern der Umrechnung', response.status, response.statusText);
              }
            }
          } catch (error) {
            console.error('UnitConversionModal -> onSubmit', error);
            alertService.error('Es ist ein Fehler aufgetreten');
          }
        }}
        validate={(values) => {
          const errors: { [key: string]: string } = {};

          if (!values.fromUnitId || values.fromUnitId.trim() == '') {
            errors.fromUnitId = 'Pflichtfeld';
          }
          if (!values.toUnitId || values.toUnitId.trim() == '') {
            errors.toUnitId = 'Pflichtfeld';
          }
          if (!isNaN(values.factor) && values.factor <= 0) {
            errors.factor = 'Faktor muss größer als 0 sein';
          }

          return errors;
        }}
      >
        {({ values, handleChange, handleSubmit, isSubmitting, errors, touched, setFieldValue }) => (
          <form onSubmit={handleSubmit} className={'flex flex-col gap-2'}>
            <div className={'flex flex-row items-center justify-center gap-4'}>
              <div className={'form-control w-full'}>
                <label className={'label'}>
                  <div className={'label-text'}>Von Einheit...</div>
                  <div className={'label-text-alt text-error'}>
                    <span>{errors.fromUnitId && touched.fromUnitId ? errors.fromUnitId : ''}</span>
                    <span>*</span>
                  </div>
                </label>
                <div className={'join'}>
                  <div className={'btn btn-secondary join-item'}>1</div>
                  <select
                    className={'join-item select select-bordered w-full'}
                    name={'fromUnitId'}
                    disabled={props.unitConversion != undefined}
                    onChange={async (e) => {
                      handleChange(e);
                      await setFieldValue('toUnitId', '');
                    }}
                    value={values.fromUnitId}
                  >
                    <option value={''} disabled>
                      Auswählen...
                    </option>
                    {props.units.map((unit) => {
                      return (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className={'flex flex-row items-center justify-center pt-8 text-2xl'}>
                <FaArrowsLeftRight />
              </div>

              <div className={'form-control w-full'}>
                <label className={'label'}>
                  <div className={'label-text'}>... zu Einheit</div>
                  <div className={'label-text-alt text-error'}>
                    <span>{errors.toUnitId && touched.toUnitId ? errors.toUnitId : errors.factor && touched.factor ? errors.factor : ''}</span>
                    <span>*</span>
                  </div>
                </label>
                <div className={'join'}>
                  <input
                    type={'number'}
                    name={'factor'}
                    onChange={handleChange}
                    value={values.factor}
                    placeholder={'x'}
                    className={'input join-item input-secondary w-20'}
                  />
                  <select
                    disabled={props.unitConversion != undefined}
                    className={'join-item select select-bordered w-full'}
                    name={'toUnitId'}
                    onChange={handleChange}
                    value={values.toUnitId}
                  >
                    <option value={''} disabled>
                      Auswählen...
                    </option>
                    {props.units.map((unit) => {
                      return (
                        <option
                          key={unit.id}
                          value={unit.id}
                          disabled={
                            values.fromUnitId == unit.id ||
                            props.existingConversions?.find(
                              (item) =>
                                (item.fromUnitId == values.fromUnitId && item.toUnitId == unit.id) ||
                                (item.toUnitId == values.fromUnitId && item.fromUnitId == unit.id),
                            ) != undefined
                          }
                        >
                          {unit.name}
                        </option>
                      );
                    })}
                  </select>
                </div>
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
                Speichern
              </button>
            </div>
          </form>
        )}
      </Formik>
    </div>
  );
}
