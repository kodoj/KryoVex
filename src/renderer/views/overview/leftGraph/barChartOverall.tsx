import { Bar } from '@uconn-its/react-chartjs-2-react19-temp';
import Chart from 'chart.js/auto';
import { ItemRow } from 'renderer/interfaces/items.ts';
import { searchFilter } from 'renderer/functionsClasses/filters/search.ts';
import { Prices, Settings } from 'renderer/interfaces/states.tsx';
import {
  ConvertPrices,
  ConvertPricesFormatted,
} from 'renderer/functionsClasses/prices.ts';
import { selectSettings } from '@/store/slices/settings.ts';
import { useSelector } from 'react-redux';
import { selectPricing } from '@/store/slices/pricing.ts';
import { selectInventory } from '@/store/slices/inventory.ts';
import { selectInventoryFilters } from '@/store/slices/inventoryFilters.ts';
Chart;

function runArray(
  arrayToRun: Array<ItemRow>,
  objectToUse: any,
  by: string,
  PricingConverter
) {
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

function getObject(
  arrayToRun: Array<ItemRow>,
  objectToUse: any,
  by: string,
  PricingConverter
) {
  arrayToRun = arrayToRun.filter((itemRow) => itemRow.item_moveable);

  arrayToRun.forEach((element) => {
    if (objectToUse[element.item_name] == undefined) {
      switch (by) {
        case 'price':
          objectToUse[element.item_name] =
            PricingConverter.getPrice(element, true) * element.combined_QTY;
          break;
        case 'volume':
          objectToUse[element.item_name] = element.combined_QTY;
          break;
        default:
          break;
      }
    } else {
      switch (by) {
        case 'price':
          objectToUse[element.item_name] =
            objectToUse[element.item_name] +
            PricingConverter.getPrice(element, true) * element.combined_QTY;
          break;
        case 'volume':
          objectToUse[element.item_name] =
            objectToUse[element.item_name] + element.combined_QTY;
          break;
        default:
          break;
      }
    }
  });
  return objectToUse;
}

export default function OverallVolume() {
  // Go through inventory and find matching categories

  const settingsData: Settings = useSelector(selectSettings);
  const pricingData: Prices = useSelector(selectPricing);
  const inventory = useSelector(selectInventory);
  const inventoryFilters = useSelector(selectInventoryFilters);
  const PricingConverter = new ConvertPrices(settingsData, pricingData);

  // Convert inventory to chart data

  let seenNamesOverall: any = {};
  let seenNamesInventory: any = {};
  let seenNamesStorage: any = {};

  let inventoryFiltered = searchFilter(
    inventory.combinedInventory,
    inventoryFilters,
    undefined
  );

  let storageFiltered = searchFilter(
    inventory.storageInventory,
    inventoryFilters,
    undefined
  );

  let overallData = runArray(
    [...inventoryFiltered, ...storageFiltered],
    seenNamesOverall,
    settingsData.overview.by,
    PricingConverter
  );
  let inventoryData = getObject(
    inventoryFiltered,
    seenNamesInventory,
    settingsData.overview.by,
    PricingConverter
  );
  let storageData = getObject(
    storageFiltered,
    seenNamesStorage,
    settingsData.overview.by,
    PricingConverter
  );
  const converter = new ConvertPricesFormatted(settingsData, pricingData)


  const title = (tooltipItems) => {
    if (settingsData.overview.by == 'price') {
      return tooltipItems.dataset.label + ': ' + converter.formatPrice(tooltipItems.raw);
    }
    return tooltipItems.dataset.label + ': ' + tooltipItems.raw;
  };

  const topOverall = overallData.slice(0, 20);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      // Extra bottom room so every slanted x label fits (autoSkip off draws all 20).
      padding: { left: 0, right: 4, top: 2, bottom: 16 },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: title,
        },
      },
      legend: {
        align: 'start' as const,
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
        text: 'Overall',
        color: '#d6d3cd',
        align: 'start' as const,
        padding: { top: 0, bottom: 4 },
        font: { size: 13, weight: 600 },
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          color: '#d6d3cd',
          maxRotation: 40,
          minRotation: 40,
          /** Chart.js was hiding every other label; show all bars’ labels */
          autoSkip: false,
          font: { size: 8 },
          padding: 4,
        },
      },
      y: {
        stacked: true,
        ticks: {
          beginAtZero: true,
          padding: 2,
          font: { size: 10 },
          color: '#9ca3af',
          callback: function (value) {
            if (value % 1 === 0) {
              return value;
            }
          },
        },
      },
    },
  };

  const data = {
    labels: topOverall.map((itemRow) => itemRow[0]?.slice(0, 40)),

    datasets: [
      {
        label: 'Inventory',
        data: topOverall.map((itemRow) => inventoryData[itemRow[0]]),
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
      },
      {
        label: 'Storage Units',
        data: topOverall.map((itemRow) => storageData[itemRow[0]]),
        backgroundColor: 'rgb(50, 91, 136, 0.2)',
        borderColor: 'rgb(50, 91, 136, 1)',
        borderWidth: 1,
      },
    ],
  };
  return (
    <div className="relative h-full min-h-[min(300px,40vh)] w-full flex-1">
      {/* @ts-ignore chart options */}
      <Bar data={data} options={options} />
    </div>
  );
}
