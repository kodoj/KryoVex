import { BeakerIcon, PencilIcon, TagIcon } from '@heroicons/react/24/solid';
import { SortIndicator } from 'renderer/components/content/shared/SortIndicator.tsx';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  btnDefault,
  btnIcon,
  focusRingBtn,
} from 'renderer/components/content/shared/buttonStyles.ts';
import { classNames, sortDataFunction } from 'renderer/components/content/shared/filters/inventoryFunctions.ts';
import itemRarities from 'renderer/components/content/shared/rarities.tsx';
import { selectTradeUp, tradeUpAddRemove } from 'renderer/store/slices/tradeUp.ts';
import { createCSGOImage } from '../../functionsClasses/createCSGOImage.ts';
import { Inventory, InventoryFilters, ItemRow, Prices, Settings, TradeUpActions } from 'renderer/interfaces/states.tsx';
import { selectInventory } from 'renderer/store/slices/inventory.ts';
import { selectInventoryFilters, setSort } from 'renderer/store/slices/inventoryFilters.ts';
import { pricingAddToRequested, selectPricing } from 'renderer/store/slices/pricing.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';
import { setRenameModal } from 'renderer/store/slices/modalRename.ts';
import { pricingInventoryKey } from 'renderer/functionsClasses/prices.ts';


const overviewSortBtn = classNames(
  focusRingBtn,
  'text-gray-500 dark:text-gray-400 tracking-wider uppercase text-center text-xs font-medium rounded-sm'
);

function content() {
  const [stickerHover, setStickerHover] = useState('');
  const [itemHover, setItemHover] = useState('');
  const [sortedRows, setSortedRows] = useState<any[]>([]);
  const inventory: Inventory = useSelector(selectInventory);
  const inventoryFilters: InventoryFilters = useSelector(selectInventoryFilters)
  const pricesResult: Prices = useSelector(selectPricing);
  const settingsData: Settings = useSelector(selectSettings);
  const tradeUpData: TradeUpActions = useSelector(selectTradeUp);

  const dispatch = useDispatch();



  // Convert to dict for easier match
    let finalList = {};
    inventory.inventory.forEach(element => {
      if (finalList[element.item_name] == undefined) {
        finalList[element.item_name] = [element]
      }
      else {
        let listToUse = finalList[element.item_name];
        listToUse.push(element)
        finalList[element.item_name] = listToUse
      }
    });

    // Inventory to use
    let finalInventoryToUse = [] as any;
    let seenNames = [] as string[];
    inventoryFilters.inventoryFiltered.forEach((projectRow) => {
      if (finalList[projectRow.item_name] != undefined && seenNames.includes(projectRow.item_name) == false) {
        finalInventoryToUse = [...finalInventoryToUse, ...finalList[projectRow.item_name]]
        seenNames.push(projectRow.item_name)
      }
    })

    finalInventoryToUse = finalInventoryToUse.filter(function (item) {
    if (!item.tradeUpConfirmed) {
      return false;
    }
    if (tradeUpData.MinFloat > item.item_paint_wear || tradeUpData.MaxFloat < item.item_paint_wear) {
      return false;
    }
    if (tradeUpData.tradeUpProductsIDS.includes(item.item_id)) {
      return false;
    }
    if (tradeUpData.collections.length > 0 && !tradeUpData.collections.includes(item?.collection)) {
      return false;
    }
    if (tradeUpData.options.includes('Hide equipped')) {
      if (item.equipped_t || item.equipped_ct) {
        return false;
      }
    }
    if (tradeUpData.tradeUpProducts.length != 0) {
      let restrictRarity = tradeUpData.tradeUpProducts[0].rarityName
      let restrictStattrak = tradeUpData.tradeUpProducts[0].stattrak
      if (item.rarityName != restrictRarity) {
        return false
      }
      if (item.stattrak != restrictStattrak) {
        return false
      }
    }

    if (item.tradeUp) {
      return true;
    }
    return false;
  });

  let itemR = {}
  itemRarities.forEach(element => {
    itemR[element.value] = element.bgColorClass
  });
  finalInventoryToUse.forEach(element => {
    element['rarityColor'] =itemR[element.rarityName]
  });

  useEffect(() => {
    const pricesToGet: ItemRow[] = [];
    for (const projectRow of finalInventoryToUse as ItemRow[]) {
      const key = pricingInventoryKey(projectRow);
      const pd = pricesResult.prices[key];
      const hasAny = !!pd && (pd.steam_listing ?? 0) > 0;
      if (hasAny) continue;
      if (pricesResult.productsRequested.includes(key)) continue;
      pricesToGet.push(projectRow);
    }
    if (pricesToGet.length === 0) return;
    window.electron.ipcRenderer.getPrice(pricesToGet);
    dispatch(pricingAddToRequested({ itemRows: pricesToGet }));
  }, [finalInventoryToUse, pricesResult.prices, pricesResult.productsRequested, dispatch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Keep this picker consistent with the main inventory table sorting.
      const result = await sortDataFunction(
        inventoryFilters.sortValue,
        finalInventoryToUse as any,
        pricesResult.prices,
        settingsData?.source?.title
      );
      if (!cancelled) setSortedRows(result as any[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [finalInventoryToUse, inventoryFilters.sortValue, pricesResult.prices, settingsData?.source?.title]);

  const rowsToRender = useMemo(() => {
    const base = [...(sortedRows ?? [])];
    if (inventoryFilters.sortBack) base.reverse();
    return base;
  }, [sortedRows, inventoryFilters.sortBack]);

  const isFull = tradeUpData.tradeUpProducts.length == 10

  return (
    <>
      <div data-table-scroll className="overflow-x-auto w-full min-w-0">
      <table className="min-w-full w-full">
        <thead>
          <tr
            className={classNames(
              settingsData.os == 'win32' ? 'top-0' : 'top-0',
              'border-gray-200 sticky'
            )}
          >
            <th className="table-cell px-6 py-1 border-b border-gray-200 bg-gray-50 dark:border-opacity-50 dark:bg-dark-level-two text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <button
                type="button"
                onClick={() => dispatch(setSort({ sortValue: 'Product name' }))}
                className={overviewSortBtn}
              >
                <span className="flex justify-between items-center gap-2">
                  Product
                  <SortIndicator
                    active={inventoryFilters.sortValue === 'Product name'}
                    ascending={!inventoryFilters.sortBack}
                    className="h-3 w-3 shrink-0 opacity-80"
                  />
                </span>
              </button>
            </th>
            <th className="hidden xl:table-cell px-6 py-1 border-b border-gray-200 pointer-events-auto bg-gray-50 text-center dark:border-opacity-50 dark:bg-dark-level-two">
              <button
                type="button"
                onClick={() => dispatch(setSort({ sortValue: 'Collection' }))}
                className={overviewSortBtn}
              >
                <span className="flex justify-between items-center gap-2">
                  Collection
                  <SortIndicator
                    active={inventoryFilters.sortValue === 'Collection'}
                    ascending={!inventoryFilters.sortBack}
                    className="h-3 w-3 shrink-0 opacity-80"
                  />
                </span>
              </button>
            </th>

            <th className="hidden xl:table-cell px-6 py-1 border-b border-gray-200 pointer-events-auto bg-gray-50 text-center dark:border-opacity-50 dark:bg-dark-level-two">
              <button
                type="button"
                onClick={() => dispatch(setSort({ sortValue: 'Price' }))}
                className={overviewSortBtn}
              >
                <span className="flex justify-between items-center gap-2">
                  Price
                  <SortIndicator
                    active={inventoryFilters.sortValue === 'Price'}
                    ascending={!inventoryFilters.sortBack}
                    className="h-3 w-3 shrink-0 opacity-80"
                  />
                </span>
              </button>
            </th>

            <th className="hidden 2xl:table-cell px-6 py-1 border-b bg-gray-50 border-gray-200 dark:border-opacity-50 dark:bg-dark-level-two">
              <button
                type="button"
                onClick={() => dispatch(setSort({ sortValue: 'Stickers' }))}
                className={overviewSortBtn}
              >
                <span className="flex justify-between items-center gap-2">
                  Stickers/Patches
                  <SortIndicator
                    active={inventoryFilters.sortValue === 'Stickers'}
                    ascending={!inventoryFilters.sortBack}
                    className="h-3 w-3 shrink-0 opacity-80"
                  />
                </span>
              </button>
            </th>

            <th className="hidden lg:table-cell px-6 py-1 border-b bg-gray-50 border-gray-200 dark:border-opacity-50 dark:bg-dark-level-two">
              <button
                type="button"
                onClick={() => dispatch(setSort({ sortValue: 'wearValue' }))}
                className={overviewSortBtn}
              >
                <span className="flex justify-between items-center gap-2">
                  Float
                  <SortIndicator
                    active={inventoryFilters.sortValue === 'wearValue'}
                    ascending={!inventoryFilters.sortBack}
                    className="h-3 w-3 shrink-0 opacity-80"
                  />
                </span>
              </button>
            </th>
            <th className="hidden lg:table-cell px-6 py-1 border-b bg-gray-50 border-gray-200 dark:border-opacity-50 dark:bg-dark-level-two">
              <span className="text-gray-500 dark:text-gray-400 tracking-wider uppercase text-center text-xs font-medium">
                Move
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100 dark:bg-dark-level-one dark:divide-gray-500">
          {rowsToRender.map((projectRow) => (
            <tr
              key={projectRow.item_id}
              className={classNames(
                projectRow.item_name
                  ?.toLowerCase()
                  .includes(
                    tradeUpData.searchInput?.toLowerCase().trim()
                  ) ||
                  projectRow.item_customname
                    ?.toLowerCase()
                    .includes(
                      tradeUpData.searchInput?.toLowerCase().trim()
                    ) ||
                  projectRow.item_wear_name
                    ?.toLowerCase()
                    .includes(
                      tradeUpData.searchInput?.toLowerCase().trim()
                    ) ||
                    tradeUpData.searchInput == undefined
                  ? ''
                  : 'hidden',
                  inventoryFilters.rarityFilter.length != 0
                  ? inventoryFilters.rarityFilter?.includes(
                      projectRow.rarityColor
                    )
                    ? ''
                    : 'hidden'
                  : '',
                'hover:shadow-inner'
              )}
              >
              <td className="px-6 py-1 max-w-0 w-full whitespace-nowrap overflow-hidden text-sm font-normal text-gray-900">
                <div className="flex items-center space-x-3 lg:pl-2">
                  <div
                    className={classNames(
                      projectRow.rarityColor,
                      'shrink-0 w-2.5 h-2.5 rounded-full'
                    )}
                    aria-hidden="true"
                    />
                  <div className="flex shrink-0">
                    {projectRow.item_moveable != true ? (
                      <img
                        className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-transparent bg-linear-to-t from-gray-100 to-gray-300 transition duration-500 ease-in-out dark:from-gray-300 dark:to-gray-400"
                        src={createCSGOImage(projectRow.item_url)}
                        alt=""
                        title={projectRow.item_name}
                      />
                    ) : (
                      <Link
                        to={{
                          pathname: `https://steamcommunity.com/market/listings/730/${
                            projectRow.item_paint_wear == undefined
                              ? projectRow.item_name
                              : projectRow.item_name +
                                ' (' +
                                projectRow.item_wear_name +
                                ')'
                          }`,
                        }}
                        target="_blank"
                        title="View on Steam Community Market"
                      >
                        <img
                          onMouseEnter={() => setItemHover(projectRow.item_id)}
                          onMouseLeave={() => setItemHover('')}
                          className={classNames(
                            itemHover == projectRow.item_id
                              ? 'ring-2 ring-amber-400/80'
                              : 'ring-2 ring-transparent',
                            'h-12 w-12 shrink-0 rounded-full object-cover transition duration-500 ease-in-out bg-linear-to-t from-gray-100 to-gray-300 dark:from-gray-300 dark:to-gray-400'
                          )}
                          src={createCSGOImage(projectRow.item_url)}
                          alt=""
                        />
                      </Link>
                    )}
                  </div>
                  <span>
                    <span className="flex dark:text-dark-white">
                      {projectRow.item_name !== '' ? (
                        projectRow.item_customname !== null ? (
                          projectRow.item_customname
                        ) : (
                          projectRow.item_name
                        )
                        ) : (
                        <span>
                          <a
                            href="https://forms.gle/6qZ8N2ES8CdeavcVA"
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-kryo-ice-400 hover:text-kryo-ice-300"
                            >
                            An error occurred. Please report this here.
                          </a>
                          <br />
                          <button
                            type="button"
                            className={classNames(btnDefault, 'px-2.5 py-1.5 text-xs')}
                            onClick={() =>
                              navigator.clipboard.writeText(
                                JSON.stringify(projectRow)
                              )
                            }
                            >
                            {' '}
                            COPY REF
                          </button>
                        </span>
                      )}
                      {projectRow.item_name !== '' &&
                      projectRow.item_customname !== null &&
                      !projectRow.item_url.includes('casket') ? (
                        <TagIcon className="h-3 w-3  ml-1" />
                      ) : (
                        ''
                      )}
                      {projectRow.equipped_t ? (
                        <span className='ml-1 h-3 leading-3 pl-1 pr-1 text-white  dark:text-dark-white text-center font-medium	 bg-dark-level-four rounded-full   text-xs'> T </span>
                      ) : (
                        ''
                      )}
                      {projectRow.equipped_ct ? (
                        <span className='ml-1 h-3 leading-3 pl-1 pr-1 text-center  text-white dark:text-dark-white font-medium	 bg-dark-level-four rounded-full   text-xs'> CT </span>
                      ) : (
                        ''
                      )}

                      {projectRow.item_url.includes('casket') ? (
                        <Link
                          to=""
                          className="text-gray-500"
                          onClick={() =>
                            dispatch(
                              setRenameModal(
                                {
                                  itemID: projectRow.item_id,
                                  itemName: projectRow.item_customname !== null
                                  ? projectRow.item_customname
                                  : projectRow.item_name
                                }
                              )
                            )
                          }
                          >
                          <PencilIcon className="h-4 w-5 pb-1" />
                        </Link>
                      ) : (
                        ''
                      )}
                    </span>
                    <span
                      className="text-gray-500 "
                      title={projectRow.item_paint_wear}
                      >
                      {projectRow.item_customname !== null
                        ? projectRow.item_storage_total !== undefined
                          ? projectRow.item_name +
                            ' (' +
                            projectRow.item_storage_total +
                            ')'
                          : projectRow.item_name
                        : ''}

                      {projectRow.item_customname !== null &&
                      projectRow.item_paint_wear !== undefined
                        ? ' - '
                        : ''}

                      {projectRow.item_paint_wear !== undefined
                        ? projectRow.item_wear_name
                        : ''}
                      {/*
                      {isShown == project.item_id  && project.item_paint_wear !== undefined?
                        <div>{project.item_paint_wear}</div>
                       : ''} */}
                    </span>
                  </span>
                </div>
              </td>
              <td className="hidden xl:table-cell px-6 py-1 max-w-0 w-full whitespace-nowrap overflow-hidden text-sm font-normal text-gray-900">
                <div className="flex items-center">
                  <span>
                    <span className="flex dark:text-dark-white">
                      {projectRow.collection.replace('The ', '').replace(' Collection', '')}
                    </span>
                  </span>
                </div>
              </td>

              {settingsData.columns.includes('Price') ? (
                <td className="hidden xl:table-cell px-6 py-1 text-sm text-gray-500 font-medium">
                  <div className="flex items-center space-x-2 justify-center rounded-full drop-shadow-lg">
                    <div className="flex shrink-0 -space-x-1 text-gray-500 dark:text-gray-400 font-normal">
                    {(() => {
                      const pk = pricingInventoryKey(projectRow);
                      const pd = pricesResult.prices[pk];
                      const titleKey = settingsData?.source?.title ?? '';
                      const legacySource =
                        titleKey && pd && typeof pd === 'object'
                          ? (pd as unknown as Record<string, unknown>)[titleKey]
                          : undefined;
                      const raw = Number(pd?.steam_listing ?? legacySource ?? 0);
                      if (!Number.isFinite(raw) || raw <= 0) return '';
                      return new Intl.NumberFormat(settingsData.locale, {
                        style: 'currency',
                        currency: settingsData.currency,
                      }).format(raw * (settingsData.currencyPrice[settingsData.currency] ?? 1));
                    })()}
                    </div>
                  </div>
                </td>
              ) : (
                ''
              )}
              <td className="hidden 2xl:table-cell px-6 py-1 text-sm text-gray-500 dark:text-gray-400 font-medium">
                <div className="flex items-center space-x-2 justify-center rounded-full drop-shadow-lg">
                  <div className="flex shrink-0 -space-x-1">
                    {projectRow.stickers?.map((sticker, index) => (
                      <Link
                        key={`${sticker.sticker_type}-${sticker.sticker_name}-${index}`}
                        to={{
                          pathname: `https://steamcommunity.com/market/listings/730/${sticker.sticker_type} | ${sticker.sticker_name}`,
                        }}
                        target="_blank"
                        >
                        <img
                          key={index}
                          onMouseEnter={() =>
                            setStickerHover(index + projectRow.item_id)
                          }
                          onMouseLeave={() => setStickerHover('')}
                          className={classNames(
                            stickerHover == index + projectRow.item_id
                              ? 'transform-gpu hover:-translate-y-1 hover:scale-110'
                              : '',
                            'max-w-none h-8 w-8 rounded-full hover:shadow-xs text-black hover:bg-gray-50 transition duration-500 ease-in-out hover:text-white ring-2 object-cover ring-transparent bg-linear-to-t from-gray-100 to-gray-300 dark:from-gray-300 dark:to-gray-400'
                          )}
                          src={
                            createCSGOImage(sticker.sticker_url)
                          }
                          alt={sticker.sticker_name}
                          title={sticker.sticker_name}
                        />
                      </Link>
                    ))}
                  </div>
                </div>
              </td>

              <td className="table-cell px-6 py-1 text-sm text-gray-500 dark:text-gray-400 font-normal ">
                {projectRow.item_paint_wear?.toString()?.substr(0, 9)}
              </td>
              <td className="table-cell px-6 py-1 text-sm text-gray-500 dark:text-gray-400 font-medium">
                <div className={classNames(isFull ? 'hidden' : '', 'flex justify-center')}>
                  <button
                    type="button"
                    className={classNames(btnIcon, 'border-transparent bg-transparent p-1')}
                    onClick={() => dispatch(tradeUpAddRemove(projectRow))}
                  >
                    <BeakerIcon
                      className={classNames(
                        'text-gray-400 dark:text-gray-500 hover:text-yellow-400 dark:hover:text-yellow-400 h-5'
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </td>
              <td className="hidden md:px-6 py-1 whitespace-nowrap text-right text-sm font-medium"></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}

export default function TradeUpPicker() {
  return content();
}
