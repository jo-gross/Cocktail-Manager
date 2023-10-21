import { useState } from 'react';
import { CocktailRecipeFull } from '../../../models/CocktailRecipeFull';
import CocktailRecipeOverviewItem from '../../../components/cocktails/CocktailRecipeOverviewItem';
import { SearchModal } from '../../../components/modals/SearchModal';

export default function SearchPage() {
  const [selectedCocktail, setSelectedCocktail] = useState<CocktailRecipeFull | undefined>(undefined);

  return (
    <div className={'flex flex-col-reverse md:flex-row gap-2 p-2'}>
      <div className={'card w-full flex-1'}>
        <div className={'card-body '}>
          <SearchModal
            onCocktailSelectedObject={(cocktail) => setSelectedCocktail(cocktail)}
            selectionLabel={'Ansehen'}
            showRecipe={false}
          />
        </div>
      </div>
      <div className={'h-min w-full flex-1'}>
        {selectedCocktail ? (
          <CocktailRecipeOverviewItem
            cocktailRecipe={selectedCocktail}
            showImage={true}
            showInfo={true}
            showPrice={true}
            showTags={true}
          />
        ) : (
          <></>
        )}
      </div>
    </div>
  );
}
