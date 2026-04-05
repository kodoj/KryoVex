import { Bar } from '@uconn-its/react-chartjs-2-react19-temp';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import Chart from 'chart.js/auto';
import { ItemRow } from 'renderer/interfaces/items.ts';
import { searchFilter } from 'renderer/functionsClasses/filters/search.ts';
import { Inventory, InventoryFilters, Prices, Settings } from 'renderer/interfaces/states.tsx';
import { ConvertPrices } from 'renderer/functionsClasses/prices.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';
import { selectPricing } from 'renderer/store/slices/pricing.ts';
import { selectInventory } from 'renderer/store/slices/inventory.ts';
import { selectInventoryFilters } from 'renderer/store/slices/inventoryFilters.ts';
Chart;

function runArray(arrayToRun: Array<ItemRow>, objectToUse: any, by: string, PricingConverter) {
  objectToUse = getObject(arrayToRun, objectToUse, by, PricingConverter);
  var items = Object.keys(objectToUse).map(function (key) {
    return [key, objectToUse[key]];
  });

  // Sort the array based on the second element
  items.sort(function (first, second) {
    return second[1] - first[1];
  });
  return items;
}

function getObject(arrayToRun: Array<ItemRow>, objectToUse: any, by: string, PricingConverter) {
  arrayToRun = arrayToRun.filter((itemRow) => itemRow.item_moveable);

  arrayToRun.forEach((element) => {
    const key = PricingConverter._getName(element);
    if (objectToUse[key] == undefined) {
      switch (by) {
        case 'price':

          objectToUse[key] = PricingConverter.getPrice(element, true) * element.combined_QTY;
          break;
        case 'volume':

          objectToUse[key] = element.combined_QTY;
          break;
        default:
          break;
      }
    } else {
      switch (by) {
        case 'price':

          objectToUse[key] =
            objectToUse[key] + PricingConverter.getPrice(element, true) * element.combined_QTY;
          break;
        case 'volume':

          objectToUse[key] = objectToUse[key] + element.combined_QTY;
          break;
        default:
          break;
      }
    }
  });
  return objectToUse;
}

export default function OverallMajor() {
  // Bar options
  // @ts-ignore
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { left: 0, right: 4, top: 0, bottom: 12 },
    },
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'end' as const,
        labels: {
          color: '#d6d3cd',
          boxWidth: 10,
          padding: 6,
          font: { size: 10 },
        },
        textDirection: 'ltr',
      },
      title: {
        display: true,
        text: 'Major',
        color: '#d6d3cd',
        align: 'start' as const,
        padding: { top: 0, bottom: 2 },
        font: { size: 13, weight: 600 },
      },
    },
    scales: {
      x: {
        stacked: true,
        type: 'category' as const,
        ticks: {
          color: '#d6d3cd',
          maxRotation: 45,
          minRotation: 45,
          autoSkip: false,
          font: { size: 9 },
          padding: 2,
          callback: function (tickValue: string | number, index: number) {
            const labels = (this as { chart?: { data?: { labels?: unknown[] } } }).chart?.data
              ?.labels;
            const raw = Array.isArray(labels) ? labels[index] : tickValue;
            const s = String(raw ?? '');
            return s.length > 28 ? `${s.slice(0, 26)}…` : s;
          },
        },
      },
      y: {
        ticks: {
          beginAtZero: true,
          padding: 4,
          font: { size: 10 },
          callback: function (value) {
            if (value % 1 === 0) {
              return value;
            }
          },
        },
      },
    },
  };

  // Go through inventory and find matching categories
  const settingsdata: Settings = useSelector(selectSettings);
  const pricingData: Prices = useSelector(selectPricing);
  const inventory: Inventory = useSelector(selectInventory);
  const inventoryFilters: InventoryFilters = useSelector(selectInventoryFilters);
  
  const PricingConverter = useMemo(
    () => new ConvertPrices(settingsdata, pricingData),
    [settingsdata, pricingData]
  );

  // Convert inventory to chart data
  let seenNamesOverall: any = {};
  let seenNamesInventory: any = {};
  let seenNamesStorage: any = {};
  let inventoryFiltered: Array<ItemRow> = searchFilter(inventory.combinedInventory, inventoryFilters, undefined)
  let storageFiltered: Array<ItemRow> = searchFilter(inventory.storageInventory, inventoryFilters, undefined)

  let overallData = runArray(
    [...inventoryFiltered, ...storageFiltered],
    seenNamesOverall,
    settingsdata.overview.by,
    PricingConverter
  );
  let inventoryData = getObject(
    inventoryFiltered,
    seenNamesInventory,
    settingsdata.overview.by,
    PricingConverter
  );
  let storageData = getObject(storageFiltered, seenNamesStorage, settingsdata.overview.by, PricingConverter);

  const topOverall = overallData.slice(0, 20);
  const data = {
    labels: topOverall.map((itemRow) => itemRow[0] ?? ''),
    datasets: [
      {
        label: 'Inventory',
        data: topOverall.map((itemRow) => inventoryData[itemRow[0]] ?? 0),
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
      },
      {
        label: 'Storage Units',
        data: topOverall.map((itemRow) => storageData[itemRow[0]] ?? 0),
        backgroundColor: 'rgb(50, 91, 136, 0.2)',
        borderColor: 'rgb(50, 91, 136, 1)',
        borderWidth: 1,
      },
    ],
  };
  return (
    <div className="relative w-full h-[min(460px,58vh)] min-h-[400px]">
      <Bar data={data} options={options} />
    </div>
  );
}
