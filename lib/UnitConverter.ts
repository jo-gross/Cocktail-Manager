import { IngredientUnit } from '@prisma/client';

export function convertUnitToString(unit: IngredientUnit | null): string | null {
  switch (unit) {
    case IngredientUnit.CL:
      return 'cl';
    case IngredientUnit.DASH:
      return 'Dash';
    case IngredientUnit.PIECE:
      return 'Stück';
    case IngredientUnit.DROPPER_CM:
      return 'Pin. cm';
    case IngredientUnit.DROPPER_DROPS:
      return 'Pin. Tropfen';
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
    case 'cl' || IngredientUnit.CL.toString():
      return IngredientUnit.CL;
    case 'Dash' || IngredientUnit.DASH.toString():
      return IngredientUnit.DASH;
    case 'Stück' || IngredientUnit.PIECE.toString():
      return IngredientUnit.PIECE;
    case 'Pin. cm' || IngredientUnit.DROPPER_CM.toString():
      return IngredientUnit.DROPPER_CM;
    case 'Pin. Tropfen' || IngredientUnit.DROPPER_DROPS.toString():
      return IngredientUnit.DROPPER_DROPS;
    case 'Sprühen' || IngredientUnit.SPRAY.toString():
      return IngredientUnit.SPRAY;
    case 'g' || IngredientUnit.GRAMM.toString():
      return IngredientUnit.GRAMM;
    default:
      return null;
  }
}
