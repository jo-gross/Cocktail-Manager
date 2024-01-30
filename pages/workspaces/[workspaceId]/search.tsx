import { useState } from 'react';
import { CocktailRecipeFull } from '../../../models/CocktailRecipeFull';
import CocktailRecipeCardItem from '../../../components/cocktails/CocktailRecipeCardItem';
import { SearchModal } from '../../../components/modals/SearchModal';

export default function SearchPage() {
  const [selectedCocktail, setSelectedCocktail] = useState<CocktailRecipeFull | undefined>(undefined);

  return (
    <div className={'flex flex-col-reverse gap-2 p-2 md:flex-row'}>
      <div className={'card w-full flex-1'}>
        <div className={'card-body '}>
          <SearchModal onCocktailSelectedObject={(cocktail) => setSelectedCocktail(cocktail)} selectionLabel={'Ansehen'} showRecipe={false} />
        </div>
      </div>
      <div className={'h-min w-full flex-1'}>
        {selectedCocktail ? (
          <CocktailRecipeCardItem cocktailRecipe={selectedCocktail} showImage={true} showInfo={true} showPrice={true} showTags={true} />
        ) : (
          <></>
        )}
      </div>
    </div>
  );
}
