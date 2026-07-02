import { BsSearch } from 'react-icons/bs';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { Button, ButtonGroup, Input, Loading } from '@components/ui';

interface SelectModalProps<T> {
  title: string;
  onElementSelected?: (t: T) => void;
  selectionLabel?: string;
  fetchElements: (search: string) => Promise<T[]>;
  elementComponent: (t: T) => React.JSX.Element;
  compareFunction?: (t1: T, t2: T) => number;
  getElementId?: (t: T) => string;
  selectedIds?: Set<string> | string[];
}

export function SelectModal<T>(props: SelectModalProps<T>) {
  const modalContext = useContext(ModalContext);

  const [search, setSearch] = useState('');
  const [elements, setElements] = useState<T[]>([]);
  const [isLoading, setLoading] = useState(false);

  const selectedIdsSet = React.useMemo(() => {
    if (!props.selectedIds) return new Set<string>();
    if (Array.isArray(props.selectedIds)) {
      return new Set(props.selectedIds);
    }
    return props.selectedIds;
  }, [props.selectedIds]);

  const isElementSelected = (element: T): boolean => {
    if (!props.getElementId || selectedIdsSet.size === 0) return false;
    const id = props.getElementId(element);
    return selectedIdsSet.has(id);
  };

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
      <ButtonGroup className="pb-2">
        <Input
          joinItem
          className="w-full"
          value={search}
          autoFocus={true}
          onChange={async (e) => {
            setSearch(e.target.value);
            if (e.target.value.trim().length != 0) {
              await fetchElements();
            }
          }}
        />
        <Button joinItem variant="outline" shape="square" type="button" tabIndex={-1}>
          <BsSearch />
        </Button>
      </ButtonGroup>
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
          elements.sort(props.compareFunction).map((element, index) => {
            const isSelected = isElementSelected(element);
            return (
              <div
                key={'select-modal-' + index}
                tabIndex={index}
                className={`rounded-box border border-base-300 bg-base-100 ${isSelected ? 'opacity-60' : ''}`}
              >
                <div className={`md:p-3' flex justify-between p-2 text-xl font-medium`}>
                  {props.elementComponent(element)}
                  <Button
                    type="button"
                    disabled={isSelected}
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      props.onElementSelected?.(element);
                      setSearch('');
                      modalContext.closeModal();
                    }}
                  >
                    {props.selectionLabel ?? 'Auswählen'}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </>
    </div>
  );
}
