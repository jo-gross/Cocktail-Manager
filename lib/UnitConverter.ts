import { IngredientUnit } from '@prisma/client';

export function convertUnitToDisplayString(unit: IngredientUnit | null): string | null {
  switch (unit) {
    case IngredientUnit.CL:
      return 'cl';
    case IngredientUnit.DASH:
      return 'Dash';
    case IngredientUnit.PIECE:
      return 'Stück';
    case IngredientUnit.DROPPER_CM:
      return 'Pip. cm';
    case IngredientUnit.DROPPER_DROPS:
      return 'Pip. Tropfen';
    case IngredientUnit.SPRAY:
      return 'Sprühen';
    case IngredientUnit.GRAMM:
      return 'g';
    default:
      return null;
  }
}

export function convertStringToUnit(unit: string | null): IngredientUnit | null {
  switch (unit) {
    case IngredientUnit.CL.toString():
    case 'cl':
      return IngredientUnit.CL;
    case 'Dash':
    case IngredientUnit.DASH.toString():
      return IngredientUnit.DASH;
    case 'Stück':
    case IngredientUnit.PIECE.toString():
      return IngredientUnit.PIECE;
    case 'Pip. cm':
    case IngredientUnit.DROPPER_CM.toString():
      return IngredientUnit.DROPPER_CM;
    case 'Pip. Tropfen':
    case IngredientUnit.DROPPER_DROPS.toString():
      return IngredientUnit.DROPPER_DROPS;
    case 'Sprühen':
    case IngredientUnit.SPRAY.toString():
      return IngredientUnit.SPRAY;
    case 'g':
    case IngredientUnit.GRAMM.toString():
      return IngredientUnit.GRAMM;
    default:
      return null;
  }
}

export function unitFromClConversion(unit: IngredientUnit | null): number {
  if (unit == null) return 1;
  switch (unit) {
    case IngredientUnit.CL:
      return 1;
    case IngredientUnit.DASH:
      return 10;
    case IngredientUnit.PIECE:
      return 1;
    case IngredientUnit.DROPPER_CM:
      return 10 / 6;
    case IngredientUnit.DROPPER_DROPS:
      return 500;
    case IngredientUnit.SPRAY:
      return 100;
    case IngredientUnit.GRAMM:
      return 10;
    default:
      throw new Error(`Unknown unit "${unit}"`);
  }
}
