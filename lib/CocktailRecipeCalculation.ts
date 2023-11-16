import { CocktailRecipeFull } from '../models/CocktailRecipeFull';

export function calcCocktailTotalPrice(cocktail: CocktailRecipeFull): number {
  return cocktail.steps.filter((step) => step.ingredients.some((ingredient) => ingredient.ingredient != undefined))
    .length > 0
    ? cocktail.steps
        .map((step) => step.ingredients.filter((ingredient) => ingredient.ingredient != undefined))
        .flat()
        .map(
          (ingredient) =>
            ((ingredient.ingredient?.price ?? 0) / (ingredient.ingredient?.volume ?? 1)) * (ingredient.amount ?? 0),
        )
        .reduce((summ, sum) => summ + sum, 0) +
        cocktail.garnishes
          .filter((garnish) => garnish.garnish != undefined)
          .flat()
          .map((garnish) => garnish.garnish?.price ?? 0)
          .reduce((summ, sum) => summ + sum, 0)
    : 0;
}
