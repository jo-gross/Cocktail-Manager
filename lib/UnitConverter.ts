import { IngredientUnit } from '@prisma/client';

export function convertUnitToString(unit: IngredientUnit): string {
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
  }
}

export function convertStringToUnit(unit: string | null): IngredientUnit | null {
  switch (unit) {
    case 'cl':
      return IngredientUnit.CL;
    case 'Dash':
      return IngredientUnit.DASH;
    case 'Stück':
      return IngredientUnit.PIECE;
    case 'Pin. cm':
      return IngredientUnit.DROPPER_CM;
    case 'Pin. Tropfen':
      return IngredientUnit.DROPPER_DROPS;
    case 'Sprühen':
      return IngredientUnit.SPRAY;
    case 'g':
      return IngredientUnit.GRAMM;
    default:
      return null;
  }
}
