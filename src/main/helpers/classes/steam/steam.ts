import { StartLoginSessionWithCredentialsDetails } from 'steam-session/dist/interfaces-external.js';
import SteamTotp from 'steam-totp';
import { flowLoginRegular } from '../../login/loginRegular.tsx';
import { LoginGenerator } from '../IPCGenerators/loginGenerator.tsx';
import { LoginOptions } from '../../../../shared/Interfaces-tsx/store.ts';
import {
  getLoginDetails,
  getRefreshToken,
  getValue
} from './settings.ts';

const ClassLoginResponse = new LoginGenerator();
// 1: If the user has remembered the account, check if login key exists. If login fails, notify renderer, delete Loginkey (not password)
class login {
  steamUser = {} as any;
  rememberedDetails = {} as any;
  rememberedSensitive = {} as any;
  password;
  username;
  steamGuard;
  secretKey;
  clientjstoken;
  refreshToken: string | null = null;
  shouldRemember = false;
  logInOptions: StartLoginSessionWithCredentialsDetails = {
    accountName: '',
    password: '',
  };
  loginOptionsLegacy = {} as any;
  resolve;

  _failLogin(responseStatus: keyof LoginOptions = 'defaultError') {
    ClassLoginResponse.setEmptyPackage();
    ClassLoginResponse.setResponseStatus(responseStatus);
    this._returnToSender();
  }



  mainLogin(
    steamuser,
    username,
    shouldRemember,
    password = null,
    steamGuard = null,
    secretKey = null,
    clientjstoken = null,
    refreshToken: string | null = null
  ) {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.username = username;
      this.password = password;
      this.shouldRemember = shouldRemember;
      this.steamGuard = steamGuard;
      this.secretKey = secretKey;
      this.steamUser = steamuser;
      this.clientjstoken = clientjstoken;
      this.refreshToken = refreshToken;


      // Get all account details
      getValue('account')
        .then((returnValue) => {
          if (returnValue?.[username]) {
            this.rememberedDetails = returnValue?.[username];
            if (returnValue?.[username].safeData) {
              // Get remembered details
              getLoginDetails(username)
                .then((rememberedValue) => {
                  if (rememberedValue) {
                    this.rememberedSensitive = rememberedValue;
                  }
                  this._loginCoordinator();
                })
                .catch((error) => {
                  console.error('[login] getLoginDetails failed', error);
                  this._failLogin();
                });
              return;
            }
          }

          // Start login
          this._loginCoordinator();
        })
        .catch((error) => {
          console.error('[login] getValue(account) failed', error);
          this._failLogin();
        });
    });
  }

  _loginCoordinator() {
    // 0
    if (this.clientjstoken) {
      this._login_clientjstoken();
      return;
    }

    // 3
    if (this.steamGuard) {
      this._login_steamGuard();
      return;
    }

    // 1
    if (this.rememberedDetails['refreshToken'] || this.refreshToken) {
      this._login_refreshToken();
      return;
    }
    if (!this.password && !this.rememberedSensitive?.password) {
      ClassLoginResponse.setEmptyPackage();
      ClassLoginResponse.setResponseStatus('defaultError');
      this._returnToSender();
      return;
    }

    // 2
    if (this.rememberedSensitive?.secretKey) {
      this._login_secretKey();
      return;
    }

    this._login_password();
    return;
  }

  _returnToSender() {
    this.resolve(ClassLoginResponse.returnValue);
  }

  // Login functions
  _loginStartLegacy() {
    this.steamUser.logOn(this.loginOptionsLegacy);
  }

  _loginStart() {
    flowLoginRegular(this.logInOptions, this.shouldRemember)
      .then((returnValue) => {
        if (returnValue.responseStatus == 'loggedIn') {
          this.steamUser.logOn({
            refreshToken: returnValue.refreshToken,
          });
        } else {
          this._failLogin(returnValue.responseStatus);
        }
      })
      .catch((error) => {
        console.error('[login] flowLoginRegular failed', error);
        this._failLogin();
      });
  }

  _defaultError() {
    this.steamUser.once('error', (error) => {
      if (error == 'Error: LoggedInElsewhere') {
        this._failLogin('playingElsewhere');
      } else {
        this._failLogin();
      }
    });
  }
  // 0 - Client
  _login_clientjstoken() {
    this._defaultError();
    this.loginOptionsLegacy = {
      accountName: this.clientjstoken?.account_name,
      webLogonToken: this.clientjstoken?.token,
      steamID: this.clientjstoken?.steamid,
    };
    this._loginStartLegacy();
  }

  // 1 - Login key
  _login_refreshToken() {
    // Prefer a refresh token passed in (e.g. QR login), otherwise fall back to stored token.
    if (this.refreshToken) {
      this.loginOptionsLegacy = { refreshToken: this.refreshToken };
      this._loginStartLegacy();
      return;
    }
    getRefreshToken(this.username)
      .then((refreshToken) => {
        this.loginOptionsLegacy = { refreshToken };
        this._loginStartLegacy();
      })
      .catch((error) => {
        console.error('[login] getRefreshToken failed', error);
        this._failLogin();
      });
  }

  // 2 - Shared Secret
  _login_secretKey() {
    this._defaultError();
    this.shouldRemember = true;
    this.logInOptions = {
      accountName: this.username,
      password: this.password,
      steamGuardCode: SteamTotp.generateAuthCode(
        this.rememberedSensitive?.secretKey
      ),
    };
    this._loginStart();
  }

  // 3 - Steam Guard
  _login_steamGuard() {
    this._defaultError();
    this.logInOptions = {
      accountName: this.username,
      password: this.password,
      steamGuardCode: this.steamGuard,
    };
    this._loginStart();
  }

  // 4 - No authcode
  _login_password() {
    this._defaultError();
    this.logInOptions = {
      accountName: this.username,
      password: this.password,
    };
    this._loginStart();
  }
}
export { login };
