/**
 * Shared button / control surfaces — matches overview dropdown chrome:
 * rounded-md, border-gray-700/60, shadow-xs, dark-level-two/three/four.
 */
export const focusRingBtn =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-0 dark:focus-visible:ring-gray-400';

const btnShell =
  `inline-flex items-center justify-center gap-2 rounded-md border shadow-xs text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${focusRingBtn}`;

/** Secondary / cancel / neutral actions */
export const btnDefault = `${btnShell} border-gray-700/60 bg-dark-level-two text-dark-white hover:bg-dark-level-three`;

/** Primary CTAs — logo sphere: nearly flat kryo navy (#020d18 → #051a2e), minimal lift so it reads like the badge not a chip. */
export const btnPrimary = `${btnShell} border-kryo-navy-900/65 bg-gradient-to-b from-kryo-navy-950 to-kryo-navy-900 font-semibold text-white transition-all duration-200 shadow-[0_1px_0_rgba(255,255,255,0.04),0_2px_8px_-2px_rgba(0,0,0,0.4)] hover:border-kryo-navy-800/80 hover:to-kryo-navy-800 hover:shadow-[0_1px_0_rgba(255,255,255,0.05),0_3px_10px_-2px_rgba(0,0,0,0.45)] focus-visible:ring-2 focus-visible:ring-kryo-navy-700 focus-visible:ring-offset-0 focus-visible:ring-offset-transparent`;

/** Headless UI Listbox / combobox triggers (full width, chevron space on the right) */
export const btnSelectTrigger = `relative w-full cursor-default border border-gray-700/60 bg-dark-level-two py-1.5 pl-2.5 pr-9 text-left text-sm text-dark-white shadow-xs rounded-md hover:bg-dark-level-three sm:text-sm ${focusRingBtn}`;

/** Icon-only or very compact controls */
export const btnIcon = `${btnShell} border-gray-700/60 bg-dark-level-two p-2 text-dark-white hover:bg-dark-level-three`;

/** Top bar / sidebar strip controls (hamburger, full-height row) */
export const btnToolbarIcon = `inline-flex items-center justify-center h-full px-4 text-gray-400 transition-colors hover:bg-dark-level-three hover:text-dark-white ${focusRingBtn}`;

/** Sidebar filter rows (category / rarity) — hover matches primary nav links in App sidebar */
export const btnNavRow = `flex w-full items-center rounded-md border border-transparent px-3 py-1.5 text-left text-sm font-medium text-gray-600 dark:text-gray-200 transition-colors hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-kryo-navy-800 dark:hover:ring-1 dark:hover:ring-inset dark:hover:ring-kryo-navy-600/50 dark:hover:text-dark-white ${focusRingBtn}`;

/** Text-only control (e.g. “Clear all”) */
export const btnText = `rounded-md px-3 py-1.5 text-sm font-medium text-gray-400 transition-colors hover:bg-dark-level-four/60 hover:text-dark-white ${focusRingBtn}`;

/** Context menu row */
export const btnMenuItem = `w-full rounded-sm px-3 py-2 text-left text-sm text-dark-white transition-colors hover:bg-dark-level-four ${focusRingBtn}`;

export const btnMenuItemDanger = `w-full rounded-sm px-3 py-2 text-left text-sm text-dark-white transition-colors hover:bg-red-900/40 ${focusRingBtn}`;

/** Table header sort controls (Unique items, etc.) — gray label, subtle focus ring */
export const sortThButton =
  'inline-flex items-center gap-1 rounded font-medium text-gray-400 hover:text-gray-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-500';

export const sortThButtonEnd = `${sortThButton} w-full justify-end`;
