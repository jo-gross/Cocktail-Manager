import { useEffect, useState } from 'react';
import { CocktailRecipeFull } from '../../../models/CocktailRecipeFull';
import CocktailRecipeCardItem from '../../../components/cocktails/CocktailRecipeCardItem';
import { SearchModal } from '../../../components/modals/SearchModal';
import { useRouter } from 'next/router';

interface SearchPageProps {
  showImage: boolean;
  showTags: boolean;
  showStatisticActions: boolean;
  showRating: boolean;
  showDescription: boolean;
  showNotes: boolean;
}

export default function SearchPage(props: SearchPageProps) {
  const [selectedCocktail, setSelectedCocktail] = useState<CocktailRecipeFull | undefined>(undefined);

  const router = useRouter();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedCocktail]);

  return (
    <div className={'flex flex-col-reverse gap-2 md:flex-row'}>
      <div className={'card w-full flex-1'}>
        <div className={'card-body'}>
          <SearchModal
            onCocktailSelectedObject={(cocktail) => setSelectedCocktail(cocktail)}
            selectionLabel={'Ansehen'}
            showRecipe={false}
            customWidthClassName={'w-full'}
          />
        </div>
      </div>
      <div className={'h-min w-full flex-1'}>
        {selectedCocktail ? (
          <CocktailRecipeCardItem
            cocktailRecipe={selectedCocktail}
            showImage={props.showImage}
            showInfo={true}
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
