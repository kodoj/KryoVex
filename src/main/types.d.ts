import SteamUserBase from 'steam-user';
import GlobalOffensiveBase from 'globaloffensive';
import { EventEmitter } from 'events';
// Extend SteamUser to include missing methods/props
interface SteamUser extends SteamUserBase, EventEmitter {
  once(event: string, listener: (...args: any[]) => void): this;
  gamesPlayed(appIDs: number | number[], force?: boolean): void;
  logOff(): void;
  requestFreeLicense(appIDs: number[], callback: (err: Error | null, grantedPackages: number[], grantedAppIDs: number[]) => void): void;
  logOnResult: { client_supplied_steamid: string };
}

// Extend GlobalOffensive
interface GlobalOffensive extends GlobalOffensiveBase, EventEmitter {
  once(event: string, listener: (...args: any[]) => void): this;
  inventory: any[];
  haveGCSession: boolean;
  _send(type: number, proto: any | null, body: any): Promise<void>;
}

// Static props on GlobalOffensive
declare namespace GlobalOffensive {
  const ItemCustomizationNotification: {
    NameItem: number;
    CasketRemoved: number;
    CasketAdded: number;
  };
}