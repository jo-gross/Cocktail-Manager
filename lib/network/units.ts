import { alertService } from '../alertService';
import { Unit, UnitConversion } from '@generated/prisma/client';

export function fetchUnits(workspaceId: string | string[] | undefined, setUnits: (units: Unit[]) => void, setUnitsLoading: (loading: boolean) => void) {
  if (workspaceId == undefined) return;
  setUnitsLoading(true);
  fetch(`/api/workspaces/${workspaceId}/units`)
    .then(async (response) => {
      const body = await response.json();
      if (response.ok) {
        setUnits(body.data);
      } else {
        console.error('SettingsPage -> fetchUnits', response);
        alertService.error(body.message ?? 'Fehler beim Laden der Einheiten', response.status, response.statusText);
      }
    })
    .catch((error) => {
      console.error('SettingsPage -> fetchUnits', error);
      alertService.error('Fehler beim Laden der Einheiten');
    })
    .finally(() => setUnitsLoading(false));
}

export const fetchUnitConversions = (
  workspaceId: string | string[] | undefined,
  setUnitConversionsLoading: (loading: boolean) => void,
  setUnitConversions: (conversions: UnitConversion[]) => void,
) => {
  if (workspaceId == undefined) return;
  setUnitConversionsLoading(true);
  fetch(`/api/workspaces/${workspaceId}/units/conversions`)
    .then(async (response) => {
      const body = await response.json();
      if (response.ok) {
        setUnitConversions(body.data);
      } else {
        console.error('SettingsPage -> fetchUnitConversions', response);
        alertService.error(body.message ?? 'Fehler beim Laden der Einheiten', response.status, response.statusText);
      }
    })
    .catch((error) => {
      console.error('SettingsPage -> fetchUnitConversions', error);
      alertService.error('Fehler beim Laden der Einheiten');
    })
    .finally(() => setUnitConversionsLoading(false));
};
