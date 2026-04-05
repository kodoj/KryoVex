import { Fragment } from 'react'
import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react';
import { useDispatch, useSelector } from 'react-redux';
import { selectTradeUp, tradeUpOptionsAddRemove } from 'renderer/store/slices/tradeUp.ts';
import { TradeUpActions } from 'renderer/interfaces/states.tsx';

let optionsAvailable = ['Hide equipped']

export default function TradeUpOptionsDropDown() {
  const tradeUpData: TradeUpActions = useSelector(selectTradeUp);
  const dispatch = useDispatch();
  
  return (
    <Popover className="relative inline-block text-left">
      <PopoverButton className="group inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-0 dark:focus-visible:ring-gray-400 rounded-sm">
        <span>Options</span>
        <span className="tabular-nums text-gray-500 dark:text-gray-400 font-medium">
          {tradeUpData.options.length}
        </span>
      </PopoverButton>

        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <PopoverPanel className="origin-top-right absolute right-0 mt-2 z-20 bg-white dark:bg-dark-level-four rounded-md shadow-2xl p-4 ring-1 ring-black ring-opacity-5 focus:outline-none">
            <form className="space-y-4">
              {optionsAvailable.map((option, optionIdx) => (
                <div key={option} className="flex items-center">
                  <input
                    id={`filter-${option}-${optionIdx}`}
                    name={`${option}[]`}
                    defaultValue={option}
                    type="checkbox"
                    checked={tradeUpData.options.includes(option)}
                    className="h-4 w-4 border-gray-300 rounded text-kryo-ice-400 focus:ring-kryo-ice-400"
                    onClick={() => dispatch(tradeUpOptionsAddRemove(option))}
                  />
                  <label
                    htmlFor={`filter-${option}-${optionIdx}`}
                    className="ml-3 pr-6 text-sm font-medium text-gray-900 dark:text-gray-200 whitespace-nowrap"
                  >
                    {option.replace('The ', '').replace(' Collection', '')}
                  </label>
                </div>
              ))}
            </form>
          </PopoverPanel>
        </Transition>
    </Popover>
  );
}