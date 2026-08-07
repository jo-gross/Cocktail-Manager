import type { CocktailDto } from '@lib/schemas/cocktails';
import Link from 'next/link';
import { FaArrowLeft, FaFileDownload, FaHistory, FaInfo, FaPencilAlt, FaPlus, FaSyncAlt, FaTimes } from 'react-icons/fa';
import { ModalContext } from '@lib/context/ModalContextProvider';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import { UserContext } from '@lib/context/UserContextProvider';
import { Role } from '@generated/prisma/client';
import type { RatingDto } from '@lib/schemas/ratings';
import Image from 'next/image';
import AvatarImage from '../AvatarImage';
import { Alert, Badge, Button, ButtonGroup, CardBody, CardTitle, Divider, FormControl, Input, Label, Loading, Tooltip } from '@components/ui';
import ImageModal from './ImageModal';
import { calcCocktailTotalPrice } from '@lib/CocktailRecipeCalculation';
import { fetchIngredients } from '@lib/network/ingredients';
import { IngredientModel } from '../../models/IngredientModel';
import AddCocktailRatingModal from './AddCocktailRatingModal';
import CocktailRatingsModal from './CocktailRatingsModal';
import StarsComponent from '../StarsComponent';
import { fetchCocktailRatings } from '@lib/network/cocktailRatings';
import { fetchCocktail } from '@lib/network/cocktails';
import StatisticActions from '../StatisticActions';
import { toInteger } from 'lodash';
import { FaArrowRotateLeft } from 'react-icons/fa6';
import { alertService } from '@lib/alertService';
import '../../lib/NumberUtils';
import CocktailExportOptionsModal, { CocktailExportOptions } from './CocktailExportOptionsModal';
import { AuditLogHistoryModal } from './AuditLogHistoryModal';

interface CocktailDetailModalProps {
  cocktailId: string;

  onRefreshRatings: () => void;
  queueNotes?: string;
  queueAmount?: number;
  openReferer: 'QUEUE' | 'DETAIL';
}

export function CocktailDetailModal(props: CocktailDetailModalProps) {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);
  const { t, i18n } = useTranslation(['cocktail', 'common', 'errors']);

  const [loading, setLoading] = useState(true);
  const [loadedCocktail, setLoadedCocktail] = useState<CocktailDto>();

  const [ingredients, setIngredients] = useState<IngredientModel[] | undefined>(undefined);

  const [cocktailRatings, setCocktailRatings] = useState<RatingDto[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(true);
  const [ratingError, setRatingsError] = useState(false);
  const [chromiumAvailable, setChromiumAvailable] = useState(false);

  const [localQueueAmount, setLocalQueueAmount] = useState(props.queueAmount);
  const [exportingPdf, setExportingPdf] = useState(false);

  const refreshRatings = useCallback(() => {
    props.onRefreshRatings();
    fetchCocktailRatings(workspaceId, props.cocktailId, setCocktailRatings, setRatingsLoading, setRatingsError);
  }, [props, workspaceId]);

  const handleExportPdf = useCallback(() => {
    if (!workspaceId || !loadedCocktail) return;
    modalContext.openModal(
      <CocktailExportOptionsModal
        onExport={async (options: CocktailExportOptions) => {
          setExportingPdf(true);
          try {
            alertService.info(t('cocktail:exportRunningMinutes'));
            const response = await fetch(`/api/v1/workspaces/${workspaceId}/cocktails/export/pdf`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                cocktailIds: [loadedCocktail.id],
                exportImage: options.exportImage,
                exportDescription: options.exportDescription,
                exportNotes: options.exportNotes,
                exportHistory: options.exportHistory,
                newPagePerCocktail: options.newPagePerCocktail,
                showHeader: options.showHeader,
                showFooter: options.showFooter,
                locale: i18n.language,
              }),
            });

            if (!response.ok) {
              const error = await response.json().catch(() => ({ message: t('errors:export') }));
              alertService.error(error.message ?? t('cocktail:error.exportPdf'), response.status, response.statusText);
              return;
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cocktail-${loadedCocktail.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            alertService.success(t('cocktail:pdfExported'));
          } catch (error) {
            console.error('PDF export error:', error);
            alertService.error(t('cocktail:error.exportPdf'));
          } finally {
            setExportingPdf(false);
          }
        }}
      />,
    );
  }, [workspaceId, loadedCocktail, modalContext, t]);

  useEffect(() => {
    fetchIngredients(workspaceId, setIngredients, () => {});
    fetchCocktail(workspaceId, props.cocktailId, setLoadedCocktail, setLoading);
    fetchCocktailRatings(workspaceId, props.cocktailId, setCocktailRatings, setRatingsLoading, setRatingsError);

    // Check if Chromium service is available
    fetch('/api/chromium-status')
      .then((res) => res.json())
      .then((data) => {
        setChromiumAvailable(data.available || false);
      })
      .catch((error) => {
        console.error('Error checking Chromium status:', error);
        setChromiumAvailable(false);
      });
  }, [props.cocktailId, workspaceId]);

  const [amountAdjustment, setAmountAdjustment] = useState<number>(100);

  return loading || loadedCocktail == undefined ? (
    <Loading />
  ) : (
    <>
      <div className={'md:max-w-5xl'}>
        <CardBody className="bg-base-100">
          <div className={'w-full pb-4 text-center text-2xl font-bold no-print:hidden'}>{loadedCocktail.name}</div>
          <div className={'flex flex-row space-x-2 print:hidden'}>
            {modalContext.content.length > 1 && (
              <Button variant="outline" size="sm" shape="square" onClick={() => modalContext.closeModal()}>
                <FaArrowLeft />
              </Button>
            )}
            <CardTitle className="flex-1">
              {loadedCocktail.name}
              {loadedCocktail.price != undefined ? (
                <>
                  {' - '}
                  <span className={'font-bold'}>
                    {loadedCocktail.price.formatPriceEfficent() + ' €'}
                    {amountAdjustment != 100
                      ? ` ${(loadedCocktail.price * (amountAdjustment / 100) - loadedCocktail.price)
                          .formatPriceEfficent({ signDisplay: 'exceptZero' })
                          .replace('-', '- ')
                          .replace('+', '+ ')} € = ${(
                          loadedCocktail.price +
                          (loadedCocktail.price * (amountAdjustment / 100) - loadedCocktail.price)
                        ).formatPriceEfficent()} €`
                      : ''}
                  </span>
                </>
              ) : (
                <></>
              )}
            </CardTitle>
            {chromiumAvailable ? (
              <Tooltip tip={t('cocktail:exportAsPdfTip')}>
                <Button variant="outline" size="sm" shape="square" onClick={handleExportPdf} disabled={exportingPdf}>
                  {exportingPdf ? <Loading size="sm" /> : <FaFileDownload />}
                </Button>
              </Tooltip>
            ) : (
              <Button
                variant="outline"
                size="sm"
                shape="square"
                onClick={() => {
                  window.print();
                }}
              >
                <FaFileDownload />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              shape="square"
              title={t('common:showHistory')}
              onClick={() =>
                modalContext.openModal(<AuditLogHistoryModal entityType={'CocktailRecipe'} entityId={loadedCocktail.id} entityName={loadedCocktail.name} />)
              }
            >
              <FaHistory />
            </Button>
            <>
              {userContext.isUserPermitted(Role.MANAGER) && (
                <Link href={`/workspaces/${workspaceId}/manage/cocktails/${loadedCocktail.id}`}>
                  <Button variant="outline" size="sm" shape="square" className="border-secondary text-secondary" onClick={() => modalContext.closeAllModals()}>
                    <FaPencilAlt />
                  </Button>
                </Link>
              )}
            </>
            <Button variant="outline" size="sm" shape="square" onClick={() => modalContext.closeAllModals()}>
              <FaTimes />
            </Button>
          </div>
          {(props.queueNotes || localQueueAmount) && (
            <Alert variant="warning" className="grid grid-cols-2">
              {localQueueAmount && (
                <div>
                  {t('cocktail:queueAmount')}
                  <strong>{t('cocktail:queueAmountTimes', { amount: localQueueAmount })}</strong>
                </div>
              )}
              {props.queueNotes && (
                <div>
                  {t('cocktail:queueNote')}
                  <strong>{props.queueNotes}</strong>
                </div>
              )}
            </Alert>
          )}
          <div className={'grid grid-cols-1 gap-4 md:grid-cols-2'}>
            {/*Left side*/}
            <div className={'flex flex-col gap-2'}>
              <div className={'flex flex-row justify-between gap-2 rounded border border-base-300 p-2'}>
                <div className={'flex flex-1 flex-col gap-2'}>
                  {(loadedCocktail?.tags.length ?? 0) > 0 && (
                    <div className={'gap-2'}>
                      {loadedCocktail?.tags.map((tag) => (
                        <Badge key={`cocktail-details-${loadedCocktail.id}-tags-${tag}`} variant="primary" size="sm" className="mr-1">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className={'flex flex-1 items-end justify-between gap-2'}>
                    <div>{t('cocktail:glassLabel', { name: loadedCocktail.glass?.name })}</div>
                    <div>{t('cocktail:iceLabel', { name: userContext.getTranslation(loadedCocktail.ice?.name ?? '-') })}</div>
                  </div>
                </div>
                {loadedCocktail.glass && loadedCocktail.glass.hasImage && (
                  <div className={''}>
                    <div className={'h-16 w-16'}>
                      <AvatarImage
                        src={`/api/v1/workspaces/${workspaceId}/glasses/${loadedCocktail.glass.id}/image`}
                        onClick={() =>
                          modalContext.openModal(<ImageModal image={`/api/v1/workspaces/${workspaceId}/glasses/${loadedCocktail.glass?.id}/image`} />)
                        }
                        alt={t('cocktail:glassImageAlt', { name: loadedCocktail.glass?.name })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className={`grid ${loadedCocktail.hasImage ? 'grid-cols-5' : 'grid-cols-3'} gap-2`}>
                <div className={'col-span-3 flex flex-col gap-2'}>
                  <div className={'flex flex-row items-baseline justify-between gap-2'}>
                    <div className={'font-bold'}>{t('cocktail:preparation')}</div>
                    {amountAdjustment != 100 && (
                      <Badge variant="secondary" outline size="sm">
                        {t('cocktail:amountBadge')}
                        {amountAdjustment.toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}{' '}
                        %
                      </Badge>
                    )}
                  </div>
                  {loadedCocktail.steps
                    .sort((a, b) => a.stepNumber - b.stepNumber)
                    .map((step) => (
                      <div key={`cocktail-details-step-${step.id}`} className={'flex flex-col gap-2 rounded border border-base-300 p-2'}>
                        <div className={`font-bold ${step.optional ? 'italic' : ''}`}>
                          {userContext.getTranslation(step.action?.name ?? '')} {step.optional && t('cocktail:optional')}
                        </div>
                        {step.ingredients
                          .sort((a, b) => a.ingredientNumber - b.ingredientNumber)
                          .map((stepIngredient) => (
                            <div
                              key={`cocktail-details-step-ingredient-${stepIngredient.id}`}
                              className={`flex flex-row gap-2 pl-3 ${stepIngredient.optional ? 'italic' : ''}`}
                            >
                              <div className={'font-bold'}>
                                {((stepIngredient.amount ?? 0) * (amountAdjustment / 100))?.toLocaleString(undefined, {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 2,
                                })}
                              </div>
                              <div className={'font-bold'}>{userContext.getTranslation(stepIngredient.unit?.name ?? '')}</div>
                              <div>{stepIngredient.ingredient?.shortName ?? stepIngredient.ingredient?.name}</div>
                              {stepIngredient.optional && <div>{t('cocktail:optional')}</div>}
                            </div>
                          ))}
                      </div>
                    ))}
                </div>
                {loadedCocktail.hasImage && (
                  <div className={'col-span-2'}>
                    <Image
                      className={'h-full w-full flex-none cursor-pointer rounded-lg object-cover object-center shadow-md'}
                      src={loadedCocktail.imageUrl ?? ''}
                      alt={t('cocktail:cocktailImageAlt')}
                      onClick={() => modalContext.openModal(<ImageModal image={loadedCocktail.imageUrl ?? ''} />)}
                      width={100}
                      height={300}
                      unoptimized={true}
                    />
                  </div>
                )}
              </div>
              {loadedCocktail.garnishes.length > 0 && (
                <>
                  <div className={'font-bold'}>{t('cocktail:garnish')}</div>
                  {loadedCocktail.garnishes
                    .sort((a, b) => a.garnishNumber - b.garnishNumber)
                    .map((garnish) => (
                      <div
                        key={`cocktail-details-garnish-${garnish.garnishNumber}-${garnish.garnish?.id}`}
                        className={'flex flex-col gap-2 rounded border border-base-300 p-2'}
                      >
                        <div className={'flex flex-row justify-between gap-2'}>
                          <div className={`font-bold ${garnish.optional ? 'italic' : ''}`}>
                            {garnish.isAlternative && <span className={'font-normal italic'}>{t('cocktail:orPrefix')}</span>}
                            {garnish.garnish.name} {garnish.optional ? t('cocktail:optionalCapitalized') : ''}
                          </div>
                        </div>
                        {garnish.description && (
                          <>
                            <div className={'underline'}>{t('cocktail:cocktailSpecificNotes')}</div>
                            <div className={'long-text-format'}>{garnish.description}</div>
                          </>
                        )}
                      </div>
                    ))}
                </>
              )}

              <Divider size="sm" className="print:hidden" />
              <div className={'print:hidden'}>
                <StatisticActions
                  workspaceId={router.query.workspaceId as string}
                  disabled={{ list: amountAdjustment != 100 }}
                  initData={{
                    comment:
                      amountAdjustment != 100 && loadedCocktail
                        ? `${t('cocktail:adjustedAmountHeader', { percent: amountAdjustment })}\n${loadedCocktail.steps
                            .sort((a, b) => a.stepNumber - b.stepNumber)
                            .map((step) => {
                              return `${step.ingredients
                                .sort((a, b) => a.ingredientNumber - b.ingredientNumber)
                                .map((stepIngredient) => {
                                  return `- ${((stepIngredient.amount ?? 0) * (amountAdjustment / 100))?.toLocaleString(undefined, {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 2,
                                  })} ${userContext.getTranslation(stepIngredient.unit?.name ?? '')} ${stepIngredient.ingredient?.shortName ?? stepIngredient.ingredient?.name}${stepIngredient.optional ? `(${t('common:optionalLower')})` : ''}`;
                                })
                                .join('\n')}`;
                            })
                            .join('\n')}\n${t('cocktail:adjustedAmountPriceLine', { percent: amountAdjustment })}\n${
                            loadedCocktail.price?.formatPriceEfficent() + ' €'
                          } ${((loadedCocktail.price ?? 0) * (amountAdjustment / 100) - (loadedCocktail.price ?? 0))
                            .formatPriceEfficent({ signDisplay: 'exceptZero' })
                            .replace('-', '- ')
                            .replace('+', '+ ')} € = ${(
                            (loadedCocktail.price ?? 0) +
                            ((loadedCocktail.price ?? 0) * (amountAdjustment / 100) - (loadedCocktail!.price ?? 0))
                          ).formatPriceEfficent()} €`
                        : undefined,
                  }}
                  cocktailId={loadedCocktail.id}
                  cocktailName={loadedCocktail.name}
                  actionSource={'DETAIL_MODAL'}
                  notes={props.queueNotes}
                  onMarkedAsDone={
                    props.openReferer === 'QUEUE'
                      ? () => {
                          if (localQueueAmount === 1) {
                            modalContext.closeAllModals();
                          } else {
                            setLocalQueueAmount((prev) => (prev ?? 0) - 1);
                          }
                        }
                      : undefined
                  }
                />
              </div>
              <Divider size="sm" />
              <details className="rounded-box border border-base-300">
                <summary className="cursor-pointer px-4 py-3 font-bold">{t('cocktail:adjustAmount')}</summary>
                <div className="px-4 pb-4">
                  <div className={'flex flex-col gap-2 pr-3 pb-2 pl-4'}>
                    <div className={'flex items-end gap-2'}>
                      <FormControl className="w-full">
                        <Label>{t('common:quantity')}</Label>
                        <ButtonGroup className="w-full">
                          <Input
                            joinItem
                            inputMode={'numeric'}
                            className="w-full"
                            step={1}
                            min={1}
                            value={amountAdjustment}
                            onChange={(e) => setAmountAdjustment(toInteger(e.target.value))}
                          />
                          <span className="join-item flex w-12 items-center justify-center bg-primary text-primary-content">%</span>
                        </ButtonGroup>
                      </FormControl>
                      <Button type={'button'} variant="secondary" shape="square" onClick={() => setAmountAdjustment(100)}>
                        <FaArrowRotateLeft />
                      </Button>
                    </div>
                    {amountAdjustment != 100 && <div className={'font-thin'}>{t('cocktail:amountNotInStats')}</div>}
                  </div>
                </div>
              </details>
            </div>
            {/*Right side*/}
            <div className={'flex flex-col gap-2'}>
              <div className={'w-full gap-2'}>
                <span className={'font-bold'}>{t('cocktail:rating')}</span>
                <div className={'flex flex-row items-center gap-2'}>
                  {ratingError ? (
                    <>
                      <div>{t('cocktail:ratingsLoadError')}</div>
                      <Button type={'button'} variant="outline" size="sm" shape="square" disabled={ratingsLoading} onClick={refreshRatings}>
                        {ratingsLoading && <Loading size="sm" />}
                        <FaSyncAlt />
                      </Button>
                    </>
                  ) : (
                    <>
                      {ratingsLoading ? (
                        <Loading />
                      ) : (cocktailRatings ?? []).length > 0 ? (
                        (cocktailRatings.reduce((acc, rating) => acc + rating.rating, 0) / cocktailRatings.length).toLocaleString(undefined, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })
                      ) : (
                        t('cocktail:noRatingsShort')
                      )}
                      <StarsComponent
                        rating={cocktailRatings.length > 0 ? cocktailRatings.reduce((acc, rating) => acc + rating.rating, 0) / cocktailRatings.length : 0}
                      />
                      ({cocktailRatings.length})
                      {cocktailRatings.length != 0 ? (
                        <Button
                          type={'button'}
                          variant="outline"
                          size="sm"
                          shape="square"
                          className="border-info text-info print:hidden"
                          disabled={cocktailRatings.length === 0}
                          onClick={() =>
                            modalContext.openModal(
                              <CocktailRatingsModal cocktailId={loadedCocktail.id} cocktailName={loadedCocktail.name} onUpdate={refreshRatings} />,
                            )
                          }
                        >
                          <FaInfo />
                        </Button>
                      ) : (
                        <></>
                      )}
                      <div className={'flex-grow'}></div>
                      <Button
                        type={'button'}
                        variant="outline"
                        size="sm"
                        className="print:hidden"
                        onClick={() =>
                          modalContext.openModal(
                            <AddCocktailRatingModal cocktailId={props.cocktailId} cocktailName={loadedCocktail.name} onCreated={refreshRatings} />,
                          )
                        }
                      >
                        <FaPlus /> {t('cocktail:addRating')}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {loadedCocktail.notes && (
                <>
                  <div className={'font-bold'}>{t('cocktail:prepNotes')}</div>
                  <div className={'long-text-format rounded border border-base-300 p-2'}>{loadedCocktail.notes}</div>
                </>
              )}
              {loadedCocktail.description && (
                <>
                  <div className={'font-bold'}>{t('cocktail:description')}</div>
                  <div className={'long-text-format rounded border border-base-300 p-2 text-justify'}>{loadedCocktail.description}</div>
                </>
              )}
              {loadedCocktail.history && (
                <>
                  <div className={'font-bold'}>{t('cocktail:history')}</div>
                  <div className={'long-text-format rounded border border-base-300 p-2 text-justify'}>{loadedCocktail.history}</div>
                </>
              )}
              {loadedCocktail.steps.map((step) => step.ingredients).flat().length > 0 && (
                <>
                  <div className={'font-bold'}>{t('cocktail:ingredientDescriptions')}</div>
                  {loadedCocktail.steps
                    .map((step) => step.ingredients)
                    .flat()
                    .sort((a, b) => (a.ingredient?.name ?? '').localeCompare(b.ingredient?.name ?? ''))
                    .map((ingredient) => (
                      <div
                        key={`cocktail-details-${loadedCocktail.id}-ingredients-${ingredient.id}`}
                        className={'flex flex-col gap-2 rounded border border-base-300 p-2'}
                      >
                        <div className={'flex flex-row items-center justify-between gap-2'}>
                          <div className={'flex flex-col gap-2'}>
                            <div className={'font-bold'}>{ingredient.ingredient?.name}</div>
                            {ingredient.ingredient?.shortName && <div className={'text-sm font-thin italic'}>{ingredient.ingredient?.shortName}</div>}
                          </div>
                          <div>
                            {ingredient.ingredient?.hasImage ? (
                              <div className={'h-16 w-16'}>
                                <AvatarImage
                                  src={`/api/v1/workspaces/${workspaceId}/ingredients/${ingredient.ingredient?.id}/image`}
                                  onClick={() =>
                                    modalContext.openModal(
                                      <ImageModal image={`/api/v1/workspaces/${workspaceId}/ingredients/${ingredient.ingredient?.id}/image`} />,
                                    )
                                  }
                                  alt={t('cocktail:ingredientProductImageAlt', { name: ingredient.ingredient?.name })}
                                />
                              </div>
                            ) : (
                              <></>
                            )}
                          </div>
                        </div>
                        {ingredient.ingredient?.description && (
                          <div className={'text-justify'}>
                            <div className={'underline'}>{t('cocktail:ingredientDescription')}</div>
                            <div className={'long-text-format'}>{ingredient.ingredient?.description}</div>
                          </div>
                        )}
                        {ingredient.ingredient?.notes && (
                          <div className={'text-justify'}>
                            <div className={'underline'}>{t('common:notes')}</div>
                            <div className={'long-text-format'}>{ingredient.ingredient?.notes}</div>
                          </div>
                        )}
                        {(ingredient.ingredient?.tags.length ?? 0) > 0 && (
                          <div className={'gap-2'}>
                            {ingredient.ingredient?.tags.map((tag) => (
                              <Badge
                                key={`cocktail-details-${loadedCocktail.id}-ingredients-${ingredient.id}-tags-${tag}`}
                                variant="primary"
                                size="sm"
                                className="mr-1 print:border-current print:bg-transparent"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </>
              )}
              {loadedCocktail.garnishes.length > 0 && (
                <>
                  <div className={'font-bold'}>{t('cocktail:garnishDescriptions')}</div>
                  {loadedCocktail.garnishes
                    .map((garnish) => garnish.garnish)
                    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
                    .map((garnish, index) => (
                      <div key={`cocktail-details-garnish-${index}-${garnish?.id}`} className={'flex flex-col gap-2 rounded border border-base-300 p-2'}>
                        <div className={'flex flex-row justify-between gap-2'}>
                          <div className={`font-bold`}>{garnish.name}</div>
                          {garnish.hasImage && (
                            <div className={'h-12 w-12'}>
                              <AvatarImage
                                src={`/api/v1/workspaces/${workspaceId}/garnishes/${garnish.id}/image`}
                                alt={t('cocktail:garnishImageAlt', { name: garnish?.name })}
                                onClick={() => modalContext.openModal(<ImageModal image={`/api/v1/workspaces/${workspaceId}/garnishes/${garnish.id}/image`} />)}
                              />
                            </div>
                          )}
                        </div>
                        {garnish.description && (
                          <>
                            <div className={'underline'}>{t('cocktail:description')}</div>
                            <div className={'long-text-format'}>{garnish.description}</div>
                          </>
                        )}
                        {garnish.notes && (
                          <>
                            <div className={'underline'}>{t('common:notes')}</div>
                            <div className={'long-text-format'}>{garnish.notes}</div>
                          </>
                        )}
                      </div>
                    ))}
                </>
              )}

              <div className={'flex-grow'}></div>
              {userContext.isUserPermitted(Role.MANAGER) && ingredients && (
                <>
                  <div className={'font-bold'}>{t('cocktail:materialCosts')}</div>
                  <div>
                    {calcCocktailTotalPrice(loadedCocktail, ingredients).formatPrice() + ' €'}
                    {amountAdjustment != 100
                      ? ` ${(
                          calcCocktailTotalPrice(loadedCocktail, ingredients) * (amountAdjustment / 100) -
                          calcCocktailTotalPrice(loadedCocktail, ingredients)
                        )
                          .formatPrice({ signDisplay: 'exceptZero' })
                          .replace('-', '- ')
                          .replace('+', '+ ')} € = ${(
                          calcCocktailTotalPrice(loadedCocktail, ingredients) +
                          (calcCocktailTotalPrice(loadedCocktail, ingredients) * (amountAdjustment / 100) - calcCocktailTotalPrice(loadedCocktail, ingredients))
                        ).formatPrice()} € (${amountAdjustment}%)`
                      : ''}
                  </div>
                </>
              )}
            </div>
          </div>
        </CardBody>
      </div>
    </>
  );
}
