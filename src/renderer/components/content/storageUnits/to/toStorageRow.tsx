import { BoltIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { useDispatch, useSelector } from 'react-redux';
import { RequestPrices } from 'renderer/functionsClasses/prices.ts';
import { moveToTotalToAdd, selectMoveTo } from 'renderer/store/slices/moveTo.ts';
import { RowCollections } from '../../Inventory/inventoryRows/collectionsRow.tsx';
import { RowFloat } from '../../Inventory/inventoryRows/floatRow.tsx';
import { RowPrice } from '../../Inventory/inventoryRows/priceRow.tsx';
import { RowQTY } from '../../Inventory/inventoryRows/QTYRow.tsx';
import { RowRarity } from '../../Inventory/inventoryRows/rarityRow.tsx';
import { RowProduct } from '../../Inventory/inventoryRows/rowName.tsx';
import { RowStickersPatches } from '../../Inventory/inventoryRows/stickerPatchesRow.tsx';
import { RowTradehold } from '../../Inventory/inventoryRows/tradeholdRow.tsx';
import { classNames } from '../../shared/filters/inventoryFunctions.ts';
import { selectPricing } from 'renderer/store/slices/pricing.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';

function content({ projectRow, index }: {projectRow: any, index: number}) {
  const dispatch = useDispatch();
  const toReducer = useSelector(selectMoveTo);
  const pricesResult = useSelector(selectPricing);
  const settingsData = useSelector(selectSettings);

  const moveRowsSafe = Array.isArray(toReducer.totalToMove) ? toReducer.totalToMove : [];
  const matchRow = moveRowsSafe.find((row) => row[0] == projectRow.item_id);
  const moveQty = Array.isArray(matchRow?.[2]) ? matchRow[2].length : 0;
  const isEmpty = moveQty === 0;
  const totalFieldValue = moveQty;

  async function returnField(fieldValue) {
    if (toReducer.activeStorages.length == 0) {
      return;
    }
    fieldValue = parseInt(fieldValue);
    let totalToGo = 1000 - toReducer.activeStoragesAmount;
    const moveRows = Array.isArray(toReducer.totalToMove) ? toReducer.totalToMove : [];
    for (const value of moveRows) {
      const valued = value as any;
      if (valued[0] != projectRow.item_id) {
        totalToGo -= Array.isArray(valued[2]) ? valued[2].length : 0;
      }
    }

    let returnValue = 0;
    let totalMax = projectRow.combined_QTY;
    if (projectRow.combined_QTY > totalToGo) {
      totalMax = totalToGo;
    }
    if (fieldValue > totalMax) {
      returnValue = totalMax;
    } else if (fieldValue < 0) {
      returnValue = 0;
    } else {
      if (isNaN(fieldValue)) {
        returnValue = 0;
      } else {
        returnValue = fieldValue;
      }
    }

    let listToReturn = [] as any;
    if (returnValue > 0) {
      const ids = Array.isArray(projectRow.combined_ids) ? projectRow.combined_ids : [];
      listToReturn = ids.slice(0, returnValue);
    }

    const destCasket = toReducer.activeStorages[0];
    if (!destCasket) return;

    dispatch(
      moveToTotalToAdd({
        itemID: projectRow.item_id,
        casketID: destCasket,
        toMove: listToReturn,
        itemName: projectRow.item_name,
      })
    );
  }

  const PricingClass = new RequestPrices(dispatch, settingsData, pricesResult);
  PricingClass.handleRequested(projectRow);

  return (
    <>
      <RowProduct itemRow={projectRow} />
      <RowCollections itemRow={projectRow} settingsData={settingsData}/>
      <RowPrice itemRow={projectRow} settingsData={settingsData} pricesReducer={pricesResult}/>
      <RowStickersPatches itemRow={projectRow} settingsData={settingsData}/>
      <RowFloat itemRow={projectRow} settingsData={settingsData} />
      <RowRarity itemRow={projectRow} settingsData={settingsData}/>
      <RowTradehold itemRow={projectRow} settingsData={settingsData}/>
      <RowQTY itemRow={projectRow}/>
      <td className="table-cell px-1 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hover:text-gray-200 text-right align-middle">
        <div className="flex justify-center">
          <input
            type="text"
            name="postal-code"
            id="postal-code"
            autoComplete="off"
            value={isEmpty ? '' : String(moveQty)}
            placeholder="0"
            onChange={(e) => returnField(e.target.value)}
            className="block w-16 border rounded sm:text-sm text-gray-500 text-center border-gray-400 dark:bg-dark-level-two dark:text-dark-white"
          />
        </div>
      </td>
      <td className="table-cell px-1 py-3 text-sm text-gray-500 dark:text-gray-400 font-medium align-middle">
        <div className="flex flex-row items-center justify-center gap-0.5">
          <button
            type="button"
            onClick={() => returnField(1000)}
            id={`fire-${index}`}
            className={classNames(
              'p-0 m-0 border-0 bg-transparent shadow-none rounded-none inline-flex items-center justify-center',
              (1000 -
                toReducer.activeStoragesAmount -
                toReducer.totalItemsToMove ===
                0 || totalFieldValue === projectRow.combined_QTY) &&
                'pointer-events-none hidden'
            )}
          >
            <BoltIcon
              className={classNames(isEmpty ? "h-5 w-5" : 'h-4 w-4', "text-gray-400 dark:text-gray-500 hover:text-yellow-400 dark:hover:text-yellow-400")}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            onClick={() => returnField(0)}
            id={`removeX-${index}`}
            className={classNames(
              'p-0 m-0 border-0 bg-transparent shadow-none rounded-none inline-flex items-center justify-center',
              isEmpty ? 'pointer-events-none hidden' : 'removeXButton'
            )}
          >
            <XMarkIcon
              className={classNames(1000 -
                toReducer.activeStoragesAmount -
                toReducer.totalItemsToMove ==
                0 || totalFieldValue == projectRow.combined_QTY ? "h-5 w-5" : 'h-4 w-4', "text-gray-400 dark:text-gray-500 hover:text-red-400 dark:hover:text-red-400  ")}
              aria-hidden="true"
            />
          </button>
        </div>
      </td>
    </>
  );
}
export default function StorageRow(projects) {
  return content(projects);
}
