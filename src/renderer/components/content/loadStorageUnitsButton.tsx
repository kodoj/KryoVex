import { RectangleStackIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getAllStorages } from "renderer/functionsClasses/storageUnits/storageUnitsFunctions.tsx";
import { LoadingButton } from "./shared/animations.tsx";
import { btnPrimary } from "./shared/buttonStyles.ts";
import { classNames } from "./shared/filters/inventoryFunctions.ts";
import { selectInventory } from "renderer/store/slices/inventory.ts";
import { selectInventoryFilters } from "renderer/store/slices/inventoryFilters.ts";
import { selectMoveFrom } from "renderer/store/slices/moveFrom.ts";
import { selectSettings } from "renderer/store/slices/settings.ts";
import { selectPricing } from "renderer/store/slices/pricing.ts";

export function LoadButton() {
    const [getLoadingButton, setLoadingButton] = useState(false);
    const dispatch = useDispatch();
    const moveFrom = useSelector(selectMoveFrom);
    const inventory = useSelector(selectInventory);
    const settings = useSelector(selectSettings);
    const pricing = useSelector(selectPricing);
    const inventoryFilters = useSelector(selectInventoryFilters);

    // Get all storage unit data
    async function getAllStor() {
        if (getLoadingButton) return; // Prevent double clicks
        setLoadingButton(true);
        try {
            await getAllStorages(dispatch, {
                inventory,
                moveFrom,
                settings,
                pricing,
                inventoryFilters,
            } as any);
        } finally {
            setLoadingButton(false);
        }
    }
    const hasLoadedStorages = moveFrom.activeStorages.length > 0;

    const staticLabel = hasLoadedStorages
        ? `${moveFrom.activeStorages.length} Storage units loaded`
        : "Load storage units";

    return (
        <>
            <button
                type="button"
                onClick={() => getAllStor()}
                disabled={getLoadingButton}
                className={classNames(btnPrimary, 'px-4 py-2 tabular-nums')}
            >
                {' '}
                {getLoadingButton ? (
                    <LoadingButton
                        className="shrink-0 mr-1.5 h-5 w-5 text-kryo-ice-100"
                        aria-hidden="true"
                    />
                ) : (
                    <RectangleStackIcon
                        className="shrink-0 mr-1.5 h-5 w-5 text-kryo-ice-100"
                        aria-hidden="true"
                    />
                )}
                <span className="whitespace-nowrap">{staticLabel}</span>
            </button>
        </>
    );
}
