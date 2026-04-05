import { LockClosedIcon, QrCodeIcon, WifiIcon } from '@heroicons/react/24/solid';
import { LoginMethod } from '../types/LoginMethod.ts';
import { btnDefault } from '../../../components/content/shared/buttonStyles.ts';
import { classNames } from '../../../components/content/shared/filters/inventoryFunctions.ts';

interface TabProps {
  name: string;
  icon: any;
  key: LoginMethod;
}

const tabs: TabProps[] = [
  { name: 'QR', icon: QrCodeIcon, key: 'QR' },
  { name: 'Webtoken', icon: WifiIcon, key: 'WEBTOKEN' },
  { name: 'Regular', icon: LockClosedIcon, key: 'REGULAR' },
];

type LoginTabsProps = {
  selectedTab: LoginMethod;
  setSelectedTab: (tab: LoginMethod) => void;
};

export default function LoginTabs({
  selectedTab,
  setSelectedTab,
}: LoginTabsProps) {
  return (
    <div className="bg-dark-level-one px-4 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="sm:hidden">
          <label htmlFor="tabs" className="sr-only">
            Select a tab
          </label>
          {/* Use an "onChange" listener to redirect the user to the selected tab URL. */}
          <select
            id="tabs"
            name="tabs"
            className="block w-full rounded-md border-none bg-white/5 py-2 pl-3 pr-10 text-base text-white shadow-xs ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-kryo-ice-400 sm:text-sm"
            value={tabs.find((tab) => tab.key === selectedTab)?.name}
            onChange={(e) => {
              const tab = tabs.find((t) => t.name === e.target.value);
              if (tab) setSelectedTab(tab.key);
            }}
          >
            {tabs.map((tab) => (
              <option key={tab.name}>{tab.name}</option>
            ))}
          </select>
        </div>
        <div className="hidden sm:block">
          <nav className="flex justify-center">
            <ul
              role="list"
              className="flex flex-none flex-wrap items-center justify-center gap-2 sm:gap-3 px-2 text-sm font-semibold leading-none text-gray-400"
            >
              {tabs.map((tab) => (
                <li key={tab.name}>
                  <button
                    onClick={() => setSelectedTab(tab.key)}
                    className={classNames(
                      btnDefault,
                      'inline-flex items-center gap-2 px-3 py-2',
                      tab.key === selectedTab && 'bg-dark-level-four'
                    )}
                    type="button"
                  >
                    <tab.icon
                      className={classNames(
                        tab.key === selectedTab ? 'text-dark-white' : 'text-gray-400',
                        'h-5 w-5 shrink-0'
                      )}
                      aria-hidden
                    />
                    <span
                      className={classNames(
                        tab.key === selectedTab ? 'text-dark-white' : 'text-gray-400',
                        'leading-tight'
                      )}
                    >
                      {tab.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}
