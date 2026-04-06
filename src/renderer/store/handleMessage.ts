import combineInventory from 'renderer/components/content/shared/filters/inventoryFunctions.ts';
import { setInventory as inventorySetInventory } from './slices/inventory.ts';
import { setConnection, setGc, signOut, setWalletBalance } from './slices/auth.ts'; // From authSlice
import { WalletInterface } from 'renderer/interfaces/states.ts';

export async function handleLogonSuccess(message: any) {
  console.log(message);
}
export async function handleUserEvent(message: any[], settings: any) { 
  const statusCode = message[0];
  const description = message[1];
  switch (statusCode) {
    case 1:
      const subMessage = message[2];
      // Yield one microtask so the UI can paint (tab switch / nav) before heavy combine work.
      await Promise.resolve();
      const combined = combineInventory(subMessage[1], settings);
      return inventorySetInventory({ inventory: subMessage[1], combinedInventory: combined });
    case 2:
      if (description === 'disconnected') {
        return setConnection({ hasConnection: false });
      }
      if (description === 'reconnected') {
        return setConnection({ hasConnection: true });
      }
      if (description === 'fatalError') {
        return signOut();
      }
      return;
    case 3:
      if (description === 'disconnectedFromGC') {
        return setGc({ CSGOConnection: false });
      } else {
        return setGc({ CSGOConnection: true });
      }
    case 4:
      return setWalletBalance(description as WalletInterface);
    default:
      return;
  }
}