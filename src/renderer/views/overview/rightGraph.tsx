import { useSelector } from "react-redux";
import EmptyField from "./EmptyField.tsx";
import ItemDistributionByVolume from "./categoryDistribution/categoryDistribution.tsx";
import { selectSettings } from "@/store/slices/settings.ts";

export default function RightGraph() {
    let settingsData = useSelector(selectSettings);

    void settingsData.overview.by;
    let right = settingsData.overview.chartRight

    let returnObject = {
        itemDistribution: ItemDistributionByVolume
    }

    let Fitting = returnObject[right]
    if (Fitting == undefined) {
        Fitting = EmptyField
      }
    
    return (
      <div className="flex h-full min-h-[min(360px,42vh)] min-w-0 flex-col lg:min-h-[min(400px,48vh)]">
        <Fitting />
      </div>
    );
  }
  