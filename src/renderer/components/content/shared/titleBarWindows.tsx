import { btnToolbarIcon } from "./buttonStyles.ts";
import { classNames } from "./filters/inventoryFunctions.ts";
import TitleBarClose from "./iconsLogo/close.tsx";
import TitleBarMaximize from "./iconsLogo/maximize.tsx";
import TitleBarMinimize from "./iconsLogo/minimize.tsx";

export default function TitleBarWindows() {

  async function sendAction(whichOption) {
    window.electron.ipcRenderer.handleWindowsActions(whichOption)
  }
  return (
    <>
      {/* Page title & actions */}
      <div className="frost-sep-b border-b-0 bg-white titleBarCustom fixed top-0 left-0 z-50 flex w-full justify-end dark:bg-dark-level-two dark:text-dark-white">
      <div className="dark:text-dark-white">
      <button
        type="button"
        className={classNames(btnToolbarIcon, 'h-7 w-12 border-l border-gray-700/50 text-xs titleButtons')}
        onClick={() => sendAction('min')}
      >
      <TitleBarMinimize />
      </button>
      </div>
      <div className="dark:text-dark-white">
      <button
        type="button"
        className={classNames(btnToolbarIcon, 'h-7 w-12 border-l border-gray-700/50 text-xs titleButtons')}
        onClick={() => sendAction('max')}
      >
      <TitleBarMaximize />
      </button>
      </div>
      <div className="dark:text-dark-white">
      <button
        type="button"
        className={classNames(
          btnToolbarIcon,
          'h-7 w-12 border-l border-gray-700/50 text-xs titleButtons hover:bg-red-900/70 hover:text-white'
        )}
        onClick={() => sendAction('close')}
      >
      <TitleBarClose />
      </button>
      </div>
      </div>
    </>
  );
}
