import { BsSearch } from 'react-icons/bs';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Loading } from '../Loading';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';

interface SelectModalProps<T> {
  title: string;
  onElementSelected?: (t: T) => void;
  selectionLabel?: string;
  fetchElements: (search: string) => Promise<T[]>;
  elementComponent: (t: T) => JSX.Element;
  compareFunction?: (t1: T, t2: T) => number;
}

export function SelectModal<T>(props: SelectModalProps<T>) {
  const modalContext = useContext(ModalContext);

  const [search, setSearch] = useState('');
  const [elements, setElements] = useState<T[]>([]);
  const [isLoading, setLoading] = useState(false);

  const fetchElements = useCallback(async () => {
    try {
      setLoading(true);
      const elements = await props.fetchElements(search);
      setElements(elements);
    } catch (error) {
      console.error('SelectModal -> fetchElements', error);
      alertService.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  }, [props, search]);

  useEffect(() => {
    fetchElements();
  }, [fetchElements]);

  return (
    <div className={'grid w-full grid-cols-1 gap-2 p-0.5 md:p-2'}>
      <div className={'w-max text-2xl font-bold'}>{props.title}</div>
      <div className={'join pb-2'}>
        <input
          className={'input join-item input-bordered w-full'}
          value={search}
          autoFocus={true}
          onChange={async (e) => {
            setSearch(e.target.value);
            if (e.target.value.trim().length != 0) {
              await fetchElements();
            }
          }}
        />
        <span className={'btn btn-square btn-outline btn-primary join-item'}>
          <BsSearch />
        </span>
      </div>
      <>
        {isLoading ? (
          <Loading />
        ) : elements.length == 0 ? (
          search != '' ? (
            <div>Keine Einträge gefunden</div>
          ) : (
            <div>Bitte gib deine Suche ein</div>
          )
        ) : (
          elements.sort(props.compareFunction).map((element, index) => (
            <div key={'select-modal-' + index} tabIndex={index} className={`rounded-box border border-base-300 bg-base-100`}>
              <div className={`md:p-3' flex justify-between p-2 text-xl font-medium`}>
                {props.elementComponent(element)}
                <button
                  type="button"
                  className={'btn btn-primary btn-sm'}
                  onClick={() => {
                    props.onElementSelected?.(element);
                    setSearch('');
                    modalContext.closeModal();
                  }}
                >
                  {props.selectionLabel ?? 'Auswählen'}
                </button>
              </div>
            </div>
          ))
        )}
      </>
    </div>
  );
}
