import { createCSGOImage } from "../../functionsClasses/createCSGOImage.ts";

export async function getURL(steamID: string): Promise<string> {
  const defaultReturnString = createCSGOImage("econ/characters/customplayer_tm_separatist");
  try {
    const imageURL = await window.electron.ipcRenderer.invoke('get-steam-profile-image', steamID);
    return imageURL || defaultReturnString;
  } catch (error) {
    console.error('Error fetching Steam profile image via IPC:', error);
    return defaultReturnString;
  }
}