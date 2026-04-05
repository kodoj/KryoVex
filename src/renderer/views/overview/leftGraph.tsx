import { useSelector } from "react-redux";
import EmptyField from "./EmptyField.tsx";
import OverallVolume from "./leftGraph/barChartOverall.tsx";
import { selectSettings } from "@/store/slices/settings.ts";

export default function LeftGraph() {
    let settingsData = useSelector(selectSettings);

    let by = settingsData.overview.by
    let left = settingsData.overview.chartleft

    let returnObject = {
        overall: {
            volume: OverallVolume,
            price: OverallVolume
        }
    }

    let Fitting = returnObject[left][by]
    if (Fitting == undefined) {
      Fitting = EmptyField
    }
      
    return (
      <div className="flex h-full min-h-[min(360px,42vh)] min-w-0 flex-1 flex-col lg:min-h-[min(400px,48vh)]">
        <Fitting />
      </div>
    );
  }
  