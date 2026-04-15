import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Settings, Inventory, ModalMove } from 'renderer/interfaces/states.ts'; // Adjust path to your state interfaces
import { AppDispatch } from '@/store/configureStore.ts';
import { handleUserEvent } from '@/store/handleMessage.ts';
import { selectAuth } from '@/store/slices/auth.ts';
import { normalizeUserEventMessage } from './userEventMessage.ts';

// Define expected message shape (refine based on handleUserEvent signature)
type UserEventMessage = any[]; // E.g., [eventType: number, ...data]

type HandleFilterDataFn = (combinedInventory: Inventory['combinedInventory']) => Promise<void>;

/**
 * Custom hook to listen for 'userEvents' IPC events and signal renderer readiness.
 * Processes user events, dispatches actions, and filters inventory.
 * @param settingsRef - Ref to settings object
 * @param modalData - Modal data for blocking commands
 * @param handleFilterData - Callback to filter inventory data
 */
export const useIpcUserEvents = (
  settingsRef: React.RefObject<Settings>,
  modalData: ModalMove,
  handleFilterData?: HandleFilterDataFn
) => {
  const dispatch = useDispatch<AppDispatch>();
  const isLoggedIn = useSelector(selectAuth).isLoggedIn;
  const isMounted = useRef(true);
  const modalRef = useRef(modalData);
  const handleFilterDataRef = useRef(handleFilterData);

  // Keep latest values without re-subscribing IPC.
  useEffect(() => {
    modalRef.current = modalData;
  }, [modalData]);
  useEffect(() => {
    handleFilterDataRef.current = handleFilterData;
  }, [handleFilterData]);

  useEffect(() => {
    const ipcAny = window.electron.ipcRenderer as any;

    // Signal renderer-ready on first mount
    if (isMounted.current) {
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('Sending renderer-ready, Time:', new Date().toISOString());
        }
        window.electron.ipcRenderer.send('renderer-ready');
      } catch (err) {
        console.error('Failed to send renderer-ready:', err);
      }
    }

    // Skip listener if not logged in
    if (!isLoggedIn) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Skipping userEvents listener: not logged in, Time:', new Date().toISOString());
      }
      return;
    }

    const listener = async (...args: UserEventMessage) => {
      const message = normalizeUserEventMessage(args);
      if (process.env.NODE_ENV === 'development') {
        console.log(
          'Received userEvents args:',
          message,
          'Is loggedIn:',
          isLoggedIn,
          'Mounted:',
          isMounted.current,
          'Time:',
          new Date().toISOString()
        );
      }

      // Block commands if fastMove and modal query active
      if (settingsRef.current.fastMove && modalRef.current.query.length > 0) {
        console.log('Command blocked', modalData.moveOpen, settingsRef.current.fastMove);
        return;
      }

      // Validate message
      if (!message || !Array.isArray(message)) {
        console.warn('Invalid userEvents message format:', message);
        return;
      }

      try {
        window.electron.ipcRenderer.debugLog('userEvents:received', {
          firstArgType: typeof message[0],
          firstArgIsArray: Array.isArray(message[0]),
          argCount: message.length,
          statusCode: message[0],
          description: message[1],
        });
        const actionToTake = await handleUserEvent(message, settingsRef.current);
        if (actionToTake) {
          const payload = (actionToTake as any).payload;
          window.electron.ipcRenderer.debugLog('userEvents:dispatch', {
            actionType: (actionToTake as any).type,
            inventoryCount: payload?.inventory?.length ?? -1,
            combinedCount: payload?.combinedInventory?.length ?? -1,
          });
          dispatch(actionToTake);
          // Defer filter/sort to the next task so inventory can commit and the UI can stay responsive.
          if (message[0] === 1 && handleFilterDataRef.current) {
            const inv = (actionToTake.payload as any)?.combinedInventory || [];
            window.setTimeout(() => {
              void handleFilterDataRef.current?.(inv);
            }, 0);
          }
        }
      } catch (error) {
        window.electron.ipcRenderer.debugLog('userEvents:error', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : null,
          statusCode: message?.[0],
          description: message?.[1],
        });
        console.error('Error processing userEvent:', error);
      }
    };

    // Attach listener
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(
          'Setting up userEvents listener, Is loggedIn:',
          isLoggedIn,
          'Mounted:',
          isMounted.current,
          'Time:',
          new Date().toISOString()
        );
      }
      window.electron.ipcRenderer.on('userEvents', listener);
    } catch (err) {
      console.error('Failed to attach userEvents listener:', err);
    }

    // Cleanup
    return () => {
      isMounted.current = false;
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log(
            'Removing userEvents listener, Is loggedIn:',
            isLoggedIn,
            'Mounted:',
            isMounted.current,
            'Time:',
            new Date().toISOString()
          );
        }
        if (typeof ipcAny.off === 'function') ipcAny.off('userEvents', listener);
        else if (typeof ipcAny.removeListener === 'function') ipcAny.removeListener('userEvents', listener);
        else if (typeof ipcAny.removeUserEvents === 'function') ipcAny.removeUserEvents('userEvents', listener);
      } catch (err) {
        console.warn('Cleanup failed for userEvents listener:', err);
      }
    };
  }, [isLoggedIn, settingsRef, dispatch]);
};
