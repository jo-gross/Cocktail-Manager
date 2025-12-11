import React, { useEffect, useState } from 'react';
import { Permission } from '@generated/prisma/client';
import { FaInfoCircle } from 'react-icons/fa';

interface ApiKeyPermissionSelectorProps {
  selectedPermissions: Permission[];
  onChange: (permissions: Permission[]) => void;
  disabled?: boolean;
}

// Define permission categories for UI grouping
const permissionCategories: Record<string, { label: string; permissions: Permission[] }> = {
  COCKTAILS: {
    label: 'COCKTAILS',
    permissions: [Permission.COCKTAILS_READ, Permission.COCKTAILS_CREATE, Permission.COCKTAILS_UPDATE, Permission.COCKTAILS_DELETE],
  },
  INGREDIENTS: {
    label: 'INGREDIENTS',
    permissions: [Permission.INGREDIENTS_READ, Permission.INGREDIENTS_CREATE, Permission.INGREDIENTS_UPDATE, Permission.INGREDIENTS_DELETE],
  },
  GARNISHES: {
    label: 'GARNISHES',
    permissions: [Permission.GARNISHES_READ, Permission.GARNISHES_CREATE, Permission.GARNISHES_UPDATE, Permission.GARNISHES_DELETE],
  },
  GLASSES: {
    label: 'GLASSES',
    permissions: [Permission.GLASSES_READ, Permission.GLASSES_CREATE, Permission.GLASSES_UPDATE, Permission.GLASSES_DELETE],
  },
  UNITS: {
    label: 'UNITS',
    permissions: [Permission.UNITS_READ, Permission.UNITS_UPDATE],
  },
  QUEUE: {
    label: 'QUEUE',
    permissions: [Permission.QUEUE_READ, Permission.QUEUE_CREATE, Permission.QUEUE_UPDATE, Permission.QUEUE_DELETE],
  },
  STATISTICS: {
    label: 'STATISTICS',
    permissions: [Permission.STATISTICS_READ, Permission.STATISTICS_CREATE, Permission.STATISTICS_DELETE],
  },
  CARDS: {
    label: 'CARDS',
    permissions: [Permission.CARDS_READ, Permission.CARDS_CREATE, Permission.CARDS_UPDATE, Permission.CARDS_DELETE],
  },
  CALCULATIONS: {
    label: 'CALCULATIONS',
    permissions: [Permission.CALCULATIONS_READ, Permission.CALCULATIONS_CREATE, Permission.CALCULATIONS_UPDATE, Permission.CALCULATIONS_DELETE],
  },
  WORKSPACE: {
    label: 'WORKSPACE',
    permissions: [Permission.WORKSPACE_READ, Permission.WORKSPACE_UPDATE],
  },
  USERS: {
    label: 'USERS',
    permissions: [Permission.USERS_READ, Permission.USERS_UPDATE, Permission.USERS_DELETE],
  },
  ICE: {
    label: 'ICE',
    permissions: [Permission.ICE_READ, Permission.ICE_CREATE, Permission.ICE_UPDATE, Permission.ICE_DELETE],
  },
  RATINGS: {
    label: 'RATINGS',
    permissions: [Permission.RATINGS_READ, Permission.RATINGS_CREATE, Permission.RATINGS_DELETE],
  },
};

// Get all permissions for ALL category (all unique permissions from all categories)
const allPermissions: Permission[] = Object.values(permissionCategories)
  .flatMap((cat) => cat.permissions)
  .filter((perm, index, self) => self.indexOf(perm) === index); // Remove duplicates

// Permission labels for display
const permissionLabels: Record<Permission, string> = {
  [Permission.COCKTAILS_READ]: 'COCKTAILS_READ',
  [Permission.COCKTAILS_CREATE]: 'COCKTAILS_CREATE',
  [Permission.COCKTAILS_UPDATE]: 'COCKTAILS_UPDATE',
  [Permission.COCKTAILS_DELETE]: 'COCKTAILS_DELETE',
  [Permission.INGREDIENTS_READ]: 'INGREDIENTS_READ',
  [Permission.INGREDIENTS_CREATE]: 'INGREDIENTS_CREATE',
  [Permission.INGREDIENTS_UPDATE]: 'INGREDIENTS_UPDATE',
  [Permission.INGREDIENTS_DELETE]: 'INGREDIENTS_DELETE',
  [Permission.GARNISHES_READ]: 'GARNISHES_READ',
  [Permission.GARNISHES_CREATE]: 'GARNISHES_CREATE',
  [Permission.GARNISHES_UPDATE]: 'GARNISHES_UPDATE',
  [Permission.GARNISHES_DELETE]: 'GARNISHES_DELETE',
  [Permission.GLASSES_READ]: 'GLASSES_READ',
  [Permission.GLASSES_CREATE]: 'GLASSES_CREATE',
  [Permission.GLASSES_UPDATE]: 'GLASSES_UPDATE',
  [Permission.GLASSES_DELETE]: 'GLASSES_DELETE',
  [Permission.UNITS_READ]: 'UNITS_READ',
  [Permission.UNITS_UPDATE]: 'UNITS_UPDATE',
  [Permission.QUEUE_READ]: 'QUEUE_READ',
  [Permission.QUEUE_CREATE]: 'QUEUE_CREATE',
  [Permission.QUEUE_UPDATE]: 'QUEUE_UPDATE',
  [Permission.QUEUE_DELETE]: 'QUEUE_DELETE',
  [Permission.STATISTICS_READ]: 'STATISTICS_READ',
  [Permission.STATISTICS_CREATE]: 'STATISTICS_CREATE',
  [Permission.STATISTICS_DELETE]: 'STATISTICS_DELETE',
  [Permission.CARDS_READ]: 'CARDS_READ',
  [Permission.CARDS_CREATE]: 'CARDS_CREATE',
  [Permission.CARDS_UPDATE]: 'CARDS_UPDATE',
  [Permission.CARDS_DELETE]: 'CARDS_DELETE',
  [Permission.CALCULATIONS_READ]: 'CALCULATIONS_READ',
  [Permission.CALCULATIONS_CREATE]: 'CALCULATIONS_CREATE',
  [Permission.CALCULATIONS_UPDATE]: 'CALCULATIONS_UPDATE',
  [Permission.CALCULATIONS_DELETE]: 'CALCULATIONS_DELETE',
  [Permission.WORKSPACE_READ]: 'WORKSPACE_READ',
  [Permission.WORKSPACE_UPDATE]: 'WORKSPACE_UPDATE',
  [Permission.USERS_READ]: 'USERS_READ',
  [Permission.USERS_UPDATE]: 'USERS_UPDATE',
  [Permission.USERS_DELETE]: 'USERS_DELETE',
  [Permission.ICE_READ]: 'ICE_READ',
  [Permission.ICE_CREATE]: 'ICE_CREATE',
  [Permission.ICE_UPDATE]: 'ICE_UPDATE',
  [Permission.ICE_DELETE]: 'ICE_DELETE',
  [Permission.RATINGS_READ]: 'RATINGS_READ',
  [Permission.RATINGS_CREATE]: 'RATINGS_CREATE',
  [Permission.RATINGS_DELETE]: 'RATINGS_DELETE',
};

// Permission descriptions
const permissionDescriptions: Record<Permission, string> = {
  [Permission.COCKTAILS_READ]: 'Cocktails lesen und anzeigen',
  [Permission.COCKTAILS_CREATE]: 'Neue Cocktails erstellen',
  [Permission.COCKTAILS_UPDATE]: 'Bestehende Cocktails bearbeiten',
  [Permission.COCKTAILS_DELETE]: 'Cocktails löschen',
  [Permission.INGREDIENTS_READ]: 'Zutaten lesen und anzeigen',
  [Permission.INGREDIENTS_CREATE]: 'Neue Zutaten erstellen',
  [Permission.INGREDIENTS_UPDATE]: 'Bestehende Zutaten bearbeiten',
  [Permission.INGREDIENTS_DELETE]: 'Zutaten löschen',
  [Permission.GARNISHES_READ]: 'Garnituren lesen und anzeigen',
  [Permission.GARNISHES_CREATE]: 'Neue Garnituren erstellen',
  [Permission.GARNISHES_UPDATE]: 'Bestehende Garnituren bearbeiten',
  [Permission.GARNISHES_DELETE]: 'Garnituren löschen',
  [Permission.GLASSES_READ]: 'Gläser lesen und anzeigen',
  [Permission.GLASSES_CREATE]: 'Neue Gläser erstellen',
  [Permission.GLASSES_UPDATE]: 'Bestehende Gläser bearbeiten',
  [Permission.GLASSES_DELETE]: 'Gläser löschen',
  [Permission.UNITS_READ]: 'Einheiten lesen und anzeigen',
  [Permission.UNITS_UPDATE]: 'Bestehende Einheiten bearbeiten',
  [Permission.QUEUE_READ]: 'Warteschlange lesen und anzeigen',
  [Permission.QUEUE_CREATE]: 'Items zur Warteschlange hinzufügen',
  [Permission.QUEUE_UPDATE]: 'Items in der Warteschlange bearbeiten',
  [Permission.QUEUE_DELETE]: 'Items aus der Warteschlange entfernen',
  [Permission.STATISTICS_READ]: 'Statistiken lesen und anzeigen',
  [Permission.STATISTICS_CREATE]: 'Statistik-Einträge erstellen',
  [Permission.STATISTICS_DELETE]: 'Statistik-Einträge löschen',
  [Permission.CARDS_READ]: 'Bartender-Karten lesen und anzeigen',
  [Permission.CARDS_CREATE]: 'Neue Bartender-Karten erstellen',
  [Permission.CARDS_UPDATE]: 'Bestehende Bartender-Karten bearbeiten',
  [Permission.CARDS_DELETE]: 'Bartender-Karten löschen',
  [Permission.CALCULATIONS_READ]: 'Kalkulationen lesen und anzeigen',
  [Permission.CALCULATIONS_CREATE]: 'Neue Kalkulationen erstellen',
  [Permission.CALCULATIONS_UPDATE]: 'Bestehende Kalkulationen bearbeiten',
  [Permission.CALCULATIONS_DELETE]: 'Kalkulationen löschen',
  [Permission.WORKSPACE_READ]: 'Workspace-Informationen lesen',
  [Permission.WORKSPACE_UPDATE]: 'Workspace-Einstellungen bearbeiten',
  [Permission.USERS_READ]: 'Workspace-Nutzer lesen und anzeigen',
  [Permission.USERS_UPDATE]: 'Workspace-Nutzer bearbeiten',
  [Permission.USERS_DELETE]: 'Nutzer aus dem Workspace entfernen',
  [Permission.ICE_READ]: 'Eis-Optionen lesen und anzeigen',
  [Permission.ICE_CREATE]: 'Neue Eis-Optionen erstellen',
  [Permission.ICE_UPDATE]: 'Bestehende Eis-Optionen bearbeiten',
  [Permission.ICE_DELETE]: 'Eis-Optionen löschen',
  [Permission.RATINGS_READ]: 'Bewertungen lesen und anzeigen',
  [Permission.RATINGS_CREATE]: 'Neue Bewertungen erstellen',
  [Permission.RATINGS_DELETE]: 'Bewertungen löschen',
};

export default function ApiKeyPermissionSelector(props: ApiKeyPermissionSelectorProps) {
  // Track selected permissions as a set for easy lookup
  const [selectedPermissionSet, setSelectedPermissionSet] = useState<Set<string>>(new Set());

  // Initialize from props
  useEffect(() => {
    const selected = new Set<string>();
    props.selectedPermissions.forEach((permission) => {
      selected.add(permission);
    });
    setSelectedPermissionSet(selected);
  }, [props.selectedPermissions]);

  // Check if a category is fully selected
  const isCategoryFullySelected = (categoryKey: string): boolean => {
    // For ALL, check if all permissions are selected
    if (categoryKey === 'ALL') {
      return allPermissions.every((perm) => selectedPermissionSet.has(perm));
    }

    const category = permissionCategories[categoryKey];
    if (!category) return false;

    // For other categories, check if all permissions are selected
    return category.permissions.every((perm) => {
      return selectedPermissionSet.has(perm);
    });
  };

  // Check if a category is partially selected
  const isCategoryPartiallySelected = (categoryKey: string): boolean => {
    // For ALL, check if some but not all permissions are selected
    if (categoryKey === 'ALL') {
      const hasAny = allPermissions.some((perm) => selectedPermissionSet.has(perm));
      return hasAny && !isCategoryFullySelected(categoryKey);
    }

    const category = permissionCategories[categoryKey];
    if (!category) return false;

    const hasAny = category.permissions.some((perm) => {
      return selectedPermissionSet.has(perm);
    });

    return hasAny && !isCategoryFullySelected(categoryKey);
  };

  // Toggle category selection
  const toggleCategory = (categoryKey: string) => {
    if (props.disabled) return;

    const newSelected = new Set(selectedPermissionSet);
    const isFullySelected = isCategoryFullySelected(categoryKey);

    if (categoryKey === 'ALL') {
      if (isFullySelected) {
        // Deselect ALL - clear everything
        newSelected.clear();
      } else {
        // Select ALL - add all permissions
        allPermissions.forEach((perm) => {
          newSelected.add(perm);
        });
      }
    } else {
      const category = permissionCategories[categoryKey];
      if (!category) return;

      if (isFullySelected) {
        // Deselect all permissions in category
        category.permissions.forEach((perm) => {
          newSelected.delete(perm);
        });
      } else {
        // Select all permissions in category
        category.permissions.forEach((perm) => {
          newSelected.add(perm);
        });
      }
    }

    setSelectedPermissionSet(newSelected);
    updatePermissions(newSelected);
  };

  // Toggle individual permission
  const togglePermission = (permission: Permission) => {
    if (props.disabled) return;

    const newSelected = new Set(selectedPermissionSet);

    if (newSelected.has(permission)) {
      newSelected.delete(permission);
    } else {
      newSelected.add(permission);
    }

    setSelectedPermissionSet(newSelected);
    updatePermissions(newSelected);
  };

  // Update parent component with selected permissions
  const updatePermissions = (selected: Set<string>) => {
    const permissions: Permission[] = [];

    // Return all selected individual permissions (no ALL permission)
    selected.forEach((perm) => {
      permissions.push(perm as Permission);
    });

    props.onChange(permissions);
  };

  // Check if permission is selected
  const isPermissionSelected = (permission: Permission): boolean => {
    return selectedPermissionSet.has(permission);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="text-lg font-bold">Berechtigungen</div>
      <div className="max-h-96 overflow-y-auto">
        {/* ALL category */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="checkbox"
                checked={isCategoryFullySelected('ALL')}
                onChange={() => toggleCategory('ALL')}
                disabled={props.disabled}
                ref={(input) => {
                  if (input) {
                    input.indeterminate = isCategoryPartiallySelected('ALL');
                  }
                }}
              />
              <label className={props.disabled ? 'font-semibold uppercase' : 'cursor-pointer font-semibold uppercase'} onClick={() => toggleCategory('ALL')}>
                ALL
              </label>
              <div className="tooltip tooltip-left" data-tip={allPermissions.map((p) => permissionLabels[p]).join(', ')}>
                <span className="cursor-help text-xs text-base-content/60">({allPermissions.length} Berechtigungen)</span>
              </div>
            </div>
            <div className="tooltip tooltip-left pr-4" data-tip="Alle Berechtigungen auswählen - gewährt vollständigen Zugriff auf alle Endpunkte">
              <FaInfoCircle className="cursor-help" size={14} />
            </div>
          </div>
          <div className="divider my-1" />
        </div>
        {Object.entries(permissionCategories).map(([categoryKey, category]) => (
          <div key={categoryKey} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={isCategoryFullySelected(categoryKey)}
                  onChange={() => toggleCategory(categoryKey)}
                  disabled={props.disabled}
                  ref={(input) => {
                    if (input) {
                      input.indeterminate = isCategoryPartiallySelected(categoryKey);
                    }
                  }}
                />
                <label
                  className={props.disabled ? 'font-semibold uppercase' : 'cursor-pointer font-semibold uppercase'}
                  onClick={() => toggleCategory(categoryKey)}
                >
                  {category.label}
                </label>
                <div className="tooltip tooltip-left" data-tip={category.permissions.map((p) => permissionLabels[p]).join(', ')}>
                  <span className="cursor-help text-xs text-base-content/60">({category.permissions.length} Berechtigungen)</span>
                </div>
              </div>
              <div className="tooltip tooltip-left pr-4" data-tip={`Alle ${category.label}-Berechtigungen auswählen`}>
                <FaInfoCircle className="cursor-help" size={14} />
              </div>
            </div>
            {
              <div className="ml-6 flex flex-col gap-1">
                {category.permissions.map((perm) => (
                  <div key={perm} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={isPermissionSelected(perm)}
                        onChange={() => togglePermission(perm)}
                        disabled={props.disabled}
                      />
                      <label className={props.disabled ? 'text-sm uppercase' : 'cursor-pointer text-sm uppercase'} onClick={() => togglePermission(perm)}>
                        {permissionLabels[perm]}
                      </label>
                    </div>
                    <div className="tooltip tooltip-left pr-4" data-tip={permissionDescriptions[perm]}>
                      <FaInfoCircle className="cursor-help" size={12} />
                    </div>
                  </div>
                ))}
              </div>
            }
            <div className="divider my-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
