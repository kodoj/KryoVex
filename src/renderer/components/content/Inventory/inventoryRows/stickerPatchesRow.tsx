import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IMAGE_FALLBACK_DATA_URI } from 'renderer/functionsClasses/createCSGOImage.ts';
import { markImageError, useCs2Image } from 'renderer/hooks/useCs2Image.ts';
import { classNames } from '../../shared/filters/inventoryFunctions.ts';

function steamStickerMarketUrl(sticker: { sticker_type: string; sticker_name: string }) {
  const hash = `${sticker.sticker_type} | ${sticker.sticker_name}`.replaceAll(
    '(Holo/Foil)',
    '(Holo-Foil)'
  );
  return `https://steamcommunity.com/market/listings/730/${encodeURIComponent(hash)}`;
}

function StickerThumb({
  sticker,
  hoverKey,
  stickerHover,
  setStickerHover,
}: {
  sticker: { sticker_url: string; sticker_name: string; sticker_type: string };
  hoverKey: string;
  stickerHover: string;
  setStickerHover: (v: string) => void;
}) {
  const src = useCs2Image(sticker.sticker_url ?? '', { fallback: IMAGE_FALLBACK_DATA_URI });
  return (
    <Link
      to={{ pathname: steamStickerMarketUrl(sticker) }}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0"
    >
      <img
        onMouseEnter={() => setStickerHover(hoverKey)}
        onMouseLeave={() => setStickerHover('')}
        className={classNames(
          stickerHover === hoverKey
            ? 'transform-gpu hover:-translate-y-1 hover:scale-110'
            : '',
          'h-8 w-8 rounded-full object-cover ring-1 ring-gray-600/70 bg-dark-level-two transition duration-300 ease-out hover:ring-gray-500'
        )}
        src={src}
        alt={sticker.sticker_name}
        title={sticker.sticker_name}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={(e) => {
          if (sticker.sticker_url) markImageError(sticker.sticker_url);
          const img = e.currentTarget;
          img.onerror = null;
          img.src = IMAGE_FALLBACK_DATA_URI;
        }}
      />
    </Link>
  );
}

export function RowStickersPatches({ itemRow, settingsData }) {
  const [stickerHover, setStickerHover] = useState('');

  return (
    <>
      {settingsData.columns.includes('Stickers/patches') ? (
        <td className="hidden lg:table-cell px-6 py-3 text-sm text-gray-500 dark:text-gray-400 font-medium">
          <div className="flex items-center space-x-2 justify-center rounded-full drop-shadow-lg">
            <div className="flex shrink-0 -space-x-1">
              {itemRow.stickers?.map((sticker, index) => (
                <StickerThumb
                  key={`${sticker.sticker_url ?? sticker.sticker_name}-${index}`}
                  sticker={sticker}
                  hoverKey={index + itemRow.item_id}
                  stickerHover={stickerHover}
                  setStickerHover={setStickerHover}
                />
              ))}
            </div>
          </div>
        </td>
      ) : (
        ''
      )}
    </>
  );
}
