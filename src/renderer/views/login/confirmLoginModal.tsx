/* This example requires Tailwind CSS v2.0+ */
import { Fragment } from 'react'
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import {  XMarkIcon } from '@heroicons/react/24/outline'
import { ArrowRightEndOnRectangleIcon } from '@heroicons/react/24/solid'
import { handleSuccess } from './HandleSuccess.ts'
import { LoginCommand, LoginCommandReturnPackage } from 'shared/Interfaces-tsx/store.ts'
import { useDispatch } from 'react-redux'
import { btnDefault, btnIcon, btnPrimary } from 'renderer/components/content/shared/buttonStyles.ts'
import { classNames } from 'renderer/components/content/shared/filters/inventoryFunctions.ts'

export default function ConfirmModal({open, setOpen, setLoadingButton}) {
  const dispatch = useDispatch();
  async function confirm() {
    setLoadingButton(true)
    setOpen(false)
    window.electron.ipcRenderer.forceLogin()
    let responseStatus: LoginCommand = await window.electron.ipcRenderer.invoke('forceLoginReply');
    handleSuccess(responseStatus.returnPackage as LoginCommandReturnPackage, dispatch)
  }

  async function cancel() {
    window.electron.ipcRenderer.logUserOut();
    setLoadingButton(false)
    setOpen(false)
  }

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={() => cancel()}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </TransitionChild>

        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end sm:items-center justify-center min-h-full p-4 text-center sm:p-0">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <DialogPanel className="relative bg-dark-level-three px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-lg sm:w-full sm:p-6">
                <div className="hidden sm:block absolute top-0 right-0 pt-4 pr-4">
                  <button
                    type="button"
                    className={classNames(btnIcon, 'border-transparent bg-transparent p-1 text-gray-400 hover:bg-dark-level-four')}
                    onClick={() => cancel()}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-500 sm:mx-0 sm:h-10 sm:w-10">
                    <ArrowRightEndOnRectangleIcon className="h-6 w-6 text-green-700" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <DialogTitle as="h3" className="text-lg leading-6 font-medium text-dark-white">
                      Confirm Logon
                    </DialogTitle>
                    <div className="mt-2">
                      <p className="text-sm text-gray-400">
                        Your account is currently playing a game elsewhere. Would you like login here instead? This will log out the other instance.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    className={classNames(btnPrimary, 'mt-3 w-full px-4 py-2 sm:mt-0 sm:w-auto sm:text-sm')}
                    onClick={() => confirm()}
                  >
                    Log in
                  </button>
                  <button
                    type="button"
                    className={classNames(btnDefault, 'mt-3 w-full px-4 py-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm')}
                    onClick={() => cancel()}
                  >
                    Cancel
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
