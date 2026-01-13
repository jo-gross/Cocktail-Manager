import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { TimeRange, TimeRangePicker } from '@components/statistics/TimeRangePicker';
import { getEndOfDay, getOrderedHourLabels, getStartOfWeek, reorderHourDistribution, getLogicalDate } from '@lib/dateHelpers';
import { DAY_NAMES_SHORT_MONDAY_FIRST, DAY_ORDER_MONDAY_FIRST, reorderDaysMondayFirst } from '@lib/dayConstants';
import { StatCard } from '@components/statistics/StatCard';
import { TimeSeriesChart } from '@components/statistics/TimeSeriesChart';
import { DistributionChart } from '@components/statistics/DistributionChart';
import { StackedDistributionChart } from '@components/statistics/StackedDistributionChart';
import { AnalysisCocktailTable } from '@components/statistics/AnalysisCocktailTable';
import { ListDetailLayout } from '@components/statistics/ListDetailLayout';
import { CocktailList } from '@components/statistics/CocktailList';
import { TagList } from '@components/statistics/TagList';
import { IngredientList } from '@components/statistics/IngredientList';
import { SavedSetSelector } from '@components/statistics/SavedSetSelector';
import { alertService } from '@lib/alertService';
import { Loading } from '@components/Loading';
import { SavedSetType } from '@generated/prisma/client';
import { FaSyncAlt } from 'react-icons/fa';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { UserContext } from '@lib/context/UserContextProvider';
import InputModal from '@components/modals/InputModal';
import { AnalysisCocktailSelector } from '@components/statistics/AnalysisCocktailSelector';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CocktailStatisticItemFull } from '../../../../../models/CocktailStatisticItemFull';
import '@lib/DateUtils';
import '@lib/StringUtils';
import { AmountWithUnit, calculateAggregatedIngredientAmount, IngredientVolumeInfo } from '@lib/CocktailRecipeCalculation';

type Tab = 'overview' | 'cocktails' | 'comparisons' | 'analysis';

interface OverviewData {
  kpis: {
    today: {
      total: number;
      delta: number;
      previousTotal: number;
      previousPeriodLabel: string;
      avgPerHour: number;
      peakHour: number;
      peakDay: number;
      topCocktail: { name: string; count: number } | null;
      revenue: number;
    };
    week: {
      total: number;
      delta: number;
      previousTotal: number;
      previousPeriodLabel: string;
      topCocktail: { name: string; count: number } | null;
      revenue: number;
    };
    month: {
      total: number;
      delta: number;
      previousTotal: number;
      previousPeriodLabel: string;
      topCocktail: { name: string; count: number } | null;
      revenue: number;
    };
    period: {
      total: number;
      topCocktail: { name: string; count: number } | null;
      revenue: number;
    };
    avgPerHour: {
      value: number;
      delta: number;
      previousValue: number;
      previousPeriodLabel: string;
    };
    allTime: {
      total: number;
      avgPerDay: number;
      daysActive: number;
      topCocktail: { name: string; count: number } | null;
      revenue: number;
    };
  };
  charts?: {
    today: {
      timeSeries: Array<{ date: string; count: number }>;
      topCocktails: Array<{ cocktailId: string; name: string; count: number }>;
      hourDistribution: Array<{ hour: number; count: number }>;
    };
    week: {
      timeSeries: Array<{ date: string; count: number }>;
      topCocktails: Array<{ cocktailId: string; name: string; count: number }>;
      hourDistribution: Array<{ hour: number; count: number }>;
    };
    month: {
      timeSeries: Array<{ date: string; count: number }>;
      topCocktails: Array<{ cocktailId: string; name: string; count: number }>;
      hourDistribution: Array<{ hour: number; count: number }>;
    };
    period: {
      timeSeries: Array<{ date: string; count: number }>;
      topCocktails: Array<{ cocktailId: string; name: string; count: number }>;
      hourDistribution: Array<{ hour: number; count: number }>;
    };
    allTime: {
      timeSeries: Array<{ date: string; count: number }>;
      topCocktails: Array<{ cocktailId: string; name: string; count: number }>;
      hourDistribution: Array<{ hour: number; count: number }>;
    };
  };
  // Legacy fields for backward compatibility
  timeSeries: Array<{ date: string; count: number }>;
  topCocktails: Array<{ cocktailId: string; name: string; count: number }>;
  hourDistribution: Array<{ hour: number; count: number }>;
}

const StatisticsAdvancedPage = () => {
  const router = useRouter();
  const { workspaceId } = router.query;
  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);

  // Initialize timeRange with defaults
  // Note: dayStartTime will be loaded asynchronously, so initial calculation may not include it
  // It will be updated once dayStartTime is loaded
  const getInitialTimeRange = useCallback((dayStartTimeParam?: string): TimeRange => {
    // Default to this week
    const now = new Date();
    const weekStart = getStartOfWeek(now, dayStartTimeParam);
    const todayEnd = getEndOfDay(now, dayStartTimeParam);
    return {
      startDate: weekStart,
      endDate: todayEnd,
      preset: 'thisWeek',
    };
  }, []);

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [timeRange, setTimeRange] = useState<TimeRange>(getInitialTimeRange());
  const [comparisonsDataLoaded, setComparisonsDataLoaded] = useState(false);
  const [overviewPeriodTab, setOverviewPeriodTab] = useState<'today' | 'week' | 'month' | 'period' | 'allTime'>('today');
  const [dayStartTime, setDayStartTime] = useState<string | undefined>(undefined);

  // Lade Workspace-Settings für Tagesstart
  useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/workspaces/${workspaceId}/settings`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data?.statisticDayStartTime) {
          setDayStartTime(data.data.statisticDayStartTime);
        }
      })
      .catch(console.error);
  }, [workspaceId]);

  // Update timeRange when dayStartTime is loaded
  useEffect(() => {
    if (dayStartTime !== undefined) {
      const newRange = getInitialTimeRange(dayStartTime);
      setTimeRange(newRange);
    }
  }, [dayStartTime, getInitialTimeRange]);

  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(false);

  // Tab 2: Cocktails
  const [cocktailsData, setCocktailsData] = useState<
    Array<{
      cocktailId: string;
      name: string;
      tags?: string[];
      count: number;
      percentage: number;
      delta: number;
      rank: number;
      ingredients?: Array<{
        ingredientId: string;
        ingredientName: string;
        ingredientPrice: number;
        amount: number;
        unitId: string;
        unitName: string;
        availableUnits: Array<{
          unitId: string;
          unitName: string;
          volume: number;
        }>;
      }>;
    }>
  >([]);
  const [selectedCocktailId, setSelectedCocktailId] = useState<string | undefined>();
  const [cocktailDetailData, setCocktailDetailData] = useState<any>(null);
  const [hiddenCocktailIds, setHiddenCocktailIds] = useState<Set<string>>(new Set());
  const [cocktailsLoading, setCocktailsLoading] = useState(false);
  const [cocktailDetailLoading, setCocktailDetailLoading] = useState(false);
  const [selectedCocktailDetailSetId, setSelectedCocktailDetailSetId] = useState<string | undefined>();
  const [cocktailDetailSetData, setCocktailDetailSetData] = useState<any>(null);
  const [cocktailDetailSetLoading, setCocktailDetailSetLoading] = useState(false);

  // Tab 2: Grouped statistics
  const [cocktailStatisticItems, setCocktailStatisticItems] = useState<CocktailStatisticItemFull[]>([]);
  const [groupBy, setGroupBy] = useState<'hour' | 'day'>('hour');
  const [showAllDays, setShowAllDays] = useState(false);

  // Tab 3: Comparisons
  const [comparisonMode, setComparisonMode] = useState<'tags' | 'ingredients'>('tags');
  const [tagsData, setTagsData] = useState<Array<{ tag: string; count: number; cocktailCount: number; percentage: number }>>([]);
  const [ingredientsData, setIngredientsData] = useState<Array<{ ingredient: string; count: number; cocktailCount: number; percentage: number }>>([]);
  // aggregatedIngredientsData is now calculated via useMemo from cocktailsData
  const [selectedOutputUnits, setSelectedOutputUnits] = useState<Record<string, string>>({});
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(new Set());
  const [comparisonLogic, setComparisonLogic] = useState<'AND' | 'OR'>('AND');
  const [selectedSetId, setSelectedSetId] = useState<string | undefined>();
  const [originalComparisonSetItems, setOriginalComparisonSetItems] = useState<Set<string>>(new Set()); // Original items from selected set
  const [originalComparisonSetLogic, setOriginalComparisonSetLogic] = useState<'AND' | 'OR'>('AND'); // Original logic from selected set
  const [setDetailData, setSetDetailData] = useState<any>(null);
  const [comparisonsLoading, setComparisonsLoading] = useState(false);
  const [setDetailLoading, setSetDetailLoading] = useState(false);
  const [savedSetsRefreshKey, setSavedSetsRefreshKey] = useState(0);

  // Tab 4: Analysis
  const [selectedAnalysisCocktailIds, setSelectedAnalysisCocktailIds] = useState<Set<string>>(new Set()); // Current selection (from checkboxes or set)
  const [originalAnalysisSetItems, setOriginalAnalysisSetItems] = useState<Set<string>>(new Set()); // Original items from selected set
  const [analysisCocktailDetails, setAnalysisCocktailDetails] = useState<Map<string, any>>(new Map());
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [allCocktails, setAllCocktails] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [allCocktailsLoading, setAllCocktailsLoading] = useState(false);
  const [selectedAnalysisSetId, setSelectedAnalysisSetId] = useState<string | undefined>(undefined);
  const [analysisSetsRefreshKey, setAnalysisSetsRefreshKey] = useState(0);

  const loadOverviewData = useCallback(async () => {
    if (!workspaceId) return;

    try {
      setLoading(true);
      const startDate = timeRange.startDate.toISOString();
      const endDate = timeRange.endDate.toISOString();
      const response = await fetch(`/api/workspaces/${workspaceId}/statistics/advanced/overview?startDate=${startDate}&endDate=${endDate}`);
      if (response.ok) {
        const body = await response.json();
        setOverviewData(body.data);
      } else {
        let body;
        try {
          body = await response.json();
        } catch (jsonError) {
          const text = await response.text();
          console.error('StatisticsAdvancedPage -> loadOverviewData - Non-JSON response', text);
          alertService.error('Fehler beim Laden der Übersichtsdaten', response.status, response.statusText);
          return;
        }
        console.error('StatisticsAdvancedPage -> loadOverviewData', response);
        alertService.error(body.message ?? 'Fehler beim Laden der Übersichtsdaten', response.status, response.statusText);
      }
    } catch (error) {
      console.error('StatisticsAdvancedPage -> loadOverviewData', error);
      alertService.error('Es ist ein Fehler aufgetreten');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, timeRange.startDate.getTime(), timeRange.endDate.getTime()]);

  const loadCocktailsData = useCallback(async () => {
    if (!workspaceId) return;

    try {
      setCocktailsLoading(true);
      const startDate = timeRange.startDate.toISOString();
      const endDate = timeRange.endDate.toISOString();
      const response = await fetch(`/api/workspaces/${workspaceId}/statistics/advanced/cocktails?startDate=${startDate}&endDate=${endDate}`);
      if (response.ok) {
        const body = await response.json();
        setCocktailsData(body.data);
      } else {
        const body = await response.json();
        console.error('StatisticsAdvancedPage -> loadCocktailsData', response);
        alertService.error(body.message ?? 'Fehler beim Laden der Cocktail-Daten', response.status, response.statusText);
      }
    } catch (error) {
      console.error('StatisticsAdvancedPage -> loadCocktailsData', error);
      alertService.error('Es ist ein Fehler aufgetreten');
    } finally {
      setCocktailsLoading(false);
    }
  }, [workspaceId, timeRange.startDate.getTime(), timeRange.endDate.getTime()]);

  const loadCocktailStatisticItems = useCallback(async () => {
    if (!workspaceId) return;

    try {
      setCocktailsLoading(true);
      const startDate = timeRange.startDate.toISOString();
      const endDate = timeRange.endDate.toISOString();
      const response = await fetch(`/api/workspaces/${workspaceId}/statistics/cocktails?startDate=${startDate}&endDate=${endDate}`);
      if (response.ok) {
        const body = await response.json();
        // Ensure cocktail details are included
        setCocktailStatisticItems(body.data);
      } else {
        const body = await response.json();
        console.error('StatisticsAdvancedPage -> loadCocktailStatisticItems', response);
        alertService.error(body.message ?? 'Fehler beim Laden der Statistik-Items', response.status, response.statusText);
      }
    } catch (error) {
      console.error('StatisticsAdvancedPage -> loadCocktailStatisticItems', error);
      alertService.error('Es ist ein Fehler aufgetreten');
    } finally {
      setCocktailsLoading(false);
    }
  }, [workspaceId, timeRange.startDate.getTime(), timeRange.endDate.getTime()]);

  // Helper function to calculate aggregated amount with unit conversion
  // Uses the shared helper from CocktailRecipeCalculation
  const calculateAggregatedAmount = useCallback(
    (
      ingredient: {
        ingredientId: string;
        units: Array<{ unitId: string; unitName: string; amount: number }>;
        availableUnits: Array<{ unitId: string; unitName: string; volume: number }>;
      },
      targetUnitId: string | undefined,
    ): { amount: number; unitName: string } => {
      // Convert to the format expected by the helper function
      const amounts: AmountWithUnit[] = ingredient.units.map((u) => ({
        amount: u.amount,
        unitId: u.unitId,
        unitName: u.unitName,
      }));

      const availableUnits: IngredientVolumeInfo[] = ingredient.availableUnits.map((u) => ({
        unitId: u.unitId,
        unitName: u.unitName,
        volume: u.volume,
      }));

      const result = calculateAggregatedIngredientAmount(amounts, availableUnits, targetUnitId);
      return {
        amount: result.amount,
        unitName: result.unitName,
      };
    },
    [],
  );

  // Helper function to calculate ingredient cost
  // Cost = ingredientPrice * totalInBaseUnit (where baseUnit = 1 purchase unit of ingredient)
  const calculateIngredientCost = useCallback(
    (ingredient: {
      ingredientPrice: number;
      units: Array<{ unitId: string; unitName: string; amount: number }>;
      availableUnits: Array<{ unitId: string; unitName: string; volume: number }>;
    }): number => {
      // Calculate total in base unit by converting all unit amounts
      let totalInBaseUnit = 0;
      ingredient.units.forEach((unitData) => {
        const sourceVolume = ingredient.availableUnits.find((u) => u.unitId === unitData.unitId);
        if (sourceVolume && sourceVolume.volume > 0) {
          // Convert to base unit: amount / volume
          totalInBaseUnit += unitData.amount / sourceVolume.volume;
        }
      });
      // Cost = price per base unit * total base units
      return ingredient.ingredientPrice * totalInBaseUnit;
    },
    [],
  );

  // Process data for grouped chart
  interface ProcessedData {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor: string;
    }[];
  }

  const processDataGroupByHourly = useCallback((data: CocktailStatisticItemFull[], hiddenIds: Set<string>): ProcessedData => {
    const hourlyCocktails: Record<string, Record<string, number>> = {};

    data
      .filter((item) => !hiddenIds.has(item.cocktailId))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((entry) => {
        const date = new Date(entry.date);
        const hour = date.getHours();
        const dateString = date.toFormatDateString();
        const formattedHour = `${dateString} ${hour}:00 - ${hour + 1}:00`;
        const cocktailName = entry.cocktail.name;

        if (!hourlyCocktails[formattedHour]) {
          hourlyCocktails[formattedHour] = {};
        }
        if (!hourlyCocktails[formattedHour][cocktailName]) {
          hourlyCocktails[formattedHour][cocktailName] = 0;
        }

        hourlyCocktails[formattedHour][cocktailName]++;
      });

    const labels = Object.keys(hourlyCocktails);
    const cocktailNames = new Set<string>();

    Object.values(hourlyCocktails).forEach((cocktails) => {
      Object.keys(cocktails).forEach((name) => cocktailNames.add(name));
    });

    const datasets = Array.from(cocktailNames).map((cocktailName) => ({
      label: cocktailName,
      data: labels.map((hour) => hourlyCocktails[hour][cocktailName] || 0),
      backgroundColor: cocktailName.string2color(),
    }));

    return { labels, datasets };
  }, []);

  const processDataGroupByDaily = useCallback(
    (data: CocktailStatisticItemFull[], showEmptyDays: boolean, hiddenIds: Set<string>, startDate: Date, endDate: Date, dayStartTime?: string): ProcessedData => {
      const dailyCocktails: Record<string, Record<string, number>> = {};

      data
        .filter((item) => !hiddenIds.has(item.cocktailId))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .forEach((entry) => {
          const date = new Date(entry.date);
          const adjustedDate = getLogicalDate(date, dayStartTime);

          const nextDate = new Date(adjustedDate);
          nextDate.setDate(adjustedDate.getDate() + 1);

          const dateString = `${adjustedDate.toFormatDateString()}/${nextDate.toFormatDateString()}`;
          const cocktailName = entry.cocktail.name;

          if (!dailyCocktails[dateString]) {
            dailyCocktails[dateString] = {};
          }
          if (!dailyCocktails[dateString][cocktailName]) {
            dailyCocktails[dateString][cocktailName] = 0;
          }

          dailyCocktails[dateString][cocktailName]++;
        });

      let labels = Object.keys(dailyCocktails);
      const cocktailNames = new Set<string>();

      if (showEmptyDays) {
        labels = [];
        const loopStartDate = new Date(startDate);
        const loopEndDate = new Date(endDate);
        const allDates: string[] = [];

        while (loopStartDate <= loopEndDate) {
          const nextDate = new Date(loopStartDate);
          nextDate.setDate(loopStartDate.getDate() + 1);
          const dateString = `${loopStartDate.toFormatDateString()}/${nextDate.toFormatDateString()}`;
          allDates.push(dateString);
          loopStartDate.setDate(loopStartDate.getDate() + 1);
        }

        allDates.forEach((dateString) => {
          labels.push(dateString);
          if (!dailyCocktails[dateString]) {
            dailyCocktails[dateString] = {};
          }
        });
      }

      Object.values(dailyCocktails).forEach((cocktails) => {
        Object.keys(cocktails).forEach((name) => cocktailNames.add(name));
      });

      const datasets = Array.from(cocktailNames).map((cocktailName) => ({
        label: cocktailName,
        data: labels.map((day) => dailyCocktails[day][cocktailName] || 0),
        backgroundColor: cocktailName.string2color(),
      }));

      return { labels, datasets };
    },
    [],
  );

  const loadCocktailDetail = useCallback(
    async (cocktailId: string) => {
      if (!workspaceId || !cocktailId) return;

      try {
        setCocktailDetailLoading(true);
        const startDate = timeRange.startDate.toISOString();
        const endDate = timeRange.endDate.toISOString();
        const response = await fetch(`/api/workspaces/${workspaceId}/statistics/advanced/cocktails/${cocktailId}?startDate=${startDate}&endDate=${endDate}`);
        if (response.ok) {
          const body = await response.json();
          setCocktailDetailData(body.data);
        } else {
          const body = await response.json();
          console.error('StatisticsAdvancedPage -> loadCocktailDetail', response);
          alertService.error(body.message ?? 'Fehler beim Laden der Cocktail-Details', response.status, response.statusText);
        }
      } catch (error) {
        console.error('StatisticsAdvancedPage -> loadCocktailDetail', error);
        alertService.error('Es ist ein Fehler aufgetreten');
      } finally {
        setCocktailDetailLoading(false);
      }
    },
    [workspaceId, timeRange.startDate.getTime(), timeRange.endDate.getTime()],
  );

  const loadTagsData = useCallback(async () => {
    if (!workspaceId) return;

    try {
      setComparisonsLoading(true);
      const startDate = timeRange.startDate.toISOString();
      const endDate = timeRange.endDate.toISOString();
      const response = await fetch(`/api/workspaces/${workspaceId}/statistics/advanced/tags?startDate=${startDate}&endDate=${endDate}`);
      if (response.ok) {
        const body = await response.json();
        setTagsData(body.data);
      } else {
        const body = await response.json();
        console.error('StatisticsAdvancedPage -> loadTagsData', response);
        alertService.error(body.message ?? 'Fehler beim Laden der Tag-Daten', response.status, response.statusText);
      }
    } catch (error) {
      console.error('StatisticsAdvancedPage -> loadTagsData', error);
      alertService.error('Es ist ein Fehler aufgetreten');
    } finally {
      setComparisonsLoading(false);
    }
  }, [workspaceId, timeRange]);

  const loadIngredientsData = useCallback(async () => {
    if (!workspaceId) return;

    try {
      setComparisonsLoading(true);
      const startDate = timeRange.startDate.toISOString();
      const endDate = timeRange.endDate.toISOString();
      const response = await fetch(`/api/workspaces/${workspaceId}/statistics/advanced/ingredients?startDate=${startDate}&endDate=${endDate}`);
      if (response.ok) {
        const body = await response.json();
        setIngredientsData(body.data);
      } else {
        const body = await response.json();
        console.error('StatisticsAdvancedPage -> loadIngredientsData', response);
        alertService.error(body.message ?? 'Fehler beim Laden der Zutaten-Daten', response.status, response.statusText);
      }
    } catch (error) {
      console.error('StatisticsAdvancedPage -> loadIngredientsData', error);
      alertService.error('Es ist ein Fehler aufgetreten');
    } finally {
      setComparisonsLoading(false);
    }
  }, [workspaceId, timeRange]);

  // Calculate aggregated ingredients from comparison cocktails (count * ingredient amount)
  // Only includes cocktails that are part of the selected set/comparison
  // Aggregates all amounts per ingredient, grouped by unit, for later conversion
  const aggregatedIngredientsData = useMemo(() => {
    const aggregated: Record<
      string,
      {
        ingredientId: string;
        ingredientName: string;
        ingredientPrice: number; // Price for cost calculation
        // Store raw amounts per unit for conversion
        units: Record<
          string,
          {
            unitId: string;
            unitName: string;
            amount: number;
          }
        >;
        // Available units for conversion (from IngredientVolume)
        availableUnits: Array<{
          unitId: string;
          unitName: string;
          volume: number;
        }>;
      }
    > = {};

    // Get cocktail IDs and counts from setDetailData
    const comparisonCocktails = setDetailData?.cocktails as Array<{ id?: string; cocktailId?: string; name: string; count: number }> | undefined;
    if (!comparisonCocktails || comparisonCocktails.length === 0) {
      return [];
    }

    // Create a map of cocktailId -> count from the comparison data
    const comparisonCountMap = new Map<string, number>();
    comparisonCocktails.forEach((c) => {
      const id = c.id || c.cocktailId;
      if (id) {
        comparisonCountMap.set(id, c.count);
      }
    });

    // Filter cocktailsData to only include cocktails from the comparison
    // Aggregate: for each ingredient, sum (amount * cocktailCount) per unit
    cocktailsData
      .filter((cocktail) => comparisonCountMap.has(cocktail.cocktailId))
      .forEach((cocktail) => {
        if (!cocktail.ingredients) return;

        const comparisonCount = comparisonCountMap.get(cocktail.cocktailId) || 0;

        cocktail.ingredients.forEach((ing) => {
          const ingredientId = ing.ingredientId;
          // Total amount = recipe amount * number of cocktails ordered
          const totalAmount = ing.amount * comparisonCount;

          if (!aggregated[ingredientId]) {
            aggregated[ingredientId] = {
              ingredientId: ing.ingredientId,
              ingredientName: ing.ingredientName,
              ingredientPrice: ing.ingredientPrice || 0,
              units: {},
              availableUnits: [],
            };
          }

          // Aggregate amounts per unit
          if (!aggregated[ingredientId].units[ing.unitId]) {
            aggregated[ingredientId].units[ing.unitId] = {
              unitId: ing.unitId,
              unitName: ing.unitName,
              amount: 0,
            };
          }
          aggregated[ingredientId].units[ing.unitId].amount += totalAmount;

          // Merge availableUnits from IngredientVolume (for unit conversion)
          if (ing.availableUnits) {
            ing.availableUnits.forEach((au) => {
              if (!aggregated[ingredientId].availableUnits.find((u) => u.unitId === au.unitId)) {
                aggregated[ingredientId].availableUnits.push({
                  unitId: au.unitId,
                  unitName: au.unitName,
                  volume: au.volume,
                });
              }
            });
          }
        });
      });

    const result = Object.values(aggregated)
      .map((item) => ({
        ingredientId: item.ingredientId,
        ingredientName: item.ingredientName,
        ingredientPrice: item.ingredientPrice,
        // All aggregated amounts per unit
        units: Object.values(item.units).sort((a, b) => a.unitName.localeCompare(b.unitName)),
        // Available units for conversion (from IngredientVolume)
        availableUnits: item.availableUnits.sort((a, b) => a.unitName.localeCompare(b.unitName)),
      }))
      .sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));

    // Set default selected units for new ingredients (first available unit)
    setSelectedOutputUnits((prev) => {
      const newUnits = { ...prev };
      result.forEach((ingredient) => {
        if (!newUnits[ingredient.ingredientId] && ingredient.availableUnits.length > 0) {
          newUnits[ingredient.ingredientId] = ingredient.availableUnits[0].unitId;
        }
      });
      return newUnits;
    });

    return result;
  }, [cocktailsData, setDetailData]);

  const loadComparisonDetail = useCallback(
    async (items: Set<string>, type: 'TAG_SET' | 'INGREDIENT_SET') => {
      if (!workspaceId || items.size === 0) {
        setSetDetailData(null);
        return;
      }

      try {
        setSetDetailLoading(true);
        const startDate = timeRange.startDate.toISOString();
        const endDate = timeRange.endDate.toISOString();
        const itemsArray = Array.from(items);
        const logic = comparisonLogic;

        // Build URL with proper encoding
        const params = new URLSearchParams({
          type,
          items: JSON.stringify(itemsArray),
          logic,
          startDate,
          endDate,
        });

        const response = await fetch(`/api/workspaces/${workspaceId}/statistics/advanced/compare?${params.toString()}`);
        if (response.ok) {
          const body = await response.json();
          setSetDetailData(body.data);
        } else {
          const body = await response.json();
          console.error('StatisticsAdvancedPage -> loadComparisonDetail', response);
          alertService.error(body.message ?? 'Fehler beim Laden der Vergleichsdaten', response.status, response.statusText);
        }
      } catch (error) {
        console.error('StatisticsAdvancedPage -> loadComparisonDetail', error);
        alertService.error('Es ist ein Fehler aufgetreten');
      } finally {
        setSetDetailLoading(false);
      }
    },
    [workspaceId, timeRange, comparisonLogic],
  );

  const handleSaveSet = () => {
    if (!workspaceId) return;

    const items = comparisonMode === 'tags' ? Array.from(selectedTags) : Array.from(selectedIngredients);
    if (items.length === 0) {
      alertService.error('Bitte wählen Sie mindestens ein Element aus');
      return;
    }

    modalContext.openModal(
      <InputModal
        title="Set speichern"
        description={`Geben Sie einen Namen für das ${comparisonMode === 'tags' ? 'Tag' : 'Zutaten'}-Set ein:`}
        onInputSubmit={async (name) => {
          const response = await fetch(`/api/workspaces/${workspaceId}/statistics/advanced/sets`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name,
              type: comparisonMode === 'tags' ? 'TAG_SET' : 'INGREDIENT_SET',
              logic: comparisonLogic,
              items,
            }),
          });

          if (response.ok) {
            alertService.success('Set gespeichert');
            setSelectedTags(new Set());
            setSelectedIngredients(new Set());
            // Refresh saved sets
            setSavedSetsRefreshKey((prev) => prev + 1);
          } else {
            const body = await response.json();
            alertService.error(body.message ?? 'Fehler beim Speichern des Sets');
          }
        }}
      />,
    );
  };

  const handleSaveAnalysisSet = () => {
    if (!workspaceId) return;

    const items = Array.from(selectedAnalysisCocktailIds);
    if (items.length === 0) {
      alertService.error('Bitte wählen Sie mindestens einen Cocktail aus');
      return;
    }

    modalContext.openModal(
      <InputModal
        title="Cocktail-Set speichern"
        description="Geben Sie einen Namen für das Cocktail-Set ein:"
        onInputSubmit={async (name) => {
          const response = await fetch(`/api/workspaces/${workspaceId}/statistics/advanced/sets`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name,
              type: 'COCKTAIL_SET',
              logic: 'AND',
              items,
            }),
          });

          if (response.ok) {
            alertService.success('Cocktail-Set gespeichert');
            // Clear selection and refresh
            setSelectedAnalysisSetId(undefined);
            setOriginalAnalysisSetItems(new Set());
            setAnalysisSetsRefreshKey((prev) => prev + 1);
          } else {
            const body = await response.json();
            alertService.error(body.message ?? 'Fehler beim Speichern des Sets');
          }
        }}
      />,
    );
  };

  // Update existing analysis set
  const handleUpdateAnalysisSet = async () => {
    if (!workspaceId || !selectedAnalysisSetId) return;

    const items = Array.from(selectedAnalysisCocktailIds);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/statistics/advanced/sets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedAnalysisSetId,
          items,
        }),
      });
      if (response.ok) {
        setOriginalAnalysisSetItems(new Set(selectedAnalysisCocktailIds));
        setAnalysisSetsRefreshKey((prev) => prev + 1);
        alertService.success('Set aktualisiert');
      } else {
        const body = await response.json();
        alertService.error(body.message ?? 'Fehler beim Aktualisieren des Sets');
      }
    } catch (error) {
      console.error('handleUpdateAnalysisSet', error);
      alertService.error('Es ist ein Fehler aufgetreten');
    }
  };

  // Reset analysis selection to original set items
  const handleResetAnalysisSet = () => {
    setSelectedAnalysisCocktailIds(new Set(originalAnalysisSetItems));
  };

  // Update existing comparison set (tags or ingredients)
  const handleUpdateComparisonSet = async () => {
    if (!workspaceId || !selectedSetId) return;

    const items = comparisonMode === 'tags' ? Array.from(selectedTags) : Array.from(selectedIngredients);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/statistics/advanced/sets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedSetId,
          items,
          logic: comparisonLogic,
        }),
      });
      if (response.ok) {
        setOriginalComparisonSetItems(new Set(items));
        setOriginalComparisonSetLogic(comparisonLogic);
        setSavedSetsRefreshKey((prev) => prev + 1);
        alertService.success('Set aktualisiert');
      } else {
        const body = await response.json();
        alertService.error(body.message ?? 'Fehler beim Aktualisieren des Sets');
      }
    } catch (error) {
      console.error('handleUpdateComparisonSet', error);
      alertService.error('Es ist ein Fehler aufgetreten');
    }
  };

  // Reset comparison selection to original set items and logic
  const handleResetComparisonSet = () => {
    if (comparisonMode === 'tags') {
      setSelectedTags(new Set(originalComparisonSetItems));
    } else {
      setSelectedIngredients(new Set(originalComparisonSetItems));
    }
    setComparisonLogic(originalComparisonSetLogic);
  };

  useEffect(() => {
    if (activeTab === 'overview') {
      loadOverviewData();
    } else if (activeTab === 'cocktails') {
      loadCocktailsData();
      loadCocktailStatisticItems();
    } else if (activeTab === 'comparisons') {
      setComparisonsDataLoaded(false);
      // Load cocktailsData for aggregated ingredients calculation + tags/ingredients data
      const loadPromises: Promise<void>[] = [loadCocktailsData()];
      if (comparisonMode === 'tags') {
        loadPromises.push(loadTagsData());
      } else {
        loadPromises.push(loadIngredientsData());
      }
      Promise.all(loadPromises).then(() => setComparisonsDataLoaded(true));
    } else {
      setComparisonsDataLoaded(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, comparisonMode]);

  // Reload comparisons data when timeRange changes (only if already loaded)
  useEffect(() => {
    if (activeTab === 'comparisons' && comparisonsDataLoaded) {
      loadCocktailsData(); // For aggregated ingredients calculation
      if (comparisonMode === 'tags') {
        loadTagsData();
      } else {
        loadIngredientsData();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange.startDate.getTime(), timeRange.endDate.getTime(), activeTab, comparisonMode, comparisonsDataLoaded]);

  // Reload cocktails data when timeRange changes (only if already on cocktails tab)
  useEffect(() => {
    if (activeTab === 'cocktails') {
      loadCocktailsData();
      loadCocktailStatisticItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange.startDate.getTime(), timeRange.endDate.getTime(), activeTab]);

  // Update groupBy when time range is less than 24 hours
  useEffect(() => {
    if (activeTab === 'cocktails' && timeRange.endDate.getTime() - timeRange.startDate.getTime() < 24 * 3600 * 1000) {
      setGroupBy('hour');
    }
  }, [activeTab, timeRange.startDate.getTime(), timeRange.endDate.getTime()]);

  // Auto-select first cocktail when data loads and none is selected
  useEffect(() => {
    if (activeTab === 'cocktails' && cocktailsData.length > 0 && !selectedCocktailId) {
      setSelectedCocktailId(cocktailsData[0].cocktailId);
    }
  }, [activeTab, cocktailsData, selectedCocktailId]);

  // Load cocktail detail when selection or timeRange changes
  useEffect(() => {
    if (activeTab === 'cocktails' && selectedCocktailId) {
      loadCocktailDetail(selectedCocktailId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedCocktailId, timeRange.startDate.getTime(), timeRange.endDate.getTime()]);

  // Convert Sets to strings for stable dependency tracking
  const selectedTagsString = useMemo(() => Array.from(selectedTags).sort().join(','), [selectedTags]);
  const selectedIngredientsString = useMemo(() => Array.from(selectedIngredients).sort().join(','), [selectedIngredients]);
  const selectedAnalysisCocktailIdsString = useMemo(() => Array.from(selectedAnalysisCocktailIds).sort().join(','), [selectedAnalysisCocktailIds]);

  useEffect(() => {
    if (activeTab === 'comparisons') {
      // Always use current selection (whether from set or manually selected)
      if (comparisonMode === 'tags' && selectedTags.size > 0) {
        loadComparisonDetail(selectedTags, 'TAG_SET');
      } else if (comparisonMode === 'ingredients' && selectedIngredients.size > 0) {
        loadComparisonDetail(selectedIngredients, 'INGREDIENT_SET');
      } else {
        setSetDetailData(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    selectedTagsString,
    selectedIngredientsString,
    comparisonMode,
    timeRange.startDate.getTime(),
    timeRange.endDate.getTime(),
    comparisonLogic,
    loadComparisonDetail,
  ]);

  // Change detection for Tab 4 (Cocktail-Analyse): Check if selection differs from original set
  const hasAnalysisSetChanges = useMemo(() => {
    if (!selectedAnalysisSetId) return false;
    const original = Array.from(originalAnalysisSetItems).sort().join(',');
    const current = Array.from(selectedAnalysisCocktailIds).sort().join(',');
    return original !== current;
  }, [selectedAnalysisSetId, originalAnalysisSetItems, selectedAnalysisCocktailIds]);

  // Change detection for Tab 3 (Vergleiche): Check if selection or logic differs from original set
  const hasComparisonSetChanges = useMemo(() => {
    if (!selectedSetId) return false;
    const currentItems = comparisonMode === 'tags' ? selectedTags : selectedIngredients;
    const original = Array.from(originalComparisonSetItems).sort().join(',');
    const current = Array.from(currentItems).sort().join(',');
    const itemsChanged = original !== current;
    const logicChanged = comparisonLogic !== originalComparisonSetLogic;
    return itemsChanged || logicChanged;
  }, [selectedSetId, originalComparisonSetItems, selectedTags, selectedIngredients, comparisonMode, comparisonLogic, originalComparisonSetLogic]);

  useEffect(() => {
    if (activeTab === 'analysis' && selectedAnalysisCocktailIds.size > 0) {
      const loadDetails = async () => {
        setAnalysisLoading(true);
        const details = new Map<string, any>();

        const cocktailIds = Array.from(selectedAnalysisCocktailIds);
        for (const cocktailId of cocktailIds) {
          try {
            const startDate = timeRange.startDate.toISOString();
            const endDate = timeRange.endDate.toISOString();
            const url = `/api/workspaces/${workspaceId}/statistics/advanced/cocktails/${cocktailId}?startDate=${startDate}&endDate=${endDate}`;
            const response = await fetch(url);
            if (response.ok) {
              const body = await response.json();
              details.set(cocktailId, body.data);
            }
          } catch (error) {
            console.error('StatisticsAdvancedPage -> loadAnalysisDetails', error);
          }
        }

        setAnalysisCocktailDetails(details);
        setAnalysisLoading(false);
      };

      loadDetails();
    }
  }, [activeTab, selectedAnalysisCocktailIdsString, workspaceId, timeRange.startDate.getTime(), timeRange.endDate.getTime()]);

  useEffect(() => {
    if (activeTab === 'cocktails' && selectedCocktailId) {
      loadCocktailDetail(selectedCocktailId);
    }
  }, [activeTab, selectedCocktailId, loadCocktailDetail]);

  const loadAllCocktails = useCallback(async () => {
    if (!workspaceId) return;

    try {
      setAllCocktailsLoading(true);
      const params = new URLSearchParams({
        startDate: timeRange.startDate.toISOString(),
        endDate: timeRange.endDate.toISOString(),
      });
      const response = await fetch(`/api/workspaces/${workspaceId}/statistics/advanced/cocktails/all?${params}`);
      if (response.ok) {
        const body = await response.json();
        setAllCocktails(body.data);
      } else {
        console.error('StatisticsAdvancedPage -> loadAllCocktails', response);
      }
    } catch (error) {
      console.error('StatisticsAdvancedPage -> loadAllCocktails', error);
    } finally {
      setAllCocktailsLoading(false);
    }
  }, [workspaceId, timeRange.startDate.getTime(), timeRange.endDate.getTime()]);

  useEffect(() => {
    if (activeTab === 'analysis') {
      loadAllCocktails();
    }
  }, [activeTab, loadAllCocktails]);

  const handleTabChange = (newTab: Tab) => {
    setActiveTab(newTab);
  };

  const handleTimeRangeChange = useCallback((range: TimeRange) => {
    setTimeRange(range);
  }, []);

  // Format time range with time for subtitle
  const formatTimeRangeWithTime = useCallback((range: TimeRange): string => {
    const formatDateTime = (date: Date) => {
      return date.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const start = formatDateTime(range.startDate);
    const end = formatDateTime(range.endDate);

    // If same day, show only one date with time range
    if (range.startDate.toDateString() === range.endDate.toDateString()) {
      const startTime = range.startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const endTime = range.endDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      return `${start} (${startTime} - ${endTime})`;
    }

    return `${start} - ${end}`;
  }, []);

  const handleRefresh = () => {
    if (activeTab === 'overview') {
      loadOverviewData();
    } else if (activeTab === 'cocktails') {
      loadCocktailsData();
    } else if (activeTab === 'comparisons') {
      loadCocktailsData(); // For aggregated ingredients calculation
      if (comparisonMode === 'tags') {
        loadTagsData();
        if (selectedTags.size > 0) {
          loadComparisonDetail(selectedTags, 'TAG_SET');
        }
      } else {
        loadIngredientsData();
        if (selectedIngredients.size > 0) {
          loadComparisonDetail(selectedIngredients, 'INGREDIENT_SET');
        }
      }
    } else if (activeTab === 'analysis') {
      if (selectedAnalysisCocktailIds.size > 0) {
        const loadDetails = async () => {
          setAnalysisLoading(true);
          const details = new Map<string, any>();

          const cocktailIds = Array.from(selectedAnalysisCocktailIds);
          for (const cocktailId of cocktailIds) {
            try {
              const startDate = timeRange.startDate.toISOString();
              const endDate = timeRange.endDate.toISOString();
              const url = `/api/workspaces/${workspaceId}/statistics/advanced/cocktails/${cocktailId}?startDate=${startDate}&endDate=${endDate}`;
              const response = await fetch(url);
              if (response.ok) {
                const body = await response.json();
                details.set(cocktailId, body.data);
              }
            } catch (error) {
              console.error('StatisticsAdvancedPage -> loadAnalysisDetails', error);
            }
          }

          setAnalysisCocktailDetails(details);
          setAnalysisLoading(false);
        };
        loadDetails();
      }
    }
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'cocktails', label: 'Zeitraum & Cocktails' },
    { id: 'comparisons', label: 'Vergleiche' },
    { id: 'analysis', label: 'Cocktail-Analyse' },
  ];

  // Convert Chart.js data format to Tremor format
  // Convert to Recharts format: [{ name: 'label1', cocktail1: value1, cocktail2: value2, ... }, ...]
  const convertToRechartsData = useCallback((chartData: ProcessedData | null): Array<Record<string, any>> | null => {
    if (!chartData || chartData.labels.length === 0 || chartData.datasets.length === 0) {
      return null;
    }

    return chartData.labels.map((label) => {
      const dataPoint: Record<string, any> = { name: label };
      chartData.datasets.forEach((dataset) => {
        const labelIndex = chartData.labels.indexOf(label);
        dataPoint[dataset.label] = dataset.data[labelIndex] || 0;
      });
      return dataPoint;
    });
  }, []);

  // Memoize chart data for Tab 2 (Recharts format)
  const groupedChartData = useMemo(() => {
    if (activeTab !== 'cocktails') return null;

    const chartData =
      timeRange.endDate.getTime() - timeRange.startDate.getTime() >= 24 * 3600 * 1000 && groupBy == 'day'
        ? processDataGroupByDaily(cocktailStatisticItems, showAllDays, hiddenCocktailIds, timeRange.startDate, timeRange.endDate, dayStartTime)
        : processDataGroupByHourly(cocktailStatisticItems, hiddenCocktailIds);

    return convertToRechartsData(chartData);
  }, [
    activeTab,
    groupBy,
    timeRange.startDate,
    timeRange.endDate,
    showAllDays,
    hiddenCocktailIds,
    processDataGroupByDaily,
    processDataGroupByHourly,
    cocktailStatisticItems,
    convertToRechartsData,
  ]);

  // Get cocktail names (categories) for Recharts
  const groupedChartCategories = useMemo(() => {
    if (!groupedChartData || groupedChartData.length === 0) return [];
    // Get all categories (cocktail names) from the first data point and sort them
    const firstPoint = groupedChartData[0];
    const categories = Object.keys(firstPoint).filter((key) => key !== 'name');
    // Sort categories to ensure consistent ordering
    return categories.sort();
  }, [groupedChartData]);

  // Generate colors for each cocktail
  const groupedChartColors = useMemo(() => {
    if (activeTab !== 'cocktails' || !groupedChartCategories || groupedChartCategories.length === 0) return new Map<string, string>();

    // Create a map of cocktail name to color
    const colorMap = new Map<string, string>();
    groupedChartCategories.forEach((categoryName) => {
      colorMap.set(categoryName, categoryName.string2color());
    });
    return colorMap;
  }, [activeTab, groupedChartCategories]);

  return (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage`}
      title="Erweiterte Statistik"
      subtitle={formatTimeRangeWithTime(timeRange)}
      actions={
        <div className="flex items-center gap-2">
          <TimeRangePicker value={timeRange} onChange={handleTimeRangeChange} compact dayStartTime={dayStartTime} />
          <button className="btn btn-square btn-primary btn-sm md:btn-md" onClick={handleRefresh} title="Aktualisieren">
            <FaSyncAlt />
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        {/* Tab Navigation - Sticky with offset for header */}
        <div className="sticky top-16 z-10 bg-base-100 py-2">
          <div className="overflow-x-auto">
            <div className="tabs-boxed tabs min-w-max flex-nowrap">
              {tabs.map((tab) => (
                <button key={tab.id} className={`tab flex-shrink-0 ${activeTab === tab.id ? 'tab-active' : ''}`} onClick={() => handleTabChange(tab.id)}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-4">
            {/* Period Tabs */}
            <div className="overflow-x-auto">
              <div className="tabs tabs-bordered min-w-max flex-nowrap">
                <button className={`tab flex-shrink-0 ${overviewPeriodTab === 'today' ? 'tab-active' : ''}`} onClick={() => setOverviewPeriodTab('today')}>
                  Heute
                </button>
                <button className={`tab flex-shrink-0 ${overviewPeriodTab === 'week' ? 'tab-active' : ''}`} onClick={() => setOverviewPeriodTab('week')}>
                  Woche
                </button>
                <button className={`tab flex-shrink-0 ${overviewPeriodTab === 'month' ? 'tab-active' : ''}`} onClick={() => setOverviewPeriodTab('month')}>
                  Monat
                </button>
                <button className={`tab flex-shrink-0 ${overviewPeriodTab === 'period' ? 'tab-active' : ''}`} onClick={() => setOverviewPeriodTab('period')}>
                  Zeitraum
                </button>
                <button className={`tab flex-shrink-0 ${overviewPeriodTab === 'allTime' ? 'tab-active' : ''}`} onClick={() => setOverviewPeriodTab('allTime')}>
                  Allzeit
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            {overviewData ? (
              <div className="stats stats-vertical w-full shadow lg:stats-horizontal">
                {overviewPeriodTab === 'today' && (
                  <>
                    <StatCard
                      title="Anzahl"
                      value={overviewData.kpis.today.total}
                      delta={overviewData.kpis.today.delta}
                      previousValue={overviewData.kpis.today.previousTotal}
                      previousPeriodLabel={overviewData.kpis.today.previousPeriodLabel}
                      loading={loading}
                    />
                    <StatCard
                      title="Top Cocktail"
                      value={overviewData.kpis.today.topCocktail?.name || '-'}
                      desc={overviewData.kpis.today.topCocktail ? `${overviewData.kpis.today.topCocktail.count} Bestellungen` : undefined}
                      loading={loading}
                    />
                    <StatCard
                      title="Umsatz"
                      value={overviewData.kpis.today.revenue}
                      formatValue={(val) => (typeof val === 'number' ? val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : String(val))}
                      loading={loading}
                    />
                  </>
                )}
                {overviewPeriodTab === 'week' && (
                  <>
                    <StatCard
                      title="Anzahl"
                      value={overviewData.kpis.week.total}
                      delta={overviewData.kpis.week.delta}
                      previousValue={overviewData.kpis.week.previousTotal}
                      previousPeriodLabel={overviewData.kpis.week.previousPeriodLabel}
                      loading={loading}
                    />
                    <StatCard
                      title="Top Cocktail"
                      value={overviewData.kpis.week.topCocktail?.name || '-'}
                      desc={overviewData.kpis.week.topCocktail ? `${overviewData.kpis.week.topCocktail.count} Bestellungen` : undefined}
                      loading={loading}
                    />
                    <StatCard
                      title="Umsatz"
                      value={overviewData.kpis.week.revenue}
                      formatValue={(val) => (typeof val === 'number' ? val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : String(val))}
                      loading={loading}
                    />
                  </>
                )}
                {overviewPeriodTab === 'month' && (
                  <>
                    <StatCard
                      title="Anzahl"
                      value={overviewData.kpis.month.total}
                      delta={overviewData.kpis.month.delta}
                      previousValue={overviewData.kpis.month.previousTotal}
                      previousPeriodLabel={overviewData.kpis.month.previousPeriodLabel}
                      loading={loading}
                    />
                    <StatCard
                      title="Top Cocktail"
                      value={overviewData.kpis.month.topCocktail?.name || '-'}
                      desc={overviewData.kpis.month.topCocktail ? `${overviewData.kpis.month.topCocktail.count} Bestellungen` : undefined}
                      loading={loading}
                    />
                    <StatCard
                      title="Umsatz"
                      value={overviewData.kpis.month.revenue}
                      formatValue={(val) => (typeof val === 'number' ? val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : String(val))}
                      loading={loading}
                    />
                  </>
                )}
                {overviewPeriodTab === 'period' && (
                  <>
                    <StatCard title="Anzahl" value={overviewData.kpis.period.total} loading={loading} />
                    <StatCard
                      title="Top Cocktail"
                      value={overviewData.kpis.period.topCocktail?.name || '-'}
                      desc={overviewData.kpis.period.topCocktail ? `${overviewData.kpis.period.topCocktail.count} Bestellungen` : undefined}
                      loading={loading}
                    />
                    <StatCard
                      title="Umsatz"
                      value={overviewData.kpis.period.revenue}
                      formatValue={(val) => (typeof val === 'number' ? val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : String(val))}
                      loading={loading}
                    />
                  </>
                )}
                {overviewPeriodTab === 'allTime' && (
                  <>
                    <StatCard
                      title="Anzahl"
                      value={overviewData.kpis.allTime.total}
                      formatValue={(val) => (typeof val === 'number' ? val.toLocaleString('de-DE') : String(val))}
                      loading={loading}
                    />
                    <StatCard
                      title="Top Cocktail"
                      value={overviewData.kpis.allTime.topCocktail?.name || '-'}
                      desc={overviewData.kpis.allTime.topCocktail ? `${overviewData.kpis.allTime.topCocktail.count} Bestellungen` : undefined}
                      loading={loading}
                    />
                    <StatCard
                      title="Umsatz"
                      value={overviewData.kpis.allTime.revenue}
                      formatValue={(val) => (typeof val === 'number' ? val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : String(val))}
                      loading={loading}
                    />
                  </>
                )}
              </div>
            ) : (
              <div className="stats stats-vertical w-full shadow lg:stats-horizontal">
                <StatCard title="Anzahl" value={0} loading={true} />
                <StatCard title="Top Cocktail" value="-" loading={true} />
                <StatCard title="Umsatz" value={0} loading={true} />
              </div>
            )}

            {overviewData && (
              <>
                {/* Charts */}
                {(() => {
                  // Get chart data based on selected period tab
                  const chartData = overviewData.charts
                    ? overviewData.charts[overviewPeriodTab]
                    : {
                        timeSeries: overviewData.timeSeries,
                        topCocktails: overviewData.topCocktails,
                        hourDistribution: overviewData.hourDistribution,
                      };

                  return (
                    <>
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="card shadow">
                          <div className="card-body">
                            <h3 className="card-title text-lg">Cocktails im Zeitverlauf</h3>
                            {loading ? (
                              <div className="skeleton w-full" style={{ height: '260px' }}></div>
                            ) : chartData.timeSeries.length > 0 ? (
                              <TimeSeriesChart data={chartData.timeSeries} label="Bestellungen" height={260} />
                            ) : (
                              <div className="py-8 text-center text-base-content/70">Keine Cocktails vorhanden</div>
                            )}
                          </div>
                        </div>

                        <div className="card shadow">
                          <div className="card-body">
                            <h3 className="card-title text-lg">Cocktails nach Uhrzeit</h3>
                            {loading ? (
                              <div className="skeleton w-full" style={{ height: '260px' }}></div>
                            ) : chartData.hourDistribution.some((d) => d.count > 0) ? (
                              <DistributionChart
                                data={reorderHourDistribution(chartData.hourDistribution, dayStartTime).map((d) => ({
                                  label: `${d.hour}:00`,
                                  value: d.count,
                                }))}
                                height={260}
                                xLabel="Uhrzeit"
                                yLabel="Anzahl"
                              />
                            ) : (
                              <div className="py-8 text-center text-base-content/70">Keine Cocktails vorhanden</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="card shadow">
                        <div className="card-body">
                          <h3 className="card-title text-lg">Top-Cocktails</h3>
                          {loading ? (
                            <div className="skeleton w-full" style={{ height: '200px' }}></div>
                          ) : chartData.topCocktails.length > 0 ? (
                            <DistributionChart
                              data={chartData.topCocktails.map((c) => ({
                                label: c.name,
                                value: c.count,
                              }))}
                              horizontal
                              height={Math.max(200, chartData.topCocktails.length * 40)}
                              yLabel="Cocktail"
                              xLabel="Anzahl"
                            />
                          ) : (
                            <div className="py-8 text-center text-base-content/70">Keine Cocktails vorhanden</div>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {activeTab === 'cocktails' && (
          <div className="flex flex-col gap-4">
            {cocktailsLoading ? (
              <Loading />
            ) : (
              <ListDetailLayout
                list={
                  <CocktailList
                    items={cocktailsData}
                    selectedId={selectedCocktailId}
                    onSelect={setSelectedCocktailId}
                    hiddenIds={hiddenCocktailIds}
                    onToggleHidden={(id) => {
                      const newHidden = new Set(hiddenCocktailIds);
                      if (newHidden.has(id)) {
                        newHidden.delete(id);
                      } else {
                        newHidden.add(id);
                      }
                      setHiddenCocktailIds(newHidden);
                    }}
                    loading={cocktailsLoading}
                  />
                }
                detail={
                  <div className="flex flex-col gap-4">
                    {/* Calculate KPIs for Info Cards */}
                    {(() => {
                      const visibleItems = cocktailStatisticItems.filter((item) => !hiddenCocktailIds.has(item.cocktailId));
                      const totalCount = visibleItems.length;

                      // Calculate revenue (sum of cocktail prices)
                      const revenue = visibleItems.reduce((sum, item) => {
                        const price = item.cocktail?.price ?? 0;
                        return sum + (price || 0);
                      }, 0);

                      // Find top cocktail
                      const cocktailCounts: Record<string, { count: number; name: string }> = {};
                      visibleItems.forEach((item) => {
                        const id = item.cocktailId;
                        const name = item.cocktail.name;
                        if (!cocktailCounts[id]) {
                          cocktailCounts[id] = { count: 0, name };
                        }
                        cocktailCounts[id].count++;
                      });
                      const topCocktail = Object.values(cocktailCounts).sort((a, b) => b.count - a.count)[0];

                      // Find peak hour
                      const hourCounts: Record<number, number> = {};
                      visibleItems.forEach((item) => {
                        const hour = new Date(item.date).getHours();
                        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
                      });
                      let peakHour = 0;
                      let peakHourCount = 0;
                      Object.entries(hourCounts).forEach(([hour, count]) => {
                        if (count > peakHourCount) {
                          peakHourCount = count;
                          peakHour = parseInt(hour);
                        }
                      });

                      return (
                        <div className="stats stats-vertical w-full shadow lg:stats-horizontal">
                          <StatCard
                            title="Totale Anzahl"
                            value={totalCount}
                            formatValue={(val) => (typeof val === 'number' ? val.toLocaleString('de-DE') : String(val))}
                            loading={cocktailsLoading}
                          />
                          <StatCard
                            title="Umsatz"
                            value={revenue}
                            formatValue={(val) => (typeof val === 'number' ? val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : String(val))}
                            loading={cocktailsLoading}
                          />
                          <StatCard title="Top Cocktail" value={topCocktail ? topCocktail.name : '-'} loading={cocktailsLoading} />
                          <StatCard title="Haupt Uhrzeit" value={peakHourCount > 0 ? `${peakHour} Uhr` : '-'} loading={cocktailsLoading} />
                        </div>
                      );
                    })()}

                    <div className="card bg-base-100 shadow">
                      <div className="card-body">
                        <div className="card-title flex items-center justify-between">
                          <div>Gruppierte Ansicht </div>
                          <div className="flex items-center gap-2">
                            <div className={`form-control ${groupBy != 'day' ? 'hidden' : ''}`}>
                              <label className="label cursor-pointer gap-2">
                                <span className="label-text text-sm">Alle Tage anzeigen</span>
                                <input
                                  disabled={groupBy != 'day'}
                                  className="toggle toggle-primary toggle-sm"
                                  type="checkbox"
                                  checked={showAllDays}
                                  onClick={() => setShowAllDays(!showAllDays)}
                                />
                              </label>
                            </div>
                            <div className="form-control">
                              <select
                                className="select select-bordered select-sm"
                                value={groupBy}
                                onChange={(event) => setGroupBy(event.target.value as 'day' | 'hour')}
                              >
                                <option value="hour">Stunden</option>
                                <option value="day" disabled={timeRange.endDate.getTime() - timeRange.startDate.getTime() < 24 * 3600 * 1000}>
                                  Tagen
                                </option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Chart */}
                        {groupedChartData && groupedChartData.length > 0 && groupedChartCategories.length > 0 ? (
                          <div className="h-[50vh] w-full lg:h-[70vh]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={groupedChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.05)" />
                                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} interval={0} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip
                                  content={({ active, payload }: any) => {
                                    if (!active || !payload || !payload.length) return null;

                                    // Filter out entries with value 0 and sort by value descending
                                    const filteredPayload = payload
                                      .filter((entry: any) => entry.value && entry.value > 0)
                                      .sort((a: any, b: any) => (b.value || 0) - (a.value || 0));

                                    if (filteredPayload.length === 0) return null;

                                    const total = filteredPayload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);
                                    const label = payload[0]?.payload?.name || '';

                                    return (
                                      <div className="rounded-lg border border-base-300 bg-base-100 p-3 shadow-lg">
                                        <p className="mb-2 text-sm font-semibold text-base-content">{label}</p>
                                        <div className="space-y-1">
                                          {filteredPayload.map((entry: any, index: number) => {
                                            const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0';
                                            const entryColor = groupedChartColors.get(entry.dataKey) || '#000';
                                            return (
                                              <div key={index} className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-2">
                                                  <div className="h-3 w-3 rounded" style={{ backgroundColor: entryColor }} />
                                                  <span className="text-sm text-base-content">{entry.dataKey}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-sm font-semibold text-base-content">{entry.value}</span>
                                                  <span className="text-xs text-base-content/70">({percentage}%)</span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        <div className="mt-2 border-t border-base-300 pt-2">
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm font-semibold text-base-content">Gesamt</span>
                                            <span className="text-sm font-semibold text-base-content">{total}</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }}
                                />
                                {groupedChartCategories.map((categoryName) => {
                                  const color = groupedChartColors.get(categoryName) || '#000';
                                  return <Bar key={categoryName} dataKey={categoryName} stackId="a" fill={color} />;
                                })}
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="py-8 text-center text-base-content/70">Keine Cocktails vorhanden</div>
                        )}
                      </div>
                    </div>
                  </div>
                }
              />
            )}
          </div>
        )}

        {activeTab === 'cocktails' && false && (
          <div className="flex flex-col gap-4">
            {cocktailsLoading ? (
              <Loading />
            ) : (
              <ListDetailLayout
                list={
                  <CocktailList
                    items={cocktailsData}
                    selectedId={selectedCocktailId}
                    onSelect={setSelectedCocktailId}
                    hiddenIds={hiddenCocktailIds}
                    onToggleHidden={(id) => {
                      const newHidden = new Set(hiddenCocktailIds);
                      if (newHidden.has(id)) {
                        newHidden.delete(id);
                      } else {
                        newHidden.add(id);
                      }
                      setHiddenCocktailIds(newHidden);
                    }}
                    loading={cocktailsLoading}
                  />
                }
                detail={
                  cocktailDetailLoading ? (
                    <div className="card bg-base-100 shadow">
                      <div className="card-body">
                        <Loading />
                      </div>
                    </div>
                  ) : cocktailDetailData ? (
                    <div className="card bg-base-100 shadow">
                      <div className="card-body">
                        <h3 className="card-title mb-4 text-lg">{cocktailDetailData.cocktail.name} – Detailansicht</h3>

                        <div className="stats stats-vertical w-full shadow lg:stats-horizontal">
                          <StatCard
                            title="Bestellungen"
                            value={cocktailDetailData.total}
                            delta={cocktailDetailData.delta}
                            previousValue={cocktailDetailData.previousTotal}
                            loading={cocktailDetailLoading}
                          />
                          <StatCard
                            title="Ø pro aktiver Stunde"
                            value={cocktailDetailData.avgPerActiveHour.toFixed(1)}
                            desc="/ Std"
                            loading={cocktailDetailLoading}
                          />
                          <StatCard title="Rang" value={`#${cocktailDetailData.rank}`} loading={cocktailDetailLoading} />
                        </div>

                        <div className="mb-4">
                          <h4 className="text-md mb-2 font-semibold">Verteilung über Zeit</h4>
                          {cocktailDetailLoading ? (
                            <div className="skeleton w-full" style={{ height: '200px' }}></div>
                          ) : cocktailDetailData.timeSeries && cocktailDetailData.timeSeries.length > 0 ? (
                            <TimeSeriesChart data={cocktailDetailData.timeSeries} label="Bestellungen" height={200} />
                          ) : (
                            <div className="py-8 text-center text-base-content/70">Keine Cocktails vorhanden</div>
                          )}
                        </div>

                        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <h4 className="text-md mb-2 font-semibold">Verteilung nach Stunde</h4>
                            {cocktailDetailLoading ? (
                              <div className="skeleton w-full" style={{ height: '200px' }}></div>
                            ) : cocktailDetailData.hourDistribution &&
                              cocktailDetailData.hourDistribution.some((d: { hour: number; count: number }) => d.count > 0) ? (
                              <DistributionChart
                                data={reorderHourDistribution(cocktailDetailData.hourDistribution, dayStartTime).map((d) => ({
                                  label: `${d.hour}:00`,
                                  value: d.count || 0,
                                }))}
                                height={200}
                                xLabel="Uhrzeit"
                                yLabel="Anzahl"
                              />
                            ) : (
                              <div className="py-8 text-center text-base-content/70">Keine Cocktails vorhanden</div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-md mb-2 font-semibold">Verteilung nach Wochentag</h4>
                            {cocktailDetailLoading ? (
                              <div className="skeleton w-full" style={{ height: '200px' }}></div>
                            ) : cocktailDetailData.dayDistribution &&
                              cocktailDetailData.dayDistribution.some((d: { day: number; count: number }) => d.count > 0) ? (
                              <DistributionChart
                                data={reorderDaysMondayFirst(cocktailDetailData.dayDistribution).map((d: { day: number; count?: number }) => {
                                  const displayIndex = DAY_ORDER_MONDAY_FIRST.indexOf(d.day as any);
                                  return {
                                    label: DAY_NAMES_SHORT_MONDAY_FIRST[displayIndex] || '',
                                    value: d.count || 0,
                                  };
                                })}
                                height={200}
                                xLabel="Wochentag"
                                yLabel="Anzahl"
                              />
                            ) : (
                              <div className="py-8 text-center text-base-content/70">Keine Cocktails vorhanden</div>
                            )}
                          </div>
                        </div>

                        {cocktailDetailData.cocktail.tags && cocktailDetailData.cocktail.tags.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-md mb-2 font-semibold">Tags</h4>
                            <div className="flex flex-wrap gap-2">
                              {cocktailDetailData.cocktail.tags.map((tag: string) => (
                                <span key={tag} className="badge badge-primary">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {cocktailDetailData.ingredients && cocktailDetailData.ingredients.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-md mb-2 font-semibold">Zutaten</h4>
                            <div className="flex flex-wrap gap-2">
                              {cocktailDetailData.ingredients.map((ingredient: string) => (
                                <span key={ingredient} className="badge badge-secondary">
                                  {ingredient}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="divider">Gespeicherte Sets</div>
                        <SavedSetSelector
                          workspaceId={workspaceId as string}
                          type="COCKTAIL_SET"
                          selectedSetId={selectedCocktailDetailSetId}
                          onSelect={setSelectedCocktailDetailSetId}
                        />

                        {selectedCocktailDetailSetId && cocktailDetailSetLoading ? (
                          <div className="mt-4">
                            <Loading />
                          </div>
                        ) : selectedCocktailDetailSetId && cocktailDetailSetData ? (
                          <div className="mt-4">
                            <h4 className="text-md mb-2 font-semibold">{cocktailDetailSetData.set.name}</h4>
                            <div className="stats stats-vertical w-full shadow lg:stats-horizontal">
                              <StatCard title="Bestellungen" value={cocktailDetailSetData.kpis.total} loading={cocktailDetailSetLoading} />
                              <StatCard title="Cocktails" value={cocktailDetailSetData.kpis.cocktailCount} loading={cocktailDetailSetLoading} />
                              <StatCard title="Anteil" value={`${cocktailDetailSetData.kpis.percentage.toFixed(1)}%`} loading={cocktailDetailSetLoading} />
                            </div>
                            <div className="mb-4">
                              <h5 className="mb-2 text-sm font-semibold">Cocktails im Set</h5>
                              {cocktailDetailSetData.cocktails && cocktailDetailSetData.cocktails.length > 0 ? (
                                <DistributionChart
                                  data={cocktailDetailSetData.cocktails.map((c: { name: string; count: number }) => ({
                                    label: c.name,
                                    value: c.count,
                                  }))}
                                  horizontal
                                  height={Math.max(200, cocktailDetailSetData.cocktails.length * 40)}
                                  yLabel="Cocktail"
                                  xLabel="Anzahl"
                                />
                              ) : (
                                <div className="py-8 text-center text-base-content/70">Keine Cocktails vorhanden</div>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="card bg-base-100 shadow">
                      <div className="card-body">
                        <div className="text-center text-base-content/70">Bitte wählen Sie einen Cocktail aus</div>
                      </div>
                    </div>
                  )
                }
              />
            )}
          </div>
        )}

        {activeTab === 'comparisons' && (
          <div className="flex flex-col gap-4">
            <ListDetailLayout
              list={
                <div className="w-full space-y-4">
                  {/* Saved Sets - Shows both TAG_SET and INGREDIENT_SET */}
                  <SavedSetSelector
                    workspaceId={workspaceId as string}
                    showAllTypes={true}
                    selectedSetId={selectedSetId}
                    refreshKey={savedSetsRefreshKey}
                    onSelect={async (setIdValue, setType) => {
                      setSelectedSetId(setIdValue);

                      if (setIdValue) {
                        // Ensure data is loaded first
                        if (setType === 'TAG_SET' && tagsData.length === 0) {
                          await loadTagsData();
                        } else if (setType === 'INGREDIENT_SET' && ingredientsData.length === 0) {
                          await loadIngredientsData();
                        }

                        // Load set and select items in the list
                        try {
                          const setResponse = await fetch(`/api/workspaces/${workspaceId}/statistics/advanced/sets/${setIdValue}`);
                          const data = await setResponse.json();
                          if (data.data && data.data.set) {
                            const items = data.data.set.items as string[];
                            const logic = data.data.set.logic as 'AND' | 'OR' | null;

                            // Switch to the correct mode based on set type
                            if (setType === 'TAG_SET') {
                              setComparisonMode('tags');
                              setSelectedTags(new Set(items));
                              setSelectedIngredients(new Set());
                            } else if (setType === 'INGREDIENT_SET') {
                              setComparisonMode('ingredients');
                              setSelectedIngredients(new Set(items));
                              setSelectedTags(new Set());
                            }

                            // Set logic if present
                            const setLogic = logic || 'AND';
                            setComparisonLogic(setLogic);

                            // Track original items and logic for change detection
                            setOriginalComparisonSetItems(new Set(items));
                            setOriginalComparisonSetLogic(setLogic);
                          }
                        } catch (error) {
                          console.error('StatisticsAdvancedPage -> loadSet', error);
                        }
                      } else {
                        // Clear selection when deselecting set
                        setSelectedTags(new Set());
                        setSelectedIngredients(new Set());
                        setOriginalComparisonSetItems(new Set());
                        setOriginalComparisonSetLogic('AND');
                      }
                    }}
                  />

                  <div className="divider">Ergebnisse im Zeitraum</div>

                  {/* Mode Selector */}
                  <div className="flex w-full flex-col gap-2">
                    {/* Tags / Zutaten - full width, equal size */}
                    <div className="join w-full">
                      <button
                        className={`btn join-item btn-sm flex-1 ${comparisonMode === 'tags' ? 'btn-primary' : ''}`}
                        onClick={() => setComparisonMode('tags')}
                        disabled={!!selectedSetId}
                      >
                        Tags
                      </button>
                      <button
                        className={`btn join-item btn-sm flex-1 ${comparisonMode === 'ingredients' ? 'btn-primary' : ''}`}
                        onClick={() => setComparisonMode('ingredients')}
                        disabled={!!selectedSetId}
                      >
                        Zutaten
                      </button>
                    </div>

                    {/* AND/OR and Save - shown when items are selected */}
                    {((comparisonMode === 'tags' && selectedTags.size > 0) || (comparisonMode === 'ingredients' && selectedIngredients.size > 0)) && (
                      <div className="flex w-full flex-col gap-2">
                        <div className="flex gap-2">
                          <div className="join">
                            <button
                              className={`btn join-item btn-sm ${comparisonLogic === 'AND' ? 'btn-secondary' : ''}`}
                              onClick={() => setComparisonLogic('AND')}
                            >
                              AND
                            </button>
                            <button
                              className={`btn join-item btn-sm ${comparisonLogic === 'OR' ? 'btn-secondary' : ''}`}
                              onClick={() => setComparisonLogic('OR')}
                            >
                              OR
                            </button>
                          </div>
                          {/* Reset and Update buttons - only when set is selected AND changed */}
                          {selectedSetId && hasComparisonSetChanges && (
                            <>
                              <button className="btn btn-warning btn-sm" onClick={handleResetComparisonSet}>
                                Zurücksetzen
                              </button>
                              <button className="btn btn-primary btn-sm flex-1" onClick={handleUpdateComparisonSet}>
                                Aktualisieren
                              </button>
                            </>
                          )}
                        </div>
                        {/* Save as new set button */}
                        <button className="btn btn-secondary btn-sm w-full" onClick={handleSaveSet}>
                          {selectedSetId ? 'Als neues Set speichern' : 'Set speichern'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Tag or Ingredient List */}
                  {comparisonMode === 'tags' ? (
                    <TagList
                      items={tagsData}
                      selectedIds={selectedTags}
                      onToggleSelect={(tag) => {
                        const newSelected = new Set(selectedTags);
                        if (newSelected.has(tag)) {
                          newSelected.delete(tag);
                        } else {
                          newSelected.add(tag);
                        }
                        setSelectedTags(newSelected);
                        // Keep set selected, changes will be detected via hasComparisonSetChanges
                      }}
                      onClear={() => {
                        setSelectedTags(new Set());
                        if (selectedSetId) {
                          setSelectedSetId(undefined);
                          setOriginalComparisonSetItems(new Set());
                          setOriginalComparisonSetLogic('AND');
                        }
                      }}
                      loading={comparisonsLoading}
                    />
                  ) : (
                    <IngredientList
                      items={ingredientsData}
                      selectedIds={selectedIngredients}
                      onToggleSelect={(ingredient) => {
                        const newSelected = new Set(selectedIngredients);
                        if (newSelected.has(ingredient)) {
                          newSelected.delete(ingredient);
                        } else {
                          newSelected.add(ingredient);
                        }
                        setSelectedIngredients(newSelected);
                        // Keep set selected, changes will be detected via hasComparisonSetChanges
                      }}
                      onClear={() => {
                        setSelectedIngredients(new Set());
                        if (selectedSetId) {
                          setSelectedSetId(undefined);
                          setOriginalComparisonSetItems(new Set());
                          setOriginalComparisonSetLogic('AND');
                        }
                      }}
                      loading={comparisonsLoading}
                    />
                  )}
                </div>
              }
              detail={
                setDetailLoading ? (
                  <div className="card bg-base-100 shadow">
                    <div className="card-body">
                      <Loading />
                    </div>
                  </div>
                ) : setDetailData ? (
                  <div className="flex flex-col gap-4">
                    {/* Header outside cards */}
                    <h3 className="text-xl font-bold">{setDetailData.set.name}</h3>

                    {/* Stats Card */}
                    <div className="stats stats-vertical w-full shadow lg:stats-horizontal">
                      <StatCard
                        title="Cocktails"
                        value={setDetailData.cocktails ? setDetailData.cocktails.filter((c: { count: number }) => c.count > 0).length : 0}
                        desc={setDetailData.kpis.cocktailCount ? `von ${setDetailData.kpis.cocktailCount} mit dieser Kombination` : undefined}
                        loading={setDetailLoading}
                      />
                      <StatCard
                        title="Bestellungen"
                        value={setDetailData.kpis.total}
                        desc={setDetailData.kpis.totalStats ? `von ${setDetailData.kpis.totalStats.toLocaleString('de-DE')} im Zeitraum` : undefined}
                        loading={setDetailLoading}
                      />
                      <StatCard
                        title="Anteil"
                        value={setDetailData.kpis.cocktailPercentageAll !== undefined ? `${setDetailData.kpis.cocktailPercentageAll.toFixed(1)}%` : '-'}
                        desc={
                          setDetailData.kpis.cocktailCount && setDetailData.kpis.totalCocktailsInWorkspace
                            ? `${setDetailData.kpis.cocktailCount} von ${setDetailData.kpis.totalCocktailsInWorkspace} allen Cocktails`
                            : undefined
                        }
                        loading={setDetailLoading}
                      />
                      <StatCard
                        title="Umsatz"
                        value={setDetailData.kpis.revenue !== undefined ? setDetailData.kpis.revenue : 0}
                        formatValue={(val) => (typeof val === 'number' ? val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : String(val))}
                        desc={
                          setDetailData.kpis.totalRevenue !== undefined && setDetailData.kpis.totalRevenue > 0
                            ? `${((setDetailData.kpis.revenue || 0) / setDetailData.kpis.totalRevenue * 100).toFixed(1)}% vom Gesamtumsatz`
                            : undefined
                        }
                        loading={setDetailLoading}
                      />
                    </div>

                    {/* Cocktails Card */}
                    <div className="card shadow">
                      <div className="card-body">
                        <h4 className="card-title text-lg">Cocktails</h4>
                        {setDetailData.cocktails && setDetailData.cocktails.length > 0 ? (
                          <DistributionChart
                            data={setDetailData.cocktails
                              .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))
                              .map((c: { name: string; count: number }) => ({
                                label: c.name,
                                value: c.count,
                              }))}
                            horizontal
                            height={Math.max(200, setDetailData.cocktails.length * 40)}
                            yLabel="Cocktail"
                            xLabel="Anzahl"
                          />
                        ) : (
                          <div className="py-8 text-center text-base-content/70">Keine Cocktails vorhanden</div>
                        )}
                      </div>
                    </div>

                    {/* Aggregated Ingredients Card - Only for TAG_SETs */}
                    {setDetailData.set.type === 'TAG_SET' && (
                      <div className="card shadow">
                        <div className="card-body">
                          <h4 className="card-title text-lg">Zutaten (aggregiert)</h4>
                          {cocktailsLoading ? (
                            <Loading />
                          ) : aggregatedIngredientsData.length === 0 ? (
                            <div className="py-4 text-center text-base-content/70">Keine Zutaten im Zeitraum</div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="table-compact table w-full">
                                <thead>
                                  <tr>
                                    <th>Zutat</th>
                                    <th>Ausgabe-Einheit</th>
                                    <th className="text-right">Menge</th>
                                    <th className="text-right">Kosten</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {aggregatedIngredientsData.map((ingredient) => {
                                    const selectedUnit = selectedOutputUnits[ingredient.ingredientId];
                                    const calculated = calculateAggregatedAmount(ingredient, selectedUnit);
                                    const cost = calculateIngredientCost(ingredient);

                                    return (
                                      <tr key={ingredient.ingredientId}>
                                        <td className="font-medium">{ingredient.ingredientName}</td>
                                        <td>
                                          {ingredient.availableUnits.length > 0 ? (
                                            <select
                                              className="select select-bordered select-sm"
                                              value={selectedUnit || ''}
                                              onChange={(e) => {
                                                setSelectedOutputUnits((prev) => ({
                                                  ...prev,
                                                  [ingredient.ingredientId]: e.target.value,
                                                }));
                                              }}
                                            >
                                              {ingredient.availableUnits.map((unit) => (
                                                <option key={unit.unitId} value={unit.unitId}>
                                                  {userContext.getTranslation(unit.unitName, 'de')}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            <span className="text-base-content/50">-</span>
                                          )}
                                        </td>
                                        <td className="text-right">
                                          {calculated.amount.toLocaleString('de-DE', {
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 2,
                                          })}{' '}
                                          {userContext.getTranslation(calculated.unitName, 'de')}
                                        </td>
                                        <td className="text-right">
                                          {cost.toLocaleString('de-DE', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}{' '}
                                          €
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr className="font-bold">
                                    <td colSpan={3} className="text-right">
                                      Gesamt:
                                    </td>
                                    <td className="text-right">
                                      {aggregatedIngredientsData
                                        .reduce((sum, ing) => sum + calculateIngredientCost(ing), 0)
                                        .toLocaleString('de-DE', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}{' '}
                                      €
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="card bg-base-100 shadow">
                    <div className="card-body">
                      <div className="text-center text-base-content/70">Bitte wählen Sie ein Set aus</div>
                    </div>
                  </div>
                )
              }
            />
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="flex flex-col gap-4">
            <ListDetailLayout
              list={
                <div className="w-full space-y-4">
                  {/* Saved Sets */}
                  <SavedSetSelector
                    workspaceId={workspaceId as string}
                    type={SavedSetType.COCKTAIL_SET}
                    selectedSetId={selectedAnalysisSetId}
                    refreshKey={analysisSetsRefreshKey}
                    onSelect={async (setId) => {
                      setSelectedAnalysisSetId(setId);
                      if (setId) {
                        // Ensure allCocktails is loaded first
                        if (allCocktails.length === 0) {
                          await loadAllCocktails();
                        }
                        // Load set and select cocktails in the list
                        try {
                          const setResponse = await fetch(`/api/workspaces/${workspaceId}/statistics/advanced/sets/${setId}`);
                          const data = await setResponse.json();
                          if (data.data && data.data.set) {
                            const items = data.data.set.items as string[];
                            setSelectedAnalysisCocktailIds(new Set(items));
                            setOriginalAnalysisSetItems(new Set(items));
                          }
                        } catch (error) {
                          console.error('StatisticsAdvancedPage -> loadSet', error);
                        }
                      } else {
                        // Clear selection when deselecting set
                        setSelectedAnalysisCocktailIds(new Set());
                        setOriginalAnalysisSetItems(new Set());
                      }
                    }}
                  />

                  <div className="divider">Cocktails auswählen</div>

                  {/* Set Action Buttons - shown when items are selected */}
                  {selectedAnalysisCocktailIds.size > 0 && (
                    <div className="flex w-full flex-col gap-2">
                      <div className="flex gap-2">
                        {/* Reset and Update buttons - only when set is selected AND changed */}
                        {selectedAnalysisSetId && hasAnalysisSetChanges && (
                          <>
                            <button className="btn btn-warning btn-sm" onClick={handleResetAnalysisSet}>
                              Zurücksetzen
                            </button>
                            <button className="btn btn-primary btn-sm flex-1" onClick={handleUpdateAnalysisSet}>
                              Aktualisieren
                            </button>
                          </>
                        )}
                      </div>
                      {/* Save as new set button */}
                      <button className="btn btn-secondary btn-sm w-full" onClick={handleSaveAnalysisSet}>
                        {selectedAnalysisSetId ? 'Als neues Set speichern' : 'Set speichern'}
                      </button>
                    </div>
                  )}

                  {/* Cocktail Selector */}
                  <AnalysisCocktailSelector
                    items={allCocktails}
                    selectedIds={selectedAnalysisCocktailIds}
                    loading={allCocktailsLoading}
                    onToggleSelect={(cocktailId) => {
                      const newSelected = new Set(selectedAnalysisCocktailIds);
                      if (newSelected.has(cocktailId)) {
                        newSelected.delete(cocktailId);
                      } else {
                        newSelected.add(cocktailId);
                      }
                      setSelectedAnalysisCocktailIds(newSelected);
                      // Keep set selected, changes will be detected via hasAnalysisSetChanges
                    }}
                    onClear={() => {
                      setSelectedAnalysisCocktailIds(new Set());
                      if (selectedAnalysisSetId) {
                        setSelectedAnalysisSetId(undefined);
                        setOriginalAnalysisSetItems(new Set());
                      }
                    }}
                  />
                </div>
              }
              detail={
                selectedAnalysisCocktailIds.size > 0 ? (
                  <div className="space-y-4">
                    {analysisLoading ? (
                      <div className="card bg-base-100 shadow">
                        <div className="card-body">
                          <Loading />
                        </div>
                      </div>
                    ) : analysisCocktailDetails.size > 0 ? (
                      <>
                        {/* Overview Card */}
                        <div className="card shadow">
                          <div className="card-body">
                            <h3 className="card-title text-lg">Übersicht</h3>
                            {(() => {
                              // Calculate previous period for comparison
                              const periodLength = timeRange.endDate.getTime() - timeRange.startDate.getTime();
                              const previousEnd = new Date(timeRange.startDate);
                              previousEnd.setTime(previousEnd.getTime() - 1);
                              const previousStart = new Date(previousEnd);
                              previousStart.setTime(previousStart.getTime() - periodLength);

                              // Calculate number of days
                              const daysDiff = Math.ceil(periodLength / (1000 * 60 * 60 * 24));
                              const daysText = daysDiff === 1 ? '1 Tag' : `${daysDiff} Tage`;

                              // Format previous period for description
                              const formatDateTime = (date: Date) => {
                                return date.toLocaleString('de-DE', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                });
                              };

                              const comparisonPeriodText = `Vergleichszeitraum: ${formatDateTime(previousStart)} - ${formatDateTime(previousEnd)} (${daysText})`;

                              const totalRevenue = Array.from(selectedAnalysisCocktailIds).reduce((sum, id) => {
                                const detail = analysisCocktailDetails.get(id);
                                return sum + (detail?.revenue || 0);
                              }, 0);

                              const previousTotalRevenue = Array.from(selectedAnalysisCocktailIds).reduce((sum, id) => {
                                const detail = analysisCocktailDetails.get(id);
                                return sum + (detail?.previousRevenue || 0);
                              }, 0);

                              const cocktails = Array.from(selectedAnalysisCocktailIds)
                                .map((id) => {
                                  const cocktail = allCocktails.find((c) => c.id === id);
                                  return cocktail ? { id: cocktail.id, name: cocktail.name } : null;
                                })
                                .filter((c): c is { id: string; name: string } => c !== null);

                              return (
                                <>
                                  <p className="mb-4 text-sm text-base-content/70">{comparisonPeriodText}</p>
                                  <AnalysisCocktailTable
                                    cocktails={cocktails}
                                    details={analysisCocktailDetails}
                                    totalRevenue={totalRevenue}
                                    previousTotalRevenue={previousTotalRevenue}
                                    workspaceId={workspaceId as string}
                                    startDate={timeRange.startDate}
                                    endDate={timeRange.endDate}
                                  />
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Time Series Card */}
                        <div className="card shadow">
                          <div className="card-body">
                            <h3 className="card-title text-lg">Zeitverlauf</h3>
                            {(() => {
                              const datasets = Array.from(selectedAnalysisCocktailIds)
                                .map((id) => {
                                  const detail = analysisCocktailDetails.get(id);
                                  const cocktail = allCocktails.find((c) => c.id === id);
                                  if (!detail || !cocktail || !detail.timeSeries || detail.timeSeries.length === 0) return null;
                                  return {
                                    label: cocktail.name,
                                    data: detail.timeSeries,
                                    color: cocktail.name.string2color(),
                                  };
                                })
                                .filter((ds): ds is { label: string; data: Array<{ date: string; count: number }>; color: string } => ds !== null);

                              if (datasets.length > 0) {
                                return <TimeSeriesChart datasets={datasets} height={300} />;
                              }
                              return <div className="py-8 text-center text-base-content/70">Keine Daten vorhanden</div>;
                            })()}
                          </div>
                        </div>

                        {/* Distribution Cards */}
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="card shadow">
                            <div className="card-body">
                              <h4 className="card-title text-lg">Verteilung nach Stunde</h4>
                              {(() => {
                                const orderedHourLabels = getOrderedHourLabels(dayStartTime);
                                const datasets = Array.from(selectedAnalysisCocktailIds)
                                  .map((id) => {
                                    const detail = analysisCocktailDetails.get(id);
                                    const cocktail = allCocktails.find((c) => c.id === id);
                                    if (!detail || !cocktail || !detail.hourDistribution) return null;

                                    const reordered = reorderHourDistribution(detail.hourDistribution, dayStartTime);
                                    const data = reordered.map((d) => d.count || 0);

                                    const hasData = data.some((v) => v > 0);
                                    if (!hasData) return null;

                                    return {
                                      label: cocktail.name,
                                      data,
                                      color: cocktail.name.string2color(),
                                    };
                                  })
                                  .filter((ds): ds is { label: string; data: number[]; color: string } => ds !== null);

                                if (datasets.length > 0) {
                                  return (
                                    <StackedDistributionChart labels={orderedHourLabels} datasets={datasets} height={300} xLabel="Uhrzeit" yLabel="Anzahl" />
                                  );
                                }
                                return <div className="py-8 text-center text-base-content/70">Keine Daten vorhanden</div>;
                              })()}
                            </div>
                          </div>
                          <div className="card shadow">
                            <div className="card-body">
                              <h4 className="card-title text-lg">Verteilung nach Wochentag</h4>
                              {(() => {
                                const labels = Array.from(DAY_NAMES_SHORT_MONDAY_FIRST);

                                const datasets = Array.from(selectedAnalysisCocktailIds)
                                  .map((id) => {
                                    const detail = analysisCocktailDetails.get(id);
                                    const cocktail = allCocktails.find((c) => c.id === id);
                                    if (!detail || !cocktail || !detail.dayDistribution) return null;

                                    // Reorder data: start with Monday (day 1), end with Sunday (day 0)
                                    const reordered = reorderDaysMondayFirst(detail.dayDistribution);
                                    const data = reordered.map((d: { day: number; count?: number }) => d.count || 0);

                                    const hasData = data.some((v) => v > 0);
                                    if (!hasData) return null;

                                    return {
                                      label: cocktail.name,
                                      data,
                                      color: cocktail.name.string2color(),
                                    };
                                  })
                                  .filter((ds): ds is { label: string; data: number[]; color: string } => ds !== null);

                                if (datasets.length > 0) {
                                  return <StackedDistributionChart labels={labels} datasets={datasets} height={300} xLabel="Wochentag" yLabel="Anzahl" />;
                                }
                                return <div className="py-8 text-center text-base-content/70">Keine Daten vorhanden</div>;
                              })()}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="card bg-base-100 shadow">
                        <div className="card-body">
                          <div className="text-center text-base-content/70">Lade Daten...</div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="card bg-base-100 shadow">
                    <div className="card-body">
                      <div className="text-center text-base-content/70">Bitte wählen Sie Cocktails aus oder laden Sie ein Set</div>
                    </div>
                  </div>
                )
              }
            />
          </div>
        )}
      </div>
    </ManageEntityLayout>
  );
};

export default StatisticsAdvancedPage;
