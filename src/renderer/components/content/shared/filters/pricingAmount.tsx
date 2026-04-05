import { BanknotesIcon } from '@heroicons/react/24/solid';
import { classNames } from './inventoryFunctions.ts';

type PricingAmountProps = {
  totalAmount: any;
  pricingAmount?: number;
  IconToUse?: typeof BanknotesIcon;
  colorOf?: string;
  /** Optional tooltip for the row */
  title?: string;
};

export default function PricingAmount({
  totalAmount,
  pricingAmount = 0,
  IconToUse = BanknotesIcon,
  colorOf = 'text-yellow-500',
  title,
}: PricingAmountProps) {
  return (
    <span
      className="mr-3 flex items-center text-gray-500 text-xs font-medium uppercase tracking-wide"
      title={title}
    >
      <IconToUse
        className="flex-none w-5 h-5 mr-2 text-gray-400 group-hover:text-gray-500"
        aria-hidden="true"
      />{' '}
      <span className={classNames(colorOf)}>{totalAmount} </span>
      {pricingAmount == 0 ?
      '' :
      <span className="text-gray-400 dark:text-gray-500">&nbsp; ( {pricingAmount} ) </span>
      }

    </span>
  );
}
