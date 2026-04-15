type UserEventMessage = any[];

export function normalizeUserEventMessage(args: UserEventMessage): UserEventMessage {
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0];
  }
  return args;
}
