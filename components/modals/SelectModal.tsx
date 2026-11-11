import { BsSearch } from 'react-icons/bs';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { useTranslation } from 'react-i18next';
import { ButtonGroup, Input, InputAddon, Loading } from '@components/ui';

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
  const { t } = useTranslation(['common', 'errors']);

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
      alertService.error(t('errors:load'));
    } finally {
      setLoading(false);
    }
  }, [props, search]);

  useEffect(() => {
    fetchElements();
  }, [fetchElements]);

  return (
    <div className="flex w-[min(36rem,calc(100vw-3rem))] flex-col gap-3">
      <h2 className="pr-10 text-2xl font-bold">{props.title}</h2>
      <ButtonGroup>
        <InputAddon aria-hidden>
          <BsSearch />
        </InputAddon>
        <Input
          joinItem
          type="search"
          aria-label={props.title}
          placeholder={t('common:search')}
          value={search}
          autoFocus={true}
          onChange={async (e) => {
            setSearch(e.target.value);
            if (e.target.value.trim().length != 0) {
              await fetchElements();
            }
          }}
        />
      </ButtonGroup>
      {isLoading ? (
        <Loading />
      ) : elements.length == 0 ? (
        <p className="py-4 text-center text-sm text-base-content/60">{search != '' ? t('common:noEntriesFound') : t('common:pleaseEnterSearch')}</p>
      ) : (
        // The whole row is the tap target (≥ 56px) instead of a small "Select" button.
        <ul className="flex flex-col gap-2">
          {elements.sort(props.compareFunction).map((element, index) => {
            const isSelected = isElementSelected(element);
            return (
              <li key={'select-modal-' + index}>
                <button
                  type="button"
                  disabled={isSelected}
                  onClick={() => {
                    props.onElementSelected?.(element);
                    setSearch('');
                    modalContext.closeModal();
                  }}
                  className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-base-300 bg-base-100 px-4 py-2 text-left text-lg font-medium transition-colors hover:bg-base-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:cursor-default disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1">{props.elementComponent(element)}</span>
                  <span className="shrink-0 text-sm font-medium text-primary">
                    {isSelected ? t('common:selected') : (props.selectionLabel ?? t('common:select'))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
