import { ArrowsUpDownIcon } from '@heroicons/react/24/outline';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid';

export type SortIndicatorProps = {
  /** This column is the active sort */
  active: boolean;
  /** When active: true = ascending (base comparator order), false = descending (reversed list) */
  ascending: boolean;
  className?: string;
};

/**
 * Table column sort affordance: neutral twin arrows, or a single chevron when this column is active.
 */
export function SortIndicator({ active, ascending, className }: SortIndicatorProps) {
  const cn = className ?? 'h-3 w-3 shrink-0 opacity-80';
  if (!active) {
    return <ArrowsUpDownIcon className={cn} aria-hidden />;
  }
  return ascending ? (
    <ChevronUpIcon className={cn} aria-hidden />
  ) : (
    <ChevronDownIcon className={cn} aria-hidden />
  );
}
