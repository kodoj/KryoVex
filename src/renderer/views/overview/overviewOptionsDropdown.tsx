import type { ComponentType } from 'react';
import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Transition } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/solid';
import { classNames } from 'renderer/components/content/shared/filters/inventoryFunctions.ts';
import type {
  OverviewOptionsBy,
  OverviewOptionsLeftCharts,
  OverviewOptionsRightCharts,
} from 'renderer/interfaces/overview.tsx';
import { Overview, Settings } from 'renderer/interfaces/states.tsx';
import { useDispatch, useSelector } from 'react-redux';
import { selectSettings, setOverview } from 'renderer/store/slices/settings.ts';

interface ListBoxOptionsProps {
  optionsObject: OverviewOptionsBy | OverviewOptionsLeftCharts | OverviewOptionsRightCharts;
  keyToUse: keyof Overview;
  /** Renders inside the trigger so icon + label share one control surface */
  Icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

export default function ListBoxOptions({ optionsObject, keyToUse, Icon }: ListBoxOptionsProps) {
  const dispatch = useDispatch();
  const settingsData: Settings = useSelector(selectSettings);
  const selected = settingsData.overview[keyToUse];

  async function updateOverview(valueToSet: string) {
    const newOverviewValue: Overview = {
      ...settingsData.overview,
      [keyToUse]: valueToSet as Overview[typeof keyToUse],
    };
    dispatch(setOverview(newOverviewValue));
    await window.electron.store.set('overview', newOverviewValue);
    window.electron.ipcRenderer.refreshInventory();
  }

  const label = optionsObject[selected] ?? '';

  return (
    <Listbox value={selected} onChange={updateOverview}>
      {({ open }) => (
        <div className="relative w-full min-w-[10rem] max-w-xs">
          <ListboxButton
            className={classNames(
              'relative inline-flex w-full items-center gap-2 rounded-md border border-gray-700/50',
              'bg-dark-level-two py-2 pl-3 pr-9 text-left text-sm font-medium text-dark-white shadow-xs',
              'cursor-default transition-colors hover:border-gray-600/60 hover:bg-dark-level-three',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-kryo-ice-400/80'
            )}
          >
            {Icon ? (
              <Icon className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
            ) : null}
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </span>
          </ListboxButton>

          <Transition
            show={open}
            as="div"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <ListboxOptions
              modal={false}
              portal={false}
              className={classNames(
                'absolute left-0 top-full z-30 mt-1 max-h-60 w-full min-w-full overflow-auto rounded-md',
                'border border-gray-700/40 bg-dark-level-three py-1 text-sm shadow-lg ring-1 ring-black/25',
                'focus:outline-none'
              )}
            >
              {Object.entries(optionsObject).map(([key, name]) => (
                <ListboxOption
                  key={key}
                  className={({ focus }) =>
                    classNames(
                      focus ? 'bg-dark-level-four' : '',
                      'relative cursor-default select-none py-2 pl-3 pr-10 text-dark-white'
                    )
                  }
                  value={key}
                >
                  {({ selected: isSelected, focus }) => (
                    <div
                      className={classNames(
                        'flex items-center',
                        isSelected ? 'font-semibold' : 'font-normal'
                      )}
                    >
                      <span className="block whitespace-nowrap">{name}</span>
                      {isSelected ? (
                        <span
                          className={classNames(
                            'absolute inset-y-0 right-0 flex items-center pr-3',
                            focus ? 'text-dark-white' : 'text-dark-white'
                          )}
                        >
                          <CheckIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                        </span>
                      ) : null}
                    </div>
                  )}
                </ListboxOption>
              ))}
            </ListboxOptions>
          </Transition>
        </div>
      )}
    </Listbox>
  );
}
