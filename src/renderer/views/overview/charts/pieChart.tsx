import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  LinearScale,
} from 'chart.js';
import { Pie } from '@uconn-its/react-chartjs-2-react19-temp';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { ConvertPricesFormatted } from 'renderer/functionsClasses/prices.ts';
import { useSelector } from 'react-redux';
import { selectSettings } from 'renderer/store/slices/settings.ts';
import { selectPricing } from 'renderer/store/slices/pricing.ts';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LinearScale,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

export default function PieChart({ data, headerName }) {
  let settingsData = useSelector(selectSettings);
  let pricingData = useSelector(selectPricing);
  const converter = new ConvertPricesFormatted(settingsData, pricingData);

  const title = (tooltipItems) => {
    let percentageData: Array<number> = [];
    let sum = 0;

    tooltipItems.dataset.data.forEach((element) => {
      sum += element;
    });
    tooltipItems.dataset.data.forEach((element) => {
      let percentage = (element * 100) / sum;
      percentageData.push(percentage);
    });
    if (settingsData.overview.by == 'price') {
      return (
        tooltipItems.label + ': ' + converter.formatPrice(tooltipItems.raw) + ' - ' + percentageData[tooltipItems.dataIndex].toFixed(2) + '%'
      );
    }
    return tooltipItems.label + ': ' + tooltipItems.raw  + ' - ' + percentageData[tooltipItems.dataIndex].toFixed(2) + '%'
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 4, right: 2, bottom: 2, left: 2 },
    },
    /** Let the pie use most of the card; legend below avoids a tiny disc + tall empty strip. */
    radius: '92%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        align: 'center' as const,
        labels: {
          color: '#d6d3cd',
          boxWidth: 10,
          boxHeight: 10,
          padding: 6,
          font: { size: 10 },
          usePointStyle: true,
          pointStyle: 'rectRounded' as const,
        },
      },
      title: {
        display: true,
        text: headerName,
        color: '#d6d3cd',
        align: 'start' as const,
        padding: { top: 0, bottom: 8 },
        font: { size: 13, weight: 600 },
      },
      tooltip: {
        callbacks: {
          label: title,
        },
      },
      datalabels: {
        formatter: (value, ctx) => {
          let sum = 0;
          let dataArr = ctx.chart.data.datasets[0].data;
          dataArr.map((data) => {
            sum += data;
          });
          let percentage = ((value * 100) / sum).toFixed(2) + '%';
          return percentage;
        },
        color: '#fff',
        display: function (context) {
          let percentageData: Array<number> = [];
          let sum = 0;

          context.dataset.data.forEach((element) => {
            sum += element;
          });
          context.dataset.data.forEach((element) => {
            let percentage = (element * 100) / sum;
            percentageData.push(percentage);
          });

          if (percentageData[context.dataIndex] > 4) {
            return true;
          }
          if (percentageData[context.dataIndex] > 2) {
            return 'auto';
          }
          return false;

        },
      },
    },
  };

  return (
    <div className="flex h-full min-h-[280px] w-full min-w-0 flex-col">
      <div className="relative min-h-[200px] flex-1 w-full min-w-0">
        <Pie
          data={data}
          // @ts-ignore plugin options
          plugins={[ChartDataLabels]}
          // @ts-ignore
          options={options}
        />
      </div>
    </div>
  );
}
