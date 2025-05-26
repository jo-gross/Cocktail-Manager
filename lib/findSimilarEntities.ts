import levenshtein from 'js-levenshtein';
import { CocktailRecipe, Garnish, Glass, Ingredient } from '@generated/prisma/client';

export function calculateIngredientSimilarity(newProductName: string, ingredient: Ingredient) {
  const nameSimilarity = 1 - levenshtein(newProductName, ingredient.name) / Math.max(newProductName.length, ingredient.name.length);
  let levenshteinSimilarity = nameSimilarity;
  if (ingredient.shortName != null) {
    const shortNameSimilarity = 1 - levenshtein(newProductName, ingredient.shortName) / Math.max(newProductName.length, ingredient.shortName.length);
    levenshteinSimilarity = Math.max(nameSimilarity, shortNameSimilarity);
  }

  const value = ingredient.name
    .split(' ')
    .filter((word) => word.length > 2)
    .includes(newProductName.split(' ').filter((word) => word.length > 2)[0]);
  if (value) {
    levenshteinSimilarity = Math.max(levenshteinSimilarity, 0.6);
  }

  return levenshteinSimilarity;
}

export function calculateGarnishSimilarity(newProductName: string, garnish: Garnish) {
  let levenshteinSimilarity = 1 - levenshtein(newProductName, garnish.name) / Math.max(newProductName.length, garnish.name.length);

  const value = garnish.name
    .split(' ')
    .filter((word) => word.length > 2)
    .includes(newProductName.split(' ').filter((word) => word.length > 2)[0]);
  if (value) {
    levenshteinSimilarity = Math.max(levenshteinSimilarity, 0.6);
  }

  return levenshteinSimilarity;
}

export function calculateCocktailRecipeSimilarity(newProductName: string, cocktailRecipe: CocktailRecipe) {
  let levenshteinSimilarity = 1 - levenshtein(newProductName, cocktailRecipe.name) / Math.max(newProductName.length, cocktailRecipe.name.length);

  const value = cocktailRecipe.name
    .split(' ')
    .filter((word) => word.length > 2)
    .includes(newProductName.split(' ').filter((word) => word.length > 2)[0]);
  if (value) {
    levenshteinSimilarity = Math.max(levenshteinSimilarity, 0.6);
  }

  return levenshteinSimilarity;
}

export function calculateGlassSimilarity(newProductName: string, glass: Glass) {
  let levenshteinSimilarity = 1 - levenshtein(newProductName, glass.name) / Math.max(newProductName.length, glass.name.length);

  const value = glass.name
    .split(' ')
    .filter((word) => word.length > 2)
    .includes(newProductName.split(' ').filter((word) => word.length > 2)[0]);
  if (value) {
    levenshteinSimilarity = Math.max(levenshteinSimilarity, 0.6);
  }

  return levenshteinSimilarity;
}
