import { PencilIcon, TagIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import { setRenameModal } from "renderer/store/slices/modalRename.ts";
import { IMAGE_FALLBACK_DATA_URI } from "renderer/functionsClasses/createCSGOImage.ts";
import { markImageError, useCs2Image } from "renderer/hooks/useCs2Image.ts";
import { btnDefault } from "../../shared/buttonStyles.ts";
import { classNames } from "../../shared/filters/inventoryFunctions.ts";

export function RowProduct({ itemRow }) {
  const dispatch = useDispatch();
  const [itemHover, setItemHover] = useState(false);
  const imgSrc = useCs2Image(itemRow?.item_url, { fallback: IMAGE_FALLBACK_DATA_URI });
  let marketHashName = itemRow.item_name;
  if (itemRow.item_paint_wear != undefined) {
    marketHashName =
    itemRow.item_name + ' (' + itemRow.item_wear_name + ')';
  }

  return (
    <>
      <td className="table-cell px-6 py-1 max-w-0 w-full overflow-hidden text-sm font-normal text-gray-900 dark:text-zinc-100">
        <div className="flex items-center gap-3 lg:pl-2 min-w-0">
          <div
            className={classNames(
              itemRow.bgColorClass,
              'shrink-0 w-2.5 h-2.5 rounded-full'
            )}
            aria-hidden="true"
          />
          <Link
            to={{
              pathname: `https://steamcommunity.com/market/listings/730/${encodeURIComponent(
                marketHashName.replaceAll('Holo/Foil', 'Holo-Foil')
              )}`,
            }}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            <div
              className={classNames(
                'relative h-11 w-11 shrink-0 overflow-hidden rounded-md',
                'bg-dark-level-two/90 ring-1 ring-gray-700/40'
              )}
            >
              <img
                onMouseEnter={() => setItemHover(true)}
                onMouseLeave={() => setItemHover(false)}
                className={classNames(
                  itemHover
                    ? 'transform-gpu hover:-translate-y-0.5 hover:scale-[1.08]'
                    : '',
                  'h-full w-full origin-center scale-[1.22] object-contain object-center transition duration-300 ease-out'
                )}
                src={imgSrc}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
                onError={(e) => {
                  const img = e.currentTarget;
                  markImageError(itemRow?.item_url);
                  img.onerror = null;
                  img.src = IMAGE_FALLBACK_DATA_URI;
                }}
              />
            </div>
          </Link>

          <span className="min-w-0">
            <span className="flex min-w-0 dark:text-zinc-100">
              {itemRow.item_name !== '' ? (
                itemRow.item_customname !== null ? (
                  itemRow.item_customname
                ) : (
                  itemRow.item_name
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
                      navigator.clipboard.writeText(JSON.stringify(itemRow))
                    }
                  >
                    {' '}
                    COPY REF
                  </button>
                </span>
              )}
              {itemRow.item_name !== '' &&
                      itemRow.item_customname !== null &&
                      !itemRow.item_url.includes('casket') ? (
                        <TagIcon className="h-3 w-3  ml-1" />
                      ) : (
                        ''
                      )}
                      {itemRow.equipped_t ? (
                        <span className="ml-1 h-3 leading-3 pl-1 pr-1 text-white  dark:text-dark-white text-center font-medium	 bg-dark-level-four rounded-full   text-xs">
                          {' '}
                          T{' '}
                        </span>
                      ) : (
                        ''
                      )}
                      {itemRow.equipped_ct ? (
                        <span className="ml-1 h-3 leading-3 pl-1 pr-1 text-center  text-white dark:text-dark-white font-medium	 bg-dark-level-four rounded-full   text-xs">
                          {' '}
                          CT{' '}
                        </span>
                      ) : (
                        ''
                      )}

                      {itemRow.item_url.includes('casket') ? (
                        <Link
                          to=""
                          className="text-gray-500 dark:text-gray-300"
                          onClick={() =>
                            dispatch(
                              setRenameModal({
                                itemID: itemRow.item_id,
                                itemName: itemRow.item_customname !== null
                                  ? itemRow.item_customname
                                  : itemRow.item_name
                              })
                            )
                          }
                        >
                          <PencilIcon className="h-4 w-5 pb-1" />
                        </Link>
                      ) : (
                        ''
                      )}
            </span>
            <span className="block truncate text-gray-500 dark:text-gray-400" title={itemRow.item_paint_wear}>
              {itemRow.item_customname !== null ? itemRow.item_name : ''}
              {itemRow.item_customname !== null &&
                itemRow.item_paint_wear !== undefined
                ? ' - '
                : ''}
              {itemRow.item_paint_wear !== undefined
                ? itemRow.item_wear_name
                : ''}
            </span>
          </span>
        </div>
      </td>
    </>
  );
}
