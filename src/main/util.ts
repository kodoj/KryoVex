/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import * as path from 'path';
import { URL, pathToFileURL } from 'url';

export let resolveHtmlPath: (htmlFileName: string) => string;

if (process.env.NODE_ENV === 'development') {
  const port = process.env.PORT || 1212;
  resolveHtmlPath = (htmlFileName: string) => {
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  };
} else {
  resolveHtmlPath = (htmlFileName: string) => {
    return pathToFileURL(
      path.join(__dirname, '../renderer/', htmlFileName),
    ).href;
  };
}
