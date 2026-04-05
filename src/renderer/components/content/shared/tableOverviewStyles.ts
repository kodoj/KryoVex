/**
 * Shared dark table shell — matches Overview “Unique items” / summary cards.
 */
export const overviewTableScrollWrap =
  'overflow-x-auto w-full min-w-0 rounded-lg border border-gray-700/90 bg-dark-level-three shadow-[0_4px_24px_rgba(0,0,0,0.35)] ring-1 ring-gray-900/80';

export const overviewTableClassName =
  'table-fixed w-full border-collapse text-left text-xs sm:text-sm text-zinc-200 [&_th]:!px-1 [&_th]:!py-1.5 [&_td]:!px-1 [&_td]:!py-1.5 [&_th:first-child]:!pl-2 [&_td:first-child]:!pl-2 [&_th:first-child]:!pr-1 [&_td:first-child]:!pr-1 [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wider sm:[&_th]:text-xs';

export const overviewTheadClassName =
  'sticky top-0 z-[1] border-b border-gray-600/70 bg-linear-to-b from-dark-level-two from-40% to-dark-level-three/95 backdrop-blur-md';

export const overviewTheadTrClassName = 'text-gray-400';

/** Header cells: let thead gradient show; avoid solid blocks that hide the shell */
export const overviewThCellOverride =
  '[&_thead_th]:!border-gray-600/50 [&_thead_th]:!bg-transparent [&_thead_th]:dark:!bg-transparent';

export const overviewTbodyClassName =
  'divide-y divide-gray-700/60 bg-dark-level-three/70';

export const overviewTrClassName =
  'transition-colors hover:bg-dark-level-four/45 findRow';
