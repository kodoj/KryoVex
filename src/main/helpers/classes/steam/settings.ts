import Store, { Schema } from 'electron-store';
import { safeStorage } from 'electron';
import axios from 'axios';
import { DOMParser } from '@xmldom/xmldom';

interface Account {
  position?: number;
  refreshToken?: string;
  safeData?: string;  // Encrypted data like login details
  displayName?: string;
  imageURL?: string;
}

// Define interface for your store shape
interface StoreSchema {
  account: Record<string, Account>;
  pricing: { currency: string; cache: Record<string, unknown> };
  os: string;
  devmode: boolean;
  fastmove: boolean;
}

const schema: Schema<StoreSchema> = {
  account: {
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: {
        position: { type: 'number' },
        refreshToken: { type: 'string' },
        safeData: { type: 'string' },
        displayName: { type: 'string' },
        imageURL: { type: 'string' },
      },
      required: [],
    },
  },
  pricing: {
    type: 'object',
    properties: {
      currency: { type: 'string' },
      cache: {
        type: 'object',
        additionalProperties: true,
      },
    },
    required: [],
  },
  os: { type: 'string' },
  devmode: { type: 'boolean' },
  fastmove: { type: 'boolean' },
};

const store = new Store({
  schema,
  /** electron-store filename stem; unchanged so existing Casemove/KryoVex upgrades keep encrypted accounts. */
  name: 'casemoveEnc',
  watch: true,
  encryptionKey: 'this_only_obfuscates',
  migrations: {
    '2.3.1': (store) => {
      if (typeof store.get('devmode') !== 'boolean') {
        store.set('devmode', false);
      }
      if (typeof store.get('fastmove') !== 'boolean') {
        store.set('fastmove', false);
      }
    }
  }
});

async function getURL(steamID: string): Promise<string | undefined> {
  try {
    const response = await axios.get(`https://steamcommunity.com/profiles/${steamID}/?xml=1`);
    const parser = new DOMParser();
    return parser
      .parseFromString(response.data, 'text/xml')
      .getElementsByTagName('profile')[0]
      ?.getElementsByTagName('avatarMedium')[0]?.childNodes[0]?.nodeValue ?? undefined;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Unknown error fetching URL');
    return undefined;
  }
}

// Store user data
async function storeRefreshToken(username: string, loginKey?: string) {
  // Get account details
  let accountDetails = store.get('account') as Record<string, Account> ?? {};
  if (!accountDetails[username]) {
    accountDetails[username] = {};
  }
  if (loginKey) {
    // Encrypt sensitive data
    const buffer = safeStorage.encryptString(loginKey);
    // Add to account details
    accountDetails[username].refreshToken = buffer.toString('latin1');
  } else {
    if (accountDetails[username]?.refreshToken) {
      delete accountDetails[username].refreshToken;
    }
  }
  // Set store
  console.log('saving refreshToken');
  store.set('account', accountDetails);
}

// Store user data
async function storeUserAccount(
  username: string,
  displayName: string,
  steamID: string,
  secretKey: string | null
) {
  // Get the profile picture
  let imageURL: string | undefined;
  try {
    imageURL = await getURL(steamID);
  } catch (error) {
    console.error(error);
  }
  // Get account details
  let accountDetails = store.get('account') as Record<string, Account> ?? {};
  if (!accountDetails[username]) {
    accountDetails[username] = {};
  }
  // Add to account details
  accountDetails[username].displayName = displayName;
  accountDetails[username].imageURL = imageURL;
  // Encrypt sensitive data
  if (secretKey) {
    const dictToWrite = {
      secretKey: secretKey,
    };
    const buffer = safeStorage.encryptString(JSON.stringify(dictToWrite));
    accountDetails[username].safeData = buffer.toString('latin1');
  }
  // Set store
  console.log('Saving regular');
  store.set('account', accountDetails);
}

async function setAccountPosition(username: string, newPosition: number) {
  let accountDetails = store.get('account') as Record<string, Account> ?? {};
  if (!accountDetails[username]) {
    accountDetails[username] = {};
  }
  // Add to account details
  accountDetails[username].position = newPosition;
  // Set store
  store.set('account', accountDetails);
}

// Delete user data
async function deleteUserData(username: string): Promise<number> {
  let statusCode = 0;
  // Get account details
  let accountDetails = store.get('account') as Record<string, Account>;
  if (
    typeof accountDetails === 'object' &&
    accountDetails &&
    Object.keys(accountDetails).includes(username)
  ) {
    delete accountDetails[username];
    store.set('account', accountDetails);
    statusCode = 1;
  }
  return statusCode;
}

// Get login details
async function getLoginDetails(username: string): Promise<any> {
  const account = store.get('account') as Record<string, Account> ?? {};
  const safeData = account[username]?.safeData ?? '';
  const secretData = safeStorage.decryptString(Buffer.from(safeData, 'latin1'));
  return JSON.parse(secretData);
}

// Get login details
async function getRefreshToken(username: string): Promise<string> {
  const account = store.get('account') as Record<string, Account> ?? {};
  const refreshToken = account[username]?.refreshToken ?? '';
  const secretData = safeStorage.decryptString(Buffer.from(refreshToken, 'latin1'));
  return secretData;
}

// Get all account details
async function getAllAccountDetails(): Promise<Record<string, Account> | undefined> {
  return store.get('account') as Record<string, Account> | undefined;
}

async function setValue(stringToSet: string, valueToSet: any): Promise<void> {
  store.set(stringToSet, valueToSet);
}

async function getValue(stringToGet: string): Promise<any> {
  return store.get(stringToGet);
}

export {
  storeUserAccount,
  getLoginDetails,
  getAllAccountDetails,
  deleteUserData,
  setAccountPosition,
  getRefreshToken,
  storeRefreshToken,
  setValue,
  getValue,
};