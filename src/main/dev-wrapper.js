import { register } from 'node:module';
import { URL } from 'node:url';

register(new URL('../../node_modules/tsx/dist/loader.mjs', import.meta.url).href);

import './main.ts';