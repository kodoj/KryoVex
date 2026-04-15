import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../main/helpers/classes/steam/settings.ts', () => ({
  getValue: jest.fn(() =>
    Promise.resolve({
      broken_user: {
        safeData: 'present',
      },
    }),
  ),
  getLoginDetails: jest.fn(() => Promise.reject(new Error('decrypt failed'))),
  getRefreshToken: jest.fn(),
}));

jest.mock('../main/helpers/login/loginRegular.tsx', () => ({
  flowLoginRegular: jest.fn(),
}));

jest.mock('../main/helpers/classes/IPCGenerators/loginGenerator.tsx', () => ({
  LoginGenerator: class LoginGenerator {
    returnValue = {
      responseStatus: 'defaultError',
      returnPackage: {},
    };

    setResponseStatus(responseStatus: string) {
      this.returnValue.responseStatus = responseStatus;
    }

    setEmptyPackage() {
      this.returnValue.returnPackage = {};
    }

    setPackage(returnPackage: {}) {
      this.returnValue.returnPackage = returnPackage;
    }
  },
}));

import { login } from '../main/helpers/classes/steam/steam.ts';

describe('login', () => {
  it('returns defaultError when remembered safe data lookup rejects', async () => {
    const loginClass = new login();
    const fakeSteamUser = {
      once: jest.fn(),
      logOn: jest.fn(),
    };

    const result = await loginClass.mainLogin(
      fakeSteamUser,
      'broken_user',
      true,
      null,
      null,
      null,
      null,
      null,
    );

    expect(result).toEqual({
      responseStatus: 'defaultError',
      returnPackage: {},
    });
  });
});
