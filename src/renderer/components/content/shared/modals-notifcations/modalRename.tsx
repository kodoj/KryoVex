/* This example requires Tailwind CSS v2.0+ */
import { Fragment, useState } from 'react';
import { Dialog, DialogBackdrop, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { useDispatch, useSelector } from 'react-redux';
import { closeMoveModal } from 'renderer/store/slices/modalMove.ts';
import { btnDefault, btnPrimary } from '../buttonStyles.ts';
import { classNames } from '../filters/inventoryFunctions.ts';
import { createCSGOImage } from '../../../../functionsClasses/createCSGOImage.ts';
import { selectModalRename } from 'renderer/store/slices/modalRename.ts';

export default function RenameModal() {

  const dispatch = useDispatch();
  const modalData = useSelector(selectModalRename);

  async function renameStorageUnit(newName: string) {
    console.log(modalData.modalPayload.itemID, newName);
    await window.electron.ipcRenderer.renameStorageUnit(
      modalData.modalPayload.itemID,
      newName
    );
    dispatch(closeMoveModal());
  }
  renameStorageUnit


  const [inputState, setInputState] = useState('');
  return (
    <Transition show={modalData.renameOpen} as={Fragment}>
      <Dialog
        as="div"
        className="fixed z-10 inset-0 overflow-y-auto"
        onClose={() => dispatch(closeMoveModal())}
      >
        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <DialogBackdrop className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-opacity-85 transition-opacity" />
          </TransitionChild>
          
          {/* This element is to trick the browser into centering the modal contents. */}
          <span
            className="hidden sm:inline-block sm:align-middle sm:h-screen"
            aria-hidden="true"
          >
            &#8203;
          </span>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <div className="inline-block align-bottom dark:bg-dark-level-two bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <div className="mx-auto flex items-center justify-center h-16 w-16">
                  <img
                    className="w-16 text-green-600"
                    src={
                      createCSGOImage("econ/tools/casket")
                    }
                  ></img>
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <DialogTitle
                    as="h3"
                    className="text-lg leading-6 font-medium text-gray-900 dark:text-dark-white"
                  ></DialogTitle>
                  <div className="pl-20 pr-20 mt-2">
                    <div className="relative border border-gray-300 rounded-md px-3 py-2 shadow-xs focus-within:ring-1 focus-within:ring-kryo-ice-400 focus-within:border-kryo-ice-400 dark:focus-within:ring-kryo-ice-500 dark:focus-within:border-kryo-ice-500">
                      <label
                        htmlFor="name"
                        className="absolute -top-2 left-2 -mt-px inline-block px-1 bg-white dark:bg-dark-level-two text-xs font-medium text-gray-900 dark:text-dark-white"
                      >
                        New name
                      </label>
                      <input
                        type="text"
                        name="name"
                        id="name"
                        className="block w-full border-0 p-0 focus:outline-none text-gray-900 placeholder-gray-500 focus:ring-0 sm:text-sm dark:bg-dark-level-two dark:text-dark-white"
                        placeholder={modalData.modalPayload.itemName}
                        onChange={(e) => setInputState(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="button"
                  className={classNames(
                    btnPrimary,
                    'w-full px-4 py-2 sm:col-start-2 sm:text-sm',
                    inputState.length === 0 && 'pointer-events-none opacity-50'
                  )}
                  onClick={() => renameStorageUnit(inputState)}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className={classNames(btnDefault, 'mt-3 w-full px-4 py-2 sm:mt-0 sm:col-start-1 sm:text-sm')}
                  onClick={() => dispatch(closeMoveModal())}
                >
                  Cancel
                </button>
              </div>
            </div>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
