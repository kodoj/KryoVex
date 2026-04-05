import { WalletInterface } from "../states.ts";

export interface SignInActionPackage {
  displayName: string
  CSGOConnection: boolean
  userProfilePicture: string
  steamID: string
  wallet: WalletInterface
}
