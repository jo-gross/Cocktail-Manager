import { useEffect } from 'react';
import { CocktailRecipeFull } from '../../../models/CocktailRecipeFull';
import CocktailRecipeCardItem from '../../../components/cocktails/CocktailRecipeCardItem';
import { SearchModal } from '@components/modals/SearchModal';

interface SearchPageProps {
  showImage: boolean;
  showTags: boolean;
  showStatisticActions: boolean;
  showRating: boolean;
  showDescription: boolean;
  showNotes: boolean;
  selectedCocktail: CocktailRecipeFull | string | undefined;
  setSelectedCocktail: (cocktail: CocktailRecipeFull) => void;
}

export default function SearchPage(props: SearchPageProps) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [props.selectedCocktail]);

  return (
    <div className={'flex flex-col-reverse gap-2 md:flex-row'}>
      <div className={'card w-full flex-1'}>
        <div className={`card-body`}>
          <SearchModal
            onCocktailSelectedObject={(cocktail) => props.setSelectedCocktail(cocktail)}
            selectionLabel={'Ansehen'}
            showRecipe={false}
            customWidthClassName={'w-full'}
            asFitOnScreen={true}
          />
        </div>
      </div>
      <div className={'h-min w-full flex-1'}>
        {props.selectedCocktail ? (
          <CocktailRecipeCardItem
            cocktailRecipe={props.selectedCocktail}
            showImage={props.showImage}
            showDetailsOnClick={true}
            showPrice={true}
            showDescription={props.showDescription}
            showNotes={props.showNotes}
            showTags={props.showTags}
            showStatisticActions={props.showStatisticActions}
            showRating={props.showRating}
          />
        ) : (
          <></>
        )}
      </div>
    </div>
  );
}
