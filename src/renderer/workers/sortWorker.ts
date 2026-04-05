type SortWorkerRequest =
  | {
      id: number;
      kind: 'number';
      keys: number[];
      tie: string[];
      ids: string[];
    }
  | {
      id: number;
      kind: 'string';
      keys: string[];
      tie: string[];
      ids: string[];
    };

type SortWorkerResponse = { id: number; indices: number[] };

function cmpString(a: string, b: string) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function cmpNumber(a: number, b: number) {
  // Normalize NaN to very low value
  const aa = Number.isFinite(a) ? a : -9e10;
  const bb = Number.isFinite(b) ? b : -9e10;
  if (aa === bb) return 0;
  return aa < bb ? -1 : 1;
}

self.onmessage = (ev: MessageEvent<SortWorkerRequest>) => {
  const msg = ev.data;
  const n = msg.keys.length;
  const indices = Array.from({ length: n }, (_, i) => i);

  if (msg.kind === 'number') {
    const keys = msg.keys;
    const tie = msg.tie;
    const ids = msg.ids;
    indices.sort((ia, ib) => {
      const c = cmpNumber(keys[ia], keys[ib]);
      if (c !== 0) return c;
      const t = cmpString(tie[ia] ?? '', tie[ib] ?? '');
      if (t !== 0) return t;
      return cmpString(ids[ia] ?? '', ids[ib] ?? '');
    });
  } else {
    const keys = msg.keys;
    const tie = msg.tie;
    const ids = msg.ids;
    indices.sort((ia, ib) => {
      const c = cmpString(keys[ia] ?? '', keys[ib] ?? '');
      if (c !== 0) return c;
      const t = cmpString(tie[ia] ?? '', tie[ib] ?? '');
      if (t !== 0) return t;
      return cmpString(ids[ia] ?? '', ids[ib] ?? '');
    });
  }

  const res: SortWorkerResponse = { id: msg.id, indices };
  (self as any).postMessage(res);
};

