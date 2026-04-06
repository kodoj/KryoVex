import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { BeakerIcon, PencilIcon, TagIcon } from '@heroicons/react/24/solid';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  RowHeader,
  RowHeaderCondition,
  RowHeaderPlainKey,
  RowHeaderCustomKey,
  autoFitAllColumns,
  applyPersistedWidthsToTable,
  requestWindowFitForTable,
  setTableWidthToColSum,
} from 'renderer/components/content/Inventory/inventoryRows/headerRows.tsx';
import {
  overviewTableScrollWrap,
  overviewTableClassName,
  overviewTheadClassName,
  overviewTheadTrClassName,
  overviewThCellOverride,
  overviewTbodyClassName,
  overviewTrClassName,
} from 'renderer/components/content/shared/tableOverviewStyles.ts';
import { btnDefault, btnIcon } from 'renderer/components/content/shared/buttonStyles.ts';
import {
  classNames,
  sortDataFunction,
} from 'renderer/components/content/shared/filters/inventoryFunctions.ts';
import itemRarities from 'renderer/components/content/shared/rarities.tsx';
import { ConvertPricesFormatted } from 'renderer/functionsClasses/prices.ts';
import { setRenameModal } from 'renderer/store/slices/modalRename.ts';
import { selectTradeUp, tradeUpAddRemove } from 'renderer/store/slices/tradeUp.ts';
import { IMAGE_FALLBACK_DATA_URI } from '../../functionsClasses/createCSGOImage.ts';
import { markImageError, useCs2Image } from 'renderer/hooks/useCs2Image.ts';
import { selectInventory } from 'renderer/store/slices/inventory.ts';
import { selectInventoryFilters } from 'renderer/store/slices/inventoryFilters.ts';
import { selectPricing } from 'renderer/store/slices/pricing.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';
import { ItemRow, ItemRowStorage } from 'renderer/interfaces/items.ts';

function steamMarketListingUrlForRow(row: ItemRow): string {
  const hash =
    row.item_paint_wear == null
      ? row.item_name
      : `${row.item_name} (${row.item_wear_name})`;
  const fixed = String(hash).replaceAll('(Holo/Foil)', '(Holo-Foil)');
  return `https://steamcommunity.com/market/listings/730/${encodeURIComponent(fixed)}`;
}

function steamStickerMarketUrl(sticker: { sticker_type: string; sticker_name: string }) {
  const hash = `${sticker.sticker_type} | ${sticker.sticker_name}`.replaceAll(
    '(Holo/Foil)',
    '(Holo-Foil)'
  );
  return `https://steamcommunity.com/market/listings/730/${encodeURIComponent(hash)}`;
}

function TradeUpItemImg({
  srcKey,
  className,
  title,
  onMouseEnter,
  onMouseLeave,
}: {
  srcKey: string;
  className: string;
  title?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const src = useCs2Image(srcKey, { fallback: IMAGE_FALLBACK_DATA_URI });
  return (
    <img
      className={className}
      title={title}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      src={src}
      onError={(e) => {
        markImageError(srcKey);
        const img = e.currentTarget;
        img.onerror = null;
        img.src = IMAGE_FALLBACK_DATA_URI;
      }}
    />
  );
}

function TradeUpStickerImg({
  srcKey,
  className,
  alt,
  title,
  onMouseEnter,
  onMouseLeave,
}: {
  srcKey: string;
  className: string;
  alt?: string;
  title?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const src = useCs2Image(srcKey, { fallback: IMAGE_FALLBACK_DATA_URI });
  return (
    <img
      className={className}
      alt={alt ?? ''}
      title={title}
      loading="lazy"
      decoding="async"
      draggable={false}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      src={src}
      onError={(e) => {
        markImageError(srcKey);
        const img = e.currentTarget;
        img.onerror = null;
        img.src = IMAGE_FALLBACK_DATA_URI;
      }}
    />
  );
}

function content() {
  const [stickerHover, setStickerHover] = useState('');
  const [itemHover, setItemHover] = useState('');
  const [sortedRows, setSortedRows] = useState<ItemRow[]>([]);

  const inventory = useSelector(selectInventory);
  const inventoryFilters = useSelector(selectInventoryFilters);
  const pricesResult = useSelector(selectPricing);
  const settingsData = useSelector(selectSettings);
  const tradeUpData = useSelector(selectTradeUp);

  const dispatch = useDispatch();

  const tableId = 'tradeUp';
  /** Fixed px — icon-only; avoids table-fixed eating slack from old persisted `Steam` widths. */
  const STEAM_LINK_COL_PX = 40;
  const colWidths = (settingsData as any)?.columnWidths?.[tableId] ?? {};
  const didAutoFitRef = useRef(false);
  const colStyle = (key: string) => {
    const width = colWidths?.[key];
    return width != null ? ({ width: `${width}px` } as any) : ({} as any);
  };
  const colStyleSteamLink = (): React.CSSProperties => ({
    width: `${STEAM_LINK_COL_PX}px`,
    minWidth: `${STEAM_LINK_COL_PX}px`,
    maxWidth: `${STEAM_LINK_COL_PX}px`,
  });

  const rarityColorByName = useMemo(() => {
    const out: Record<string, string> = {};
    for (const r of itemRarities) out[r.value] = r.bgColorClass;
    return out;
  }, []);

  const getRarityColor = (row: ItemRow) => rarityColorByName[row.rarityName] ?? '';

  const baseRowsToSort = useMemo(() => {
    // Group inventory+storageRaw by item_name, then expand rows based on the filtered list.
    const grouped: Record<string, ItemRow[]> = {};
    const inventoryToUse = [...inventory.inventory, ...inventory.storageInventoryRaw] as ItemRow[];
    for (const element of inventoryToUse) {
      (grouped[element.item_name] ||= []).push(element);
    }

    const out: ItemRow[] = [];
    const seen = new Set<string>();
    const inventoryFilter = [...inventoryFilters.inventoryFiltered, ...inventory.storageInventory] as ItemRow[];
    for (const row of inventoryFilter) {
      if (seen.has(row.item_name)) continue;
      const group = grouped[row.item_name];
      if (group) out.push(...group);
      seen.add(row.item_name);
    }
    return out;
  }, [
    inventory.inventory,
    inventory.storageInventoryRaw,
    inventory.storageInventory,
    inventoryFilters.inventoryFiltered,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sorted = (await sortDataFunction(
        inventoryFilters.sortValue,
        baseRowsToSort,
        pricesResult.prices,
        settingsData?.source?.title
      )) as ItemRow[];
      if (!cancelled) setSortedRows(sorted);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    baseRowsToSort,
    inventoryFilters.sortValue,
    pricesResult.prices,
    settingsData?.source?.title,
  ]);

  const finalInventoryToUse = useMemo(() => {
    let rows = sortedRows.filter(function (item) {
      if (!item.tradeUpConfirmed) {
        return false;
      }
      if (
        tradeUpData.MinFloat > (item.item_paint_wear ?? 0) ||
        tradeUpData.MaxFloat < (item.item_paint_wear ?? 0)
      ) {
        return false;
      }
      if (tradeUpData.tradeUpProductsIDS.includes(item.item_id)) {
        return false;
      }
      if (
        tradeUpData.collections.length > 0 &&
        !tradeUpData.collections.includes(item?.collection)
      ) {
        return false;
      }
      if (tradeUpData.options.includes('Hide equipped')) {
        if (item.equipped_t || item.equipped_ct) {
          return false;
        }
      }
      if (tradeUpData.tradeUpProducts.length != 0) {
        let restrictRarity = tradeUpData.tradeUpProducts[0].rarityName;
        let restrictStattrak = tradeUpData.tradeUpProducts[0].stattrak;
        if (item.rarityName != restrictRarity) {
          return false;
        }
        if (item.stattrak != restrictStattrak) {
          return false;
        }
      }

      if (item.tradeUp) {
        return true;
      }
      return false;
    });
    if (inventoryFilters.sortBack) {
      rows = [...rows].reverse();
    }
    return rows;
  }, [
    sortedRows,
    inventoryFilters.sortBack,
    tradeUpData.MinFloat,
    tradeUpData.MaxFloat,
    tradeUpData.tradeUpProductsIDS,
    tradeUpData.collections,
    tradeUpData.options,
    tradeUpData.tradeUpProducts,
  ]);

  const isFull = tradeUpData.tradeUpProducts.length == 10;

  useLayoutEffect(() => {
    if (didAutoFitRef.current) return;
    if (colWidths && Object.keys(colWidths).length > 0) return;
    if (!finalInventoryToUse || finalInventoryToUse.length === 0) return;
    const table = document.querySelector(`table[data-tableid="${tableId}"]`) as HTMLTableElement | null;
    if (!table) return;
    didAutoFitRef.current = true;
    autoFitAllColumns(table, dispatch);
    requestAnimationFrame(() => {
      autoFitAllColumns(table, dispatch);
      requestWindowFitForTable(table);
    });
  }, [finalInventoryToUse.length, dispatch, tableId, colWidths]);

  useLayoutEffect(() => {
    if (!colWidths || Object.keys(colWidths).length === 0) return;
    const table = document.querySelector(`table[data-tableid="${tableId}"]`) as HTMLTableElement | null;
    if (!table) return;
    applyPersistedWidthsToTable(table, colWidths as Record<string, number>);
    const steamLink = table.querySelector('col[data-colkey="SteamLink"]') as HTMLTableColElement | null;
    if (steamLink) {
      steamLink.style.width = `${STEAM_LINK_COL_PX}px`;
      steamLink.style.minWidth = `${STEAM_LINK_COL_PX}px`;
      steamLink.style.maxWidth = `${STEAM_LINK_COL_PX}px`;
    }
    setTableWidthToColSum(table);
    requestWindowFitForTable(table);
  }, [tableId, colWidths, STEAM_LINK_COL_PX]);

  return (
    <>
      <div className="bg-dark-level-one px-2 py-3 sm:px-3">
        <div data-table-scroll className={overviewTableScrollWrap}>
        <table
          data-tableid={tableId}
          data-table-width="fill"
          className={classNames(overviewTableClassName, overviewThCellOverride)}
        >
        <colgroup>
          <col data-colkey="Product name" style={colStyle('Product name')} />
          <col data-colkey="Collection" style={colStyle('Collection')} />
          <col data-colkey="Price" style={colStyle('Price')} />
          <col data-colkey="Stickers" style={colStyle('Stickers')} />
          <col data-colkey="wearValue" style={colStyle('wearValue')} />
          <col data-colkey="SteamLink" style={colStyleSteamLink()} />
          <col data-colkey="Move" style={colStyle('Move')} />
        </colgroup>
        <thead className={overviewTheadClassName}>
          <tr className={classNames(overviewTheadTrClassName, 'border-gray-200')}>
            <RowHeader headerName="Product" sortName="Product name" />
            <RowHeaderCondition
              headerName="Collection"
              sortName="Collection"
              condition="Collections"
              visibilityClass="table-cell"
              forceVisible
            />
            <RowHeaderCondition
              headerName="Price"
              sortName="Price"
              condition="Price"
              visibilityClass="table-cell"
              forceVisible
            />
            <RowHeaderCondition
              headerName="Stickers/Patches"
              sortName="Stickers"
              condition="Stickers/patches"
              visibilityClass="table-cell"
              forceVisible
            />
            <RowHeaderCondition
              headerName="Float"
              sortName="wearValue"
              condition="Float"
              visibilityClass="table-cell"
              thClassName="border-r border-gray-600/55 dark:border-gray-600/50"
              forceVisible
            />
            <RowHeaderCustomKey colKey="SteamLink" className="table-cell !px-1 border-r border-gray-600/55 dark:border-gray-600/50">
              <div className="flex w-full items-center justify-center py-0.5">
                <span className="sr-only">Steam Market</span>
                <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              </div>
            </RowHeaderCustomKey>
            <RowHeaderPlainKey colKey="Move" label="Move" visibilityClass="table-cell" />
          </tr>
        </thead>
        <tbody className={overviewTbodyClassName}>
          {finalInventoryToUse.map((projectRow: ItemRow) => (
            (() => {
              const rarityColor = getRarityColor(projectRow);
              return (
            <tr
              key={projectRow.item_id}
              className={classNames(
                projectRow.item_name
                  ?.toLowerCase()
                  .includes(tradeUpData.searchInput?.toLowerCase().trim()) ||
                  projectRow.item_customname
                    ?.toLowerCase()
                    .includes(tradeUpData.searchInput?.toLowerCase().trim()) ||
                  projectRow.item_wear_name
                    ?.toLowerCase()
                    .includes(tradeUpData.searchInput?.toLowerCase().trim()) ||
                  tradeUpData.searchInput == undefined
                  ? ''
                  : 'hidden',
                inventoryFilters.rarityFilter.length != 0
                  ? inventoryFilters.rarityFilter?.includes(
                      rarityColor
                    )
                    ? ''
                    : 'hidden'
                  : '',
                overviewTrClassName
              )}
              >
              <td className="max-w-0 w-full whitespace-nowrap text-sm font-normal text-gray-900 dark:text-zinc-100">
                <div className="flex items-center gap-2 lg:pl-1">
                  <div
                    className={classNames(
                      rarityColor,
                      'shrink-0 w-2.5 h-2.5 rounded-full'
                    )}
                    aria-hidden="true"
                  />
                  <div className="flex shrink-0">
                    {projectRow.item_moveable != true ? (
                      <div
                        className={classNames(
                          'relative h-11 w-11 shrink-0 overflow-hidden rounded-md',
                          'bg-dark-level-two/90 ring-1 ring-gray-700/40'
                        )}
                      >
                        <TradeUpItemImg
                          className="h-full w-full origin-center scale-[1.22] object-contain object-center transition duration-300 ease-out"
                          srcKey={projectRow.item_url}
                          title={projectRow.item_name}
                        />
                      </div>
                    ) : (
                      <Link
                        to={{ pathname: steamMarketListingUrlForRow(projectRow) }}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View on Steam Community Market"
                        className="shrink-0"
                      >
                        <div
                          className={classNames(
                            'relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-dark-level-two/90 transition duration-300',
                            itemHover === projectRow.item_id
                              ? 'ring-2 ring-amber-400/70'
                              : 'ring-1 ring-gray-700/40'
                          )}
                        >
                          <TradeUpItemImg
                            onMouseEnter={() => setItemHover(projectRow.item_id)}
                            onMouseLeave={() => setItemHover('')}
                            className="h-full w-full origin-center scale-[1.22] object-contain object-center transition duration-300 ease-out"
                            srcKey={projectRow.item_url}
                          />
                        </div>
                      </Link>
                    )}
                  </div>
                  <span>
                    <span className="flex dark:text-zinc-100">
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
                        <span className="ml-1 h-3 leading-3 pl-1 pr-1 text-white  dark:text-dark-white text-center font-medium	 bg-dark-level-four rounded-full   text-xs">
                          {' '}
                          T{' '}
                        </span>
                      ) : (
                        ''
                      )}
                      {projectRow.equipped_ct ? (
                        <span className="ml-1 h-3 leading-3 pl-1 pr-1 text-center  text-white dark:text-dark-white font-medium	 bg-dark-level-four rounded-full   text-xs">
                          {' '}
                          CT{' '}
                        </span>
                      ) : (
                        ''
                      )}

                      {projectRow.item_url.includes('casket') ? (
                        <Link
                          to=""
                          className="text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200"
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
                      className="text-gray-500 dark:text-gray-400"
                      title={projectRow.item_paint_wear?.toString()}
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

                      {projectRow.storage_name
                        ? ' /' + projectRow.storage_name
                        : ''}
                      {/*
                      {isShown == project.item_id  && project.item_paint_wear !== undefined?
                        <div>{project.item_paint_wear}</div>
                       : ''} */}
                    </span>
                  </span>
                </div>
              </td>
              <td className="table-cell max-w-0 w-full whitespace-nowrap text-center text-sm font-normal text-gray-900 dark:text-zinc-100">
                <div className="flex items-center justify-center">
                  <span>
                    <span className="flex dark:text-zinc-100">
                      {projectRow.collection
                        .replace('The ', '')
                        .replace(' Collection', '')}
                    </span>
                  </span>
                </div>
              </td>

              <td className="table-cell text-sm font-medium text-gray-500 dark:text-zinc-200">
                <div className="flex items-center justify-center gap-1">
                  <div className="flex shrink-0 -space-x-1 text-gray-500 dark:text-zinc-200 font-normal">
                    {(() => {
                      const prices = new ConvertPricesFormatted(settingsData, pricesResult);
                      const price = prices.getPrice(projectRow);
                      return Number.isFinite(price) && price > 0
                        ? prices.getFormattedPrice(projectRow)
                        : '';
                    })()}
                  </div>
                </div>
              </td>

              <td className="table-cell text-sm font-medium text-gray-500 dark:text-gray-400">
                <div className="flex items-center justify-center gap-1">
                  <div className="flex shrink-0 -space-x-1">
                    {projectRow.stickers?.map((sticker, index) => (
                      <Link
                        key={`${projectRow.item_id}-${index}-${sticker?.sticker_url ?? ''}`}
                        to={{ pathname: steamStickerMarketUrl(sticker) }}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        <div
                          className={classNames(
                            'relative h-8 w-8 overflow-hidden rounded-md',
                            'bg-dark-level-two/90 ring-1 ring-gray-700/40',
                            stickerHover === index + projectRow.item_id
                              ? 'transform-gpu -translate-y-0.5 scale-105'
                              : ''
                          )}
                        >
                          <TradeUpStickerImg
                            onMouseEnter={() => setStickerHover(index + projectRow.item_id)}
                            onMouseLeave={() => setStickerHover('')}
                            className="h-full w-full origin-center scale-[1.18] object-contain object-center transition duration-300 ease-out"
                            srcKey={sticker.sticker_url}
                            alt={sticker.sticker_name}
                            title={sticker.sticker_name}
                          />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </td>

              <td className="table-cell whitespace-nowrap text-right text-sm font-normal text-gray-500 dark:text-gray-400">
                {projectRow.item_paint_wear?.toString()?.substr(0, 9)}
              </td>
              <td className="table-cell w-10 max-w-[2.5rem] shrink-0 px-0 py-1 text-center align-middle">
                <Link
                  to={{ pathname: steamMarketListingUrlForRow(projectRow) }}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Steam Community Market listing"
                  className="mx-auto inline-flex shrink-0 justify-center rounded p-0.5 text-gray-500 transition-colors hover:bg-dark-level-four/60 hover:text-zinc-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-500"
                >
                  <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="sr-only">Open Steam market listing</span>
                </Link>
              </td>
              <td className="table-cell w-14 shrink-0 align-middle text-center text-sm text-gray-500 dark:text-gray-400">
                <div className={classNames(isFull ? 'hidden' : '', 'flex justify-center')}>
                  <button
                    type="button"
                    className={classNames(btnIcon, 'border-transparent bg-transparent p-1')}
                    onClick={() => dispatch(tradeUpAddRemove(projectRow as ItemRowStorage))}
                    title={
                      tradeUpData.tradeUpProductsIDS.includes(projectRow.item_id)
                        ? 'Remove from trade-up contract'
                        : isFull
                          ? 'Contract is full (10 items)'
                          : 'Add to trade-up contract'
                    }
                  >
                    <BeakerIcon
                      className={classNames(
                        'h-5 text-gray-400 hover:text-yellow-400 dark:text-gray-500 dark:hover:text-yellow-400'
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </td>
            </tr>
              );
            })()
          ))}
        </tbody>
        </table>
        </div>
      </div>
    </>
  );
}

export default function TradeUpPicker() {
  return content();
}
