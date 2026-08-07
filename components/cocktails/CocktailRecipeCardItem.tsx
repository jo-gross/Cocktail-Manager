import type { CocktailDto } from '@lib/schemas/cocktails';
import React, { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CompactCocktailRecipeInstruction } from './CompactCocktailRecipeInstruction';
import { ShowCocktailInfoButton } from './ShowCocktailInfoButton';
import { useRouter } from 'next/router';
import { FaExclamationTriangle } from 'react-icons/fa';
import { CocktailRecipeCardSkeleton } from './CocktailRecipeCardSkeleton';
import { fetchCocktail } from '@lib/network/cocktails';
import type { RatingDto } from '@lib/schemas/ratings';
import { fetchCocktailRatings } from '@lib/network/cocktailRatings';
import StatisticActions from '../StatisticActions';
import ExpandableText, { ExpandableTextHandle } from '../ExpandableText';
import { CocktailDetailModal } from '../modals/CocktailDetailModal';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { Badge, Card, CardBody } from '@components/ui';

export type CocktailRecipeOverviewItemRef = {
  refresh: () => void;
  recalculateClamp: () => void;
};

export type CocktailRecipeOverviewItemProps = {
  cocktailRecipe: CocktailDto | string;
  showImage?: boolean;
  specialPrice?: number;
  showPrice?: boolean;
  showInfo?: boolean;
  showTags?: boolean;
  showDescription?: boolean;
  showNotes?: boolean;
  showHistory?: boolean;
  showStatisticActions?: boolean;
  image?: string;
  showRating?: boolean;
  showDetailsOnClick?: boolean;
};

const CocktailRecipeCardItem = forwardRef<CocktailRecipeOverviewItemRef, CocktailRecipeOverviewItemProps>((props, ref) => {
  const { t } = useTranslation(['cocktail']);
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string;

  const [loadedCocktailRecipe, setLoadedCocktailRecipe] = useState<CocktailDto | undefined>(
    typeof props.cocktailRecipe === 'string' ? undefined : props.cocktailRecipe,
  );
  const [cocktailRecipeLoading, setCocktailRecipeLoading] = useState(false);

  const [cocktailRatings, setCocktailRatings] = useState<RatingDto[]>([]);
  const [cocktailRatingsLoading, setCocktailRatingsLoading] = useState(false);
  const [cocktailRatingsError, setCocktailRatingsError] = useState<boolean>(false);

  const cocktailId = typeof props.cocktailRecipe === 'string' ? props.cocktailRecipe : props.cocktailRecipe.id;

  const refresh = useCallback(() => {
    fetchCocktail(workspaceId, cocktailId, setLoadedCocktailRecipe, setCocktailRecipeLoading);
    fetchCocktailRatings(workspaceId, cocktailId, setCocktailRatings, setCocktailRatingsLoading, setCocktailRatingsError);
  }, [workspaceId, cocktailId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const expandableRefs = useRef<Record<string, Record<string, ExpandableTextHandle | null>>>({});

  const recalculateClamp = useCallback(() => {
    Object.values(expandableRefs.current).forEach((textRefs) => Object.values(textRefs).forEach((expandableText) => expandableText?.recalculateClamp()));
  }, []);

  useEffect(() => {
    recalculateClamp();
  }, [recalculateClamp]);

  useImperativeHandle(ref, () => ({
    refresh,
    recalculateClamp,
  }));

  const cocktailRecipe = typeof props.cocktailRecipe === 'string' ? loadedCocktailRecipe : props.cocktailRecipe;

  const modalContext = useContext(ModalContext);

  return (
    <div className={'col-span-1'}>
      <Card variant="elevated" className="h-full flex-row">
        {cocktailRecipeLoading ? (
          <CocktailRecipeCardSkeleton />
        ) : cocktailRecipe ? (
          <>
            <ShowCocktailInfoButton
              showInfo={(props.showInfo ?? false) && !(props.showDetailsOnClick ?? false)}
              cocktailId={cocktailRecipe.id}
              onRatingChange={() =>
                fetchCocktailRatings(workspaceId, cocktailRecipe.id, setCocktailRatings, setCocktailRatingsLoading, setCocktailRatingsError)
              }
            />
            <CardBody>
              <div
                onClick={
                  (props.showDetailsOnClick ?? false)
                    ? async () => {
                        modalContext.openModal(
                          <CocktailDetailModal
                            cocktailId={cocktailRecipe.id}
                            onRefreshRatings={() =>
                              fetchCocktailRatings(workspaceId, cocktailRecipe.id, setCocktailRatings, setCocktailRatingsLoading, setCocktailRatingsError)
                            }
                            openReferer={'DETAIL'}
                          />,
                          true,
                        );
                      }
                    : undefined
                }
                style={(props.showDetailsOnClick ?? false) ? { cursor: 'pointer' } : {}}
              >
                <CompactCocktailRecipeInstruction
                  cocktailRecipe={cocktailRecipe}
                  specialPrice={props.specialPrice}
                  showImage={props.showImage ?? false}
                  showPrice={props.showPrice ?? true}
                  image={props.image}
                  showRating={props.showRating ? { ratings: cocktailRatings, loading: cocktailRatingsLoading, error: cocktailRatingsError } : undefined}
                />
              </div>
              <>
                {props.showNotes && cocktailRecipe.notes && (
                  <>
                    <div className={'border-b border-base-100'}></div>
                    <div className={'font-bold'}>{t('cocktail:prepNotes')}</div>
                    <div className={'pl-2'}>
                      <ExpandableText
                        text={cocktailRecipe.notes}
                        ref={(el) => {
                          if (!expandableRefs.current[cocktailRecipe.id]) expandableRefs.current[cocktailRecipe.id] = {};
                          expandableRefs.current[cocktailRecipe.id]['notes'] = el;
                        }}
                      />
                      {/*<div className={'long-text-format'}>{cocktailRecipe.notes}</div>*/}
                    </div>
                  </>
                )}
                {props.showDescription && cocktailRecipe.description && (
                  <>
                    <div className={'border-b border-base-100'}></div>
                    <div className={'font-bold'}>{t('cocktail:description')}</div>
                    <div className={'pl-2'}>
                      <ExpandableText
                        text={cocktailRecipe.description}
                        ref={(el) => {
                          if (!expandableRefs.current[cocktailRecipe.id]) expandableRefs.current[cocktailRecipe.id] = {};
                          expandableRefs.current[cocktailRecipe.id]['description'] = el;
                        }}
                      />
                      {/*<div className={'long-text-format'}>{cocktailRecipe.description}</div>*/}
                    </div>
                  </>
                )}
                {props.showHistory && cocktailRecipe.history && (
                  <>
                    <div className={'border-b border-base-100'}></div>
                    <div className={'font-bold'}>{t('cocktail:history')}</div>
                    <div className={'pl-2'}>
                      <ExpandableText
                        text={cocktailRecipe.history}
                        ref={(el) => {
                          if (!expandableRefs.current[cocktailRecipe.id]) expandableRefs.current[cocktailRecipe.id] = {};
                          expandableRefs.current[cocktailRecipe.id]['history'] = el;
                        }}
                      />
                    </div>
                    {/*<div className={'long-text-format'}>{cocktailRecipe.history}</div>*/}
                  </>
                )}

                <div className={'h-full'}></div>

                {props.showTags && cocktailRecipe.tags.length > 0 ? (
                  <div className={''}>
                    <div className={'mb-2 border-b border-base-100'}></div>
                    {cocktailRecipe.tags.map((tag) => (
                      <Badge key={`cocktail-overview-item-${cocktailRecipe.id}-tag-${tag}`} variant="primary" outline size="sm" className="mr-1">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <></>
                )}

                {props.showStatisticActions ? (
                  <div className={'mt-1'}>
                    <StatisticActions
                      workspaceId={router.query.workspaceId as string}
                      cocktailId={cocktailRecipe.id}
                      cocktailName={cocktailRecipe.name}
                      actionSource={'CARD'}
                      cardId={router.query.cardId as string | undefined}
                    />
                  </div>
                ) : (
                  <></>
                )}
              </>
            </CardBody>
          </>
        ) : (
          <div className={'flex h-full min-h-40 w-full flex-col items-center justify-center gap-2'}>
            <FaExclamationTriangle />
            <div>{t('cocktail:error.loadOne')}</div>
          </div>
        )}
      </Card>
    </div>
  );
});

export default CocktailRecipeCardItem;
CocktailRecipeCardItem.displayName = 'CocktailRecipeCardItem';
