import { FaEllipsisV, FaFileDownload, FaHistory, FaRegClone, FaRegEdit, FaTrashAlt } from 'react-icons/fa';
import { useRouter } from 'next/router';
import { alertService } from '@lib/alertService';
import { useContext, useState, useRef, useEffect, useCallback } from 'react';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UserContext } from '@lib/context/UserContextProvider';
import Link from 'next/link';
import { Role } from '@generated/prisma/client';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { DeleteConfirmationModal } from './modals/DeleteConfirmationModal';
import InputModal from './modals/InputModal';
import { createPortal } from 'react-dom';
import { AuditLogHistoryModal } from './modals/AuditLogHistoryModal';
import { Button, Divider, Loading, Menu } from '@components/ui';
import { alertApiV1Error, apiV1Fetch, apiV1Mutate } from '@lib/network/apiV1';

interface ManageColumnProps {
  id: string;
  name: string;
  entity: 'cocktails' | 'ingredients' | 'glasses' | 'garnishes' | 'calculations';
  onRefresh: () => void;
  editRole?: Role;
  deleteRole?: Role;
  onExportJson?: (id: string) => void;
  onExportPdf?: (id: string) => void;
  exportingJson?: boolean;
  exportingPdf?: boolean;
  customActions?: {
    label: string;
    icon?: ReactNode;
    onClick: (id: string) => void;
    disabled?: boolean;
    isDanger?: boolean;
  }[];
}

interface _Reference {
  id: string;
  name: string;
}

export function ManageColumn(props: ManageColumnProps) {
  const { t } = useTranslation(['common', 'entity', 'errors']);
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);
  const [isCheckingReferences, setIsCheckingReferences] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Dropdown state for portal-based rendering
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const calculateDropdownPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 208; // w-52 = 13rem = 208px
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Get actual dropdown height if it exists, otherwise estimate
      const actualDropdownHeight = dropdownRef.current?.getBoundingClientRect().height || 120;
      const margin = 8; // Consistent margin (mt-2)

      let top = rect.bottom + margin; // Position below button
      let left = rect.right - dropdownWidth; // Align to the right (dropdown-end)

      // Check if dropdown would overflow bottom of viewport - open upward instead
      if (top + actualDropdownHeight > viewportHeight) {
        top = rect.top - actualDropdownHeight - margin;
      }

      // Ensure dropdown doesn't overflow left side of viewport
      if (left < 8) {
        left = 8;
      }

      // Ensure dropdown doesn't overflow right side of viewport
      if (left + dropdownWidth > viewportWidth - 8) {
        left = viewportWidth - dropdownWidth - 8;
      }

      setDropdownPosition({ top, left });
    }
  }, []);

  const handleToggleDropdown = useCallback(() => {
    if (!isDropdownOpen) {
      calculateDropdownPosition();
      // Recalculate after render to get actual dropdown height
      requestAnimationFrame(() => {
        calculateDropdownPosition();
      });
    }
    setIsDropdownOpen(!isDropdownOpen);
  }, [isDropdownOpen, calculateDropdownPosition]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isDropdownOpen &&
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    const handleScroll = () => {
      if (isDropdownOpen) {
        calculateDropdownPosition();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', calculateDropdownPosition);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', calculateDropdownPosition);
    };
  }, [isDropdownOpen, calculateDropdownPosition]);

  const deleteEntity = async () => {
    if (!workspaceId) return;
    try {
      await apiV1Mutate(`/api/v1/workspaces/${workspaceId}/${props.entity}/${props.id}`, 'DELETE');
      props.onRefresh();
      alertService.success(t('common:success.deleted'));
    } catch (error) {
      alertApiV1Error(error, t('errors:delete'));
    }
  };

  const handleDeleteClick = async () => {
    // Only check references for ingredients and glasses
    if ((props.entity === 'ingredients' || props.entity === 'glasses') && workspaceId) {
      setIsCheckingReferences(true);
      try {
        // v1 returns the referencing cocktails directly as `data: { id, name }[]`.
        const references = await apiV1Fetch<_Reference[]>(`/api/v1/workspaces/${workspaceId}/${props.entity}/${props.id}/references`);

        if (references.length > 0) {
          modalContext.openModal(
            <DeleteConfirmationModal
              spelling={'DELETE'}
              entityName={props.name}
              entityType={props.entity === 'ingredients' ? 'ingredient' : 'glass'}
              references={references}
              onApprove={deleteEntity}
            />,
          );
        } else {
          modalContext.openModal(
            <DeleteConfirmationModal
              spelling={'DELETE'}
              entityName={props.name}
              entityType={props.entity === 'ingredients' ? 'ingredient' : 'glass'}
              onApprove={deleteEntity}
            />,
          );
        }
      } catch (error) {
        alertApiV1Error(error, t('errors:checkReferences'));
      } finally {
        setIsCheckingReferences(false);
      }
    } else {
      // Other entities: delete confirmation without reference check
      modalContext.openModal(<DeleteConfirmationModal spelling={'DELETE'} entityName={props.name} onApprove={deleteEntity} />);
    }
  };

  const handleDuplicateClick = () => {
    if (!workspaceId) return;

    const duplicateKeyByEntity = {
      cocktails: 'cocktail',
      ingredients: 'ingredient',
      glasses: 'glass',
      garnishes: 'garnish',
    } as const;

    if (props.entity === 'calculations') return;

    const duplicateKey = duplicateKeyByEntity[props.entity];

    modalContext.openModal(
      <InputModal
        title={t(`entity:duplicate.${duplicateKey}`)}
        description={t('common:copyNamePrompt')}
        onInputSubmit={async (value) => {
          try {
            setIsDuplicating(true);
            const cloned = await apiV1Mutate<{ id: string }>(`/api/v1/workspaces/${workspaceId}/${props.entity}/${props.id}/clone`, 'POST', { name: value });
            alertService.success(t(`entity:duplicate.success.${duplicateKey}`));
            props.onRefresh();
            await router.push(`/workspaces/${workspaceId}/manage/${props.entity}/${cloned.id}`);
          } catch (error) {
            alertApiV1Error(error, t(`entity:duplicate.error.${duplicateKey}`));
            throw error;
          } finally {
            setIsDuplicating(false);
          }
        }}
        allowEmpty={false}
        defaultValue={`${props.name} ${t('common:copyNameSuffix')}`}
      />,
    );
  };

  const canEdit = userContext.isUserPermitted(props.editRole ?? Role.MANAGER);
  const canDelete = userContext.isUserPermitted(props.deleteRole ?? Role.ADMIN);
  const canDuplicate =
    (props.entity === 'cocktails' || props.entity === 'ingredients' || props.entity === 'glasses' || props.entity === 'garnishes') &&
    userContext.isUserPermitted(Role.MANAGER);
  const hasExportActions = Boolean(props.onExportJson || props.onExportPdf);
  const _hasCustomActions = Boolean(props.customActions && props.customActions.length > 0);
  const hasDuplicateOrExportActions = canDuplicate || hasExportActions;

  if (!canEdit) {
    return <td></td>;
  }

  const dropdownMenu =
    isDropdownOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: dropdownPosition.top,
              left: dropdownPosition.left,
            }}
          >
            <Menu
              size="sm"
              className="z-[9999] w-52 gap-1 rounded-box border border-base-200 bg-base-100 p-2 shadow-lg [&_a]:flex [&_a]:items-center [&_a]:gap-2 [&_a]:rounded-field [&_a]:px-3 [&_a]:py-2 [&_a]:hover:bg-base-200 [&_button]:flex [&_button]:w-full [&_button]:items-center [&_button]:gap-2 [&_button]:rounded-field [&_button]:px-3 [&_button]:py-2 [&_button]:text-left [&_button]:hover:bg-base-200"
            >
              <li>
                <Link
                  href={`/workspaces/${workspaceId}/manage/${props.entity}/${props.id}`}
                  className="flex items-center gap-2"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  <FaRegEdit />
                  {t('common:edit')}
                </Link>
              </li>
              {props.customActions?.map((action, index) => (
                <li key={`custom-action-${index}`}>
                  <button
                    type="button"
                    className={`flex items-center gap-2 ${action.isDanger ? 'text-error' : ''}`}
                    onClick={() => {
                      setIsDropdownOpen(false);
                      action.onClick(props.id);
                    }}
                    disabled={action.disabled}
                  >
                    {action.icon}
                    {action.label}
                  </button>
                </li>
              ))}
              {hasDuplicateOrExportActions && <Divider size="sm" className="my-1" />}
              {props.onExportJson && (
                <li>
                  <button
                    type="button"
                    className="flex items-center gap-2"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      props.onExportJson?.(props.id);
                    }}
                    disabled={props.exportingJson}
                  >
                    {props.exportingJson ? <Loading size="sm" /> : <FaFileDownload />}
                    {t('common:exportAsJson')}
                  </button>
                </li>
              )}
              {props.onExportPdf && (
                <li>
                  <button
                    type="button"
                    className="flex items-center gap-2"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      props.onExportPdf?.(props.id);
                    }}
                    disabled={props.exportingPdf}
                  >
                    {props.exportingPdf ? <Loading size="sm" /> : <FaFileDownload />}
                    {t('common:exportAsPdf')}
                  </button>
                </li>
              )}
              {canDuplicate && (
                <li>
                  <button
                    type="button"
                    className="flex items-center gap-2"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      handleDuplicateClick();
                    }}
                    disabled={isDuplicating}
                  >
                    {isDuplicating ? <Loading size="sm" /> : <FaRegClone />}
                    {t('common:duplicate')}
                  </button>
                </li>
              )}
              <Divider size="sm" className="my-1" />
              <li>
                <button
                  type="button"
                  className="flex items-center gap-2"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    modalContext.openModal(
                      <AuditLogHistoryModal
                        entityType={
                          props.entity === 'cocktails'
                            ? 'CocktailRecipe'
                            : props.entity === 'ingredients'
                              ? 'Ingredient'
                              : props.entity === 'glasses'
                                ? 'Glass'
                                : props.entity === 'garnishes'
                                  ? 'Garnish'
                                  : 'CocktailCalculation'
                        }
                        entityId={props.id}
                        entityName={props.name}
                      />,
                    );
                  }}
                >
                  <FaHistory />
                  {t('common:showHistory')}
                </button>
              </li>
              {canDelete && <Divider size="sm" className="my-1" />}
              {canDelete && (
                <li>
                  <button
                    type="button"
                    className="flex items-center gap-2 text-error"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      handleDeleteClick();
                    }}
                    disabled={isCheckingReferences}
                  >
                    {isCheckingReferences ? <Loading size="sm" /> : <FaTrashAlt />}
                    {t('common:delete')}
                  </button>
                </li>
              )}
            </Menu>
          </div>,
          document.body,
        )
      : null;

  return (
    <td>
      <div className={'flex items-center justify-end'}>
        <Button ref={buttonRef} type="button" variant="ghost" size="sm" onClick={handleToggleDropdown}>
          <FaEllipsisV />
        </Button>
        {dropdownMenu}
      </div>
    </td>
  );
}
