import { describe, expect, it } from '@jest/globals';

import { evaluateTradeupExecutionPolicy } from '../main/helpers/tradeupExecutionPolicy.ts';

describe('tradeupExecutionPolicy', () => {
  it('forces dry run when env dry run is enabled', () => {
    expect(
      evaluateTradeupExecutionPolicy({
        envDry: true,
        simulateOnly: false,
        isDev: false,
        allowRealInDev: false,
        ignoreSimulateOnly: false,
      }),
    ).toEqual({
      mode: 'dry_run',
      reason: 'simulate_only',
    });
  });

  it('forces dry run in development without explicit real opt-in', () => {
    expect(
      evaluateTradeupExecutionPolicy({
        envDry: false,
        simulateOnly: false,
        isDev: true,
        allowRealInDev: false,
        ignoreSimulateOnly: false,
      }),
    ).toEqual({
      mode: 'dry_run',
      reason: 'development_guard',
    });
  });

  it('allows real execution only when all guards pass', () => {
    expect(
      evaluateTradeupExecutionPolicy({
        envDry: false,
        simulateOnly: false,
        isDev: false,
        allowRealInDev: false,
        ignoreSimulateOnly: false,
      }),
    ).toEqual({
      mode: 'execute',
    });
  });

  it('allows bridge execution when simulate_only is enabled but explicitly ignored', () => {
    expect(
      evaluateTradeupExecutionPolicy({
        envDry: false,
        simulateOnly: true,
        isDev: false,
        allowRealInDev: false,
        ignoreSimulateOnly: true,
      }),
    ).toEqual({
      mode: 'execute',
    });
  });
});
