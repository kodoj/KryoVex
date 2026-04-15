import http from 'node:http';
import { URL } from 'node:url';

export type CodexTradeupRequest = {
  assetIds: string[];
  rarity: number;
};

const RARITY_HEX: Record<number, string> = {
  0: '00000A00',
  1: '01000A00',
  2: '02000A00',
  3: '03000A00',
  4: '04000A00',
  10: '0a000a00',
  11: '0b000a00',
  12: '0c000a00',
  13: '0d000a00',
  14: '0e000a00',
};

export function buildCraftPayload(assetIds: string[], rarity: number) {
  return {
    assetIds,
    rarity,
    rarityHex: RARITY_HEX[rarity],
  };
}

export function startCodexTradeupBridge(
  sendCraft: (assetIds: string[], rarity: number) => Promise<void>,
) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (req.method !== 'POST' || url.pathname !== '/codex/tradeup') {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'not_found' }));
      return;
    }

    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }

      const payload = JSON.parse(
        Buffer.concat(chunks).toString('utf-8'),
      ) as CodexTradeupRequest;
      const craftPayload = buildCraftPayload(payload.assetIds, payload.rarity);
      if (!craftPayload.rarityHex) {
        throw new Error(`Unsupported rarity code: ${payload.rarity}`);
      }

      await sendCraft(payload.assetIds, payload.rarity);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  });

  server.listen(4761, '127.0.0.1');
  return server;
}
