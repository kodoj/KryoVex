import { CheckIcon, TrashIcon } from '@heroicons/react/24/solid';
import { useEffect, useState } from 'react';
import { btnIcon, btnMenuItem, btnMenuItemDanger } from 'renderer/components/content/shared/buttonStyles.ts';
import { classNames } from 'renderer/components/content/shared/filters/inventoryFunctions.ts';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function UserGrid({ clickOnProfile, deleteUser,  runDeleteUser }) {
  const [getUsers, setUsers] = useState([] as any);
  const [ctxMenu, setCtxMenu] = useState<null | { x: number; y: number; user: any }>(null);

  // The brain
  async function updateFunction() {
    let finalList = [] as any;
    let seenValues = [] as any

    // Get the account details
    let doUpdate = await window.electron.ipcRenderer.getAccountDetails();
    if (doUpdate == undefined) {
      doUpdate = {};
    }

    // Get the order of the account details
    let valueToUse = [] as any;
    const returnValue = await window.electron.store.get('accountKeyList');
    valueToUse = returnValue || [];

    // Conditional logic
    if (valueToUse != undefined) {
      valueToUse.forEach(element => {
        if (seenValues.includes(element) == false) {
          seenValues.push(element)
        }
      });
      for (const [key, value] of Object.entries(doUpdate)) {
        let userObject = value as any;
        userObject['username'] = key;
        if (!seenValues.includes(userObject['username'])) {
          finalList.push(userObject);
        }
      }
      seenValues.reverse()
      seenValues.forEach(element => {
        if (doUpdate[element] != undefined) {
          let userObject = doUpdate[element] as any;
          userObject['username'] = element;
          finalList.splice(0, 0, userObject)
        }

      });
    } else {
      for (const [key, value] of Object.entries(doUpdate)) {
        let userObject = value as any;
        userObject['username'] = key;
        finalList.push(userObject);
      }
    }
    // Apply the account details
    setUsers(finalList)

  }
  // Run brain only once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await updateFunction();
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
      void cancelled;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remove account
  async function removeUsername(username) {
    window.electron.ipcRenderer.deleteAccountDetails(username);
    updateFunction();
  }
  useEffect(() => {
    if (!deleteUser) return;
    (async () => {
      try {
        await updateFunction();
      } finally {
        runDeleteUser();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteUser]);

  // Drag n drop features
  async function handleOnDragEnd(result) {
    // Check if actually moved
    if (!result.destination) return;
    const items = Array.from(getUsers);

    // Store change locally and in the settings
    window.electron.ipcRenderer.setAccountPosition(result.draggableId, result.destination.index)
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setUsers(items);

    // Storex for next session
    const orderToStore = [] as any;
    items.forEach(element => {
      let e = element as any
      orderToStore.push(e.username)

    });
    await window.electron.store.set('accountKeyList', orderToStore)
  }

  return (
    <div className="overflow-x-auto h-screen-fixed bg-gray-50 dark:bg-dark-level-two">
      <div className="grid grid-cols-1 py-10 px-4 gap-4 overflow-y-auto">
        <DragDropContext onDragEnd={handleOnDragEnd}>
          <Droppable droppableId="characters">
            {(provided) => (
              <ul className="characters" {...provided.droppableProps} ref={provided.innerRef}>
                {getUsers.length == 0 ? (
                  <li
                    className={classNames(
                      'relative rounded-lg border border-gray-300 border-dashed dark:bg-dark-level-four bg-white px-6 py-5 flex items-center space-x-3 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-kryo-ice-400'
                    )}
                  >
                    <div className="shrink-0">
                      <svg
                        className="w-10 h-10 rounded-full shrink-0 text-gray-300"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-white">
                        Nothing here
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        Login to add user
                      </p>
                    </div>
                  </li>
                ) : (
                  getUsers.map((person, index) => (
                    <Draggable
                      key={person.username}
                      draggableId={person.username}
                      index={index}
                      disableInteractiveElementBlocking
                    >
                      {(provided) => (
                      <li
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        onClick={() => clickOnProfile([person.username, person.refreshToken])}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setCtxMenu({ x: e.clientX, y: e.clientY, user: person });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            clickOnProfile([person.username, person.refreshToken]);
                          }
                        }}
                        tabIndex={0}
                        className={classNames(
                          index == 0 ? '' : 'mt-5',
                          'relative rounded-lg border dark:border-opacity-0 dark:border-none dark:bg-dark-level-four border-gray-300 bg-white px-6 py-5 shadow-xs flex items-center space-x-3 hover:border-gray-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-kryo-ice-400 cursor-pointer'
                        )}
                      >
                        <span
                          {...provided.dragHandleProps}
                          className="inline-flex h-8 w-4 items-center justify-center text-gray-400 dark:text-gray-500 cursor-grab active:cursor-grabbing select-none"
                          aria-label="Drag to reorder"
                          title="Drag to reorder"
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                        >
                          ⋮⋮
                        </span>
                        <div className="shrink-0">
                          <img
                            className="h-10 w-10 rounded-full"
                            src={person.imageURL}
                            alt=""
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-dark-white">
                            {person.displayName}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {person.username}
                          </p>
                        </div>
                        {!person.refreshToken ? (
                          <>
                            <button
                              type="button"
                              onClick={() => clickOnProfile([person.username, person.refreshToken])}
                              onMouseDown={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                              className={classNames(
                                btnIcon,
                                'rounded-full border-emerald-800/50 bg-emerald-950/30 p-1.5 text-emerald-100 hover:bg-emerald-900/50'
                              )}
                            >
                              <CheckIcon className="h-5 w-5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeUsername(person.username)}
                              onMouseDown={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                              className={classNames(
                                btnIcon,
                                'rounded-full border-red-900/50 bg-red-950/20 p-1.5 text-red-200 hover:bg-red-900/40'
                              )}
                            >
                              <TrashIcon className="h-5 w-5" aria-hidden="true" />
                            </button>
                          </>
                        ) : null}
                      </li>
                      )}
                    </Draggable>
                  ))
                )}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>

        {ctxMenu ? (
          <div
            className="fixed inset-0 z-50"
            onMouseDown={() => setCtxMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setCtxMenu(null);
            }}
          >
            <div
              className="fixed min-w-[10rem] rounded-md border border-gray-700 bg-dark-level-three shadow-lg p-1 text-sm text-dark-white"
              style={{ left: ctxMenu.x, top: ctxMenu.y }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={btnMenuItem}
                onClick={() => {
                  clickOnProfile([ctxMenu.user.username, ctxMenu.user.refreshToken]);
                  setCtxMenu(null);
                }}
              >
                Login
              </button>
              <button
                type="button"
                className={btnMenuItemDanger}
                onClick={() => {
                  removeUsername(ctxMenu.user.username);
                  setCtxMenu(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
