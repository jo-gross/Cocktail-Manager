import { CocktailRecipeFull } from '../models/CocktailRecipeFull';
import { IngredientModel } from '../models/IngredientModel';

export function calcCocktailTotalPrice(cocktail: CocktailRecipeFull, ingredients: IngredientModel[]): number {
  return cocktail.steps.filter((step) => step.ingredients.some((ingredient) => ingredient.ingredient != undefined)).length > 0
    ? cocktail.steps
        .map((step) => step.ingredients.filter((ingredient) => ingredient.ingredient != undefined))
        .flat()
        .map((stepIngredient) => {
          if (
            ingredients
              .find((ingredient) => ingredient.id == stepIngredient.ingredientId)
              ?.IngredientVolume.find((volumeUnits) => volumeUnits.unitId == stepIngredient.unitId) == undefined
          ) {
            return 0;
          } else {
            return (
              ((stepIngredient.ingredient?.price ?? 0) /
                (ingredients
                  .find((ingredient) => ingredient.id == stepIngredient.ingredientId)
                  ?.IngredientVolume.find((volumeUnits) => volumeUnits.unitId == stepIngredient.unitId)?.volume ?? 0)) *
              (stepIngredient.amount ?? 0)
            );
          }
        })
        .reduce((summ, sum) => summ + sum, 0) +
        cocktail.garnishes
          .filter((garnish) => garnish.garnish != undefined)
          .flat()
          .map((garnish) => garnish.garnish?.price ?? 0)
          .reduce((summ, sum) => summ + sum, 0)
    : 0;
}
