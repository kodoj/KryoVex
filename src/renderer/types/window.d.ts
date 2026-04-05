import { IpcRenderer } from 'electron';

declare global {
  interface Window {
    electron?: {  // Optional to avoid undefined errors
      ipcRenderer: IpcRenderer;
      // Add exposed methods, e.g.:
      // send: (channel: string, ...args: any[]) => void;
      // on: (channel: string, listener: (...args: any[]) => void) => void;
      // ...infer from your preload.ts exposures
    };
  }
}