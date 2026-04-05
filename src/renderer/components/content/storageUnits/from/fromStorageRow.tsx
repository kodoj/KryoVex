import { BoltIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { useDispatch, useSelector } from 'react-redux';
import { moveFromAddRemove, selectMoveFrom } from 'renderer/store/slices/moveFrom.ts';
import { RowPrice } from '../../Inventory/inventoryRows/priceRow.tsx';
import { RowStickersPatches } from '../../Inventory/inventoryRows/stickerPatchesRow.tsx';
import { RowStorage } from '../../Inventory/inventoryRows/storageRow.tsx';
import { RowRarity } from '../../Inventory/inventoryRows/rarityRow.tsx';
import { classNames } from '../../shared/filters/inventoryFunctions.ts';
import { RowFloat } from '../../Inventory/inventoryRows/floatRow.tsx';
import { RowTradehold } from '../../Inventory/inventoryRows/tradeholdRow.tsx';
import { RowQTY } from '../../Inventory/inventoryRows/QTYRow.tsx';
import { RowCollections } from '../../Inventory/inventoryRows/collectionsRow.tsx';
import { RowProduct } from '../../Inventory/inventoryRows/rowName.tsx';
import { selectInventory } from 'renderer/store/slices/inventory.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';
import { selectPricing } from 'renderer/store/slices/pricing.ts';

function content({ projectRow, index }) {
  const dispatch = useDispatch();
  const fromReducer = useSelector(selectMoveFrom)
  const inventory = useSelector(selectInventory)
  const settings = useSelector(selectSettings)
  const pricing = useSelector(selectPricing)

  async function returnField(fieldValue) {
    fieldValue = parseInt(fieldValue);
    let totalToGo = 1000 - inventory.inventory.length;
    const moveRows = Array.isArray(fromReducer.totalToMove) ? fromReducer.totalToMove : [];
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

    dispatch(
      moveFromAddRemove(
        {
         casketID: projectRow.storage_id,
          itemID: projectRow.item_id,
          toMove: listToReturn,
          itemName: projectRow.item_name
        }
      )
    );
  }
  
  const isEmpty =
    fromReducer.totalToMove.filter((row) => row[0] == projectRow.item_id)
      .length == 0;

  let totalFieldValue = 0;
  if (isEmpty == false) {
    const row = fromReducer.totalToMove.filter((r) => r[0] == projectRow.item_id)[0];
    totalFieldValue = Array.isArray(row?.[2]) ? row[2].length : 0;
  }

  return (
    <>

      <RowProduct itemRow={projectRow} />
      <RowCollections itemRow={projectRow} settingsData={settings}/>
      <RowPrice itemRow={projectRow} settingsData={settings} pricesReducer={pricing} />
      <RowStickersPatches itemRow={projectRow} settingsData={settings} />
      <RowFloat itemRow={projectRow} settingsData={settings}/>
      <RowRarity itemRow={projectRow} settingsData={settings} />
      <RowStorage itemRow={projectRow} settingsData={settings} />
      <RowTradehold itemRow={projectRow} settingsData={settings}/>
      <RowQTY itemRow={projectRow}/>

      <td className="table-cell px-1 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hover:text-gray-200 text-right align-middle">
        <div className="flex justify-center">
          <input
            type="text"
            name="postal-code"
            id="postal-code"
            autoComplete="off"
            value={isEmpty ? '' : totalFieldValue}
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
              1000 -
                inventory.inventory.length -
                fromReducer.totalItemsToMove ===
                0 || totalFieldValue === projectRow.combined_QTY
                ? 'pointer-events-none hidden'
                : ''
            )}
          >
            <BoltIcon
              className={classNames(
                isEmpty ? 'h-5 w-5' : 'h-4 w-4',
                'text-gray-400 dark:text-gray-500 hover:text-yellow-400 dark:hover:text-yellow-400'
              )}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            onClick={() => returnField(0)}
            className={classNames(
              'p-0 m-0 border-0 bg-transparent shadow-none rounded-none inline-flex items-center justify-center',
              isEmpty ? 'pointer-events-none hidden' : 'removeXButton'
            )}
            id={`removeX-${index}`}
          >
            <XMarkIcon
              className={classNames(
                1000 -
                  inventory.inventory.length -
                  fromReducer.totalItemsToMove ==
                  0 || totalFieldValue == projectRow.combined_QTY
                  ? 'h-5 w-5'
                  : 'h-4 w-4',
                'text-gray-400 dark:text-gray-500 hover:text-red-400 dark:hover:text-red-400  '
              )}
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
