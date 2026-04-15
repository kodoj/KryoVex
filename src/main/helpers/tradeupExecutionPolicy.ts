export type TradeupExecutionPolicyInput = {
  envDry: boolean;
  simulateOnly: boolean;
  isDev: boolean;
  allowRealInDev: boolean;
  ignoreSimulateOnly: boolean;
};

export type TradeupExecutionPolicyResult =
  | { mode: 'dry_run'; reason: 'simulate_only' | 'development_guard' }
  | { mode: 'execute' };

export function evaluateTradeupExecutionPolicy(
  input: TradeupExecutionPolicyInput,
): TradeupExecutionPolicyResult {
  if (input.envDry || (input.simulateOnly && !input.ignoreSimulateOnly)) {
    return { mode: 'dry_run', reason: 'simulate_only' };
  }

  if (input.isDev && !input.allowRealInDev) {
    return { mode: 'dry_run', reason: 'development_guard' };
  }

  return { mode: 'execute' };
}
