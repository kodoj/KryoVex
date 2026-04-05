
import { Bar } from '@uconn-its/react-chartjs-2-react19-temp';
import { useSelector } from 'react-redux';
import {itemSubCategories} from 'renderer/components/content/shared/categories.tsx';
import Chart from 'chart.js/auto';
import { selectInventory } from 'renderer/store/slices/inventory.ts';
Chart
export default function BarAppMajor() {

  // Bar options
  const options = {
    plugins: {
      legend: {
        labels: {
          color: '#d6d3cd',
        },
      },
      title: {
          display: true,
          text: 'Majors',
          color: '#d6d3cd'
      }
  }
  };

  // Go through inventory and find matching categories
  const inventory = useSelector(selectInventory);

  // Convert inventory to chart data
  let inventoryDataToUse: Array<number> = [];
  let storageUnitDataToUse: Array<number> = [];

  Object.keys(itemSubCategories.majors).forEach(category => {
    const inventoryResult = inventory.combinedInventory.filter(itemRow => itemRow.major == category);
    const storageResult = inventory.storageInventory.filter(itemRow => itemRow.major == category);
    let categoryCounter = 0
    inventoryResult.forEach(element => {
      categoryCounter = categoryCounter + element.combined_QTY
    });
    let storageCounter = 0
    storageResult.forEach(element => {
      storageCounter = storageCounter + element.combined_QTY
    });

    inventoryDataToUse.push(categoryCounter)
    storageUnitDataToUse.push(storageCounter)
  });
  const data = {
    labels: Object.keys(itemSubCategories.majors),
    datasets: [
      {
        label: 'Inventory',
        data: inventoryDataToUse,
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
      },
      {
        label: 'Storage Units',
        data: storageUnitDataToUse,
        backgroundColor: 'rgb(50, 91, 136, 0.2)',
        borderColor: 'rgb(50, 91, 136, 1)',
        borderWidth: 1,
      },
    ],
  };
  return (
    <>
      <Bar data={data} options={options} />
    </>
  );
}
