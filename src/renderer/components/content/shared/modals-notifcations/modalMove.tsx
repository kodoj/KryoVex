/* This example requires Tailwind CSS v2.0+ */
import { Fragment, useEffect } from 'react';
import { Dialog, DialogBackdrop, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { useDispatch, useSelector } from 'react-redux';
import {
  moveModalCancel,
  closeMoveModal,
  modalResetStorageIdsToClearFrom,
  modalAddToFailed,
  moveModalResetPayload,
  moveModalUpdate,
  moveModalDismissFailureSummary,
  selectModalMove,
} from 'renderer/store/slices/modalMove.ts';
import { moveToClearAll } from 'renderer/store/slices/moveTo.ts';
import { moveFromClearAll } from 'renderer/store/slices/moveFrom.ts';
import { clearAllStorageUnits, clearStorageUnitItems } from 'renderer/store/slices/inventory.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';
import { btnDefault, btnPrimary } from 'renderer/components/content/shared/buttonStyles.ts';
import { classNames } from 'renderer/components/content/shared/filters/inventoryFunctions.ts';

const waitTime = 100;
/** Cap wait for GC confirmation so a missing/stale item cannot leave the modal open indefinitely. */
const MOVE_IPC_TIMEOUT_MS = 12000;

export default function MoveModal() {
  const dispatch = useDispatch();
  const modalData = useSelector(selectModalMove);
  const settingsData = useSelector(selectSettings);

  async function cancelMe() {
    window.electron.ipcRenderer.refreshInventory();
    dispatch(closeMoveModal());
    const batchKey = modalData.modalPayload?.['key'];
    if (batchKey != null && batchKey !== '') {
      dispatch(moveModalCancel({ doCancel: String(batchKey) }));
    }
    dispatch(closeMoveModal());
    const t = modalData.modalPayload?.['type'];
    if (t === 'to') {
      dispatch(moveToClearAll());
    }
    if (t === 'from') {
      dispatch(moveFromClearAll());
    }
    dispatch(modalResetStorageIdsToClearFrom());
    dispatch(moveModalResetPayload());
  }

  const fastMode = settingsData.fastMove;

  /**
   * Run each IPC step in an effect with a per-instance `aborted` flag.
   * React 18 Strict Mode runs cleanup synchronously before the second mount; a shared `cancelled`
   * ref or skipping the second effect caused `moveModalUpdate` to never run → modal stuck on the blue circle.
   */
  useEffect(() => {
    if (!modalData.moveOpen) {
      return;
    }
    const p = modalData.modalPayload as Record<string, any>;
    if (!p?.itemID || p.itemID === '') {
      return;
    }
    if (modalData.doCancel.includes(p.key)) {
      return;
    }

    let aborted = false;
    const qLenAtStart = modalData.query.length;

    void (async () => {
      const moveWithDeadline = (promise: Promise<unknown>) =>
        Promise.race([
          promise,
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error('move-timeout')), MOVE_IPC_TIMEOUT_MS)
          ),
        ]);

      try {
        if (aborted) return;

        if (p.type === 'to') {
          if (fastMode && qLenAtStart > 1) {
            window.electron.ipcRenderer.moveToStorageUnit(p.storageID, p.itemID, true);
            await new Promise((r) => setTimeout(r, waitTime));
          } else {
            try {
              await moveWithDeadline(
                window.electron.ipcRenderer.moveToStorageUnit(p.storageID, p.itemID, false)
              );
            } catch {
              if (!aborted) dispatch(modalAddToFailed());
            }
          }
        } else if (p.type === 'from') {
          if (fastMode) {
            window.electron.ipcRenderer.moveFromStorageUnit(p.storageID, p.itemID, true);
            await new Promise((r) => setTimeout(r, waitTime));
          } else {
            try {
              await moveWithDeadline(
                window.electron.ipcRenderer.moveFromStorageUnit(p.storageID, p.itemID, false)
              );
            } catch {
              if (!aborted) dispatch(modalAddToFailed());
            }
          }
        }
      } catch {
        if (!aborted) dispatch(modalAddToFailed());
      } finally {
        if (aborted) return;
        dispatch(moveModalUpdate());
        if (p.type === 'to' && p.isLast) {
          dispatch(moveToClearAll());
        }
        if (p.isLast) {
          const sid = p.storageID != null ? String(p.storageID) : '';
          const refresh = () => window.electron.ipcRenderer.refreshInventory();
          refresh();
          window.setTimeout(refresh, 450);
          window.setTimeout(refresh, 1400);
          window.setTimeout(refresh, 3000);
          if (p.type === 'from') {
            dispatch(moveFromClearAll());
            dispatch(clearAllStorageUnits());
          } else if (p.type === 'to' && sid !== '') {
            dispatch(clearStorageUnitItems({ casketID: sid }));
          }
        }
      }
    })();

    return () => {
      aborted = true;
    };
  }, [
    modalData.moveOpen,
    modalData.modalPayload,
    modalData.doCancel,
    modalData.query.length,
    fastMode,
    dispatch,
  ]);

  const devMode = false;
  const failureSummaryOnly =
    !modalData.moveOpen && modalData.totalFailed > 0;
  const hideByCancelKey =
    modalData.modalPayload?.['key'] != null &&
    modalData.modalPayload['key'] !== '' &&
    modalData.doCancel.includes(modalData.modalPayload['key']);

  const showMoveModal =
    !hideByCancelKey &&
    (failureSummaryOnly ||
      modalData.moveOpen ||
      (devMode && Object.keys(modalData.modalPayload ?? {}).length === 0));

  function dismissFailureSummary() {
    window.electron.ipcRenderer.refreshInventory();
    dispatch(moveModalDismissFailureSummary());
  }

  return (
    <Transition show={showMoveModal} as={Fragment}>
      <Dialog
        as="div"
        className="fixed z-10 inset-0 overflow-y-auto"
        onClose={() =>
          failureSummaryOnly ? dismissFailureSummary() : cancelMe()
        }
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
            <div className="inline-block align-bottom bg-white dark:bg-dark-level-two rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm sm:w-full sm:p-6">
              <div>
                {failureSummaryOnly ? (
                  <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-100 dark:bg-red-900/40">
                    <span
                      className="text-2xl text-red-600 dark:text-red-400"
                      aria-hidden
                    >
                      ✕
                    </span>
                  </div>
                ) : (
                  <div className="mx-auto flex items-center  justify-center h-14 w-14 rounded-full bg-blue-500 dark:bg-blue-700">
                    <span className="animate-ping absolute inline-flex h-14 w-14 rounded-full dark:bg-blue-700 opacity-75"></span>
                    <span className="text-white dark:text-dark-white">
                      {modalData.modalPayload?.['number']}
                    </span>
                  </div>
                )}
                <div className="mt-3 text-center sm:mt-5">
                  <DialogTitle
                    as="h3"
                    className="text-lg leading-6 font-medium text-gray-900 dark:text-dark-white"
                  >
                    {failureSummaryOnly
                      ? 'Some moves did not complete'
                      : modalData.modalPayload?.['name']}
                  </DialogTitle>
                  <div className="mt-2">
                    {failureSummaryOnly ? (
                      <>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {modalData.totalFailed}{' '}
                          {modalData.totalFailed === 1 ? 'item' : 'items'} could
                          not be moved. Common causes are Steam or the CS2 game
                          coordinator timing out, or the item no longer being in
                          the expected place.
                        </p>
                        {!fastMode ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            If this happens often, try enabling fast move in
                            settings (smaller delay between steps).
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Please wait while the app moves your items.
                          {fastMode == false
                            ? ' Want to speed this up? Enable fast move in settings.'
                            : ''}
                        </p>
                        {modalData.totalFailed > 0 ? (
                          <p className="text-sm text-red-500 mt-2">
                            Failed so far: {modalData.totalFailed}
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 sm:mt-6">
                {failureSummaryOnly ? (
                  <button
                    type="button"
                    className={classNames(btnPrimary, 'w-full px-4 py-2 sm:text-sm')}
                    onClick={() => dismissFailureSummary()}
                  >
                    OK
                  </button>
                ) : (
                  <button
                    type="button"
                    className={classNames(btnDefault, 'mt-3 w-full px-4 py-2 sm:mt-0 sm:col-start-1 sm:text-sm')}
                    onClick={() => cancelMe()}
                  >
                    Cancel
                  </button>
                )}
              </div>
              <div className="flex flex-wrap content-center items-center justify-center mr-3 mt-2 text-gray-400 dark:text-dark-white text-xs font-medium uppercase tracking-wide">

          {/* This element is to trick the browser into centering the modal contents.
            <div>
              ENABLE FAST MODE
            </div> */}




          </div>
            </div>

          </TransitionChild>

        </div>
      </Dialog>
    </Transition>
  );
}
