import fs from 'fs';
import paths from '../configs/webpack.paths.ts';

if (!fs.existsSync(paths.srcNodeModulesPath) && fs.existsSync(paths.appNodeModulesPath)) {
  fs.symlinkSync(paths.appNodeModulesPath, paths.srcNodeModulesPath, 'junction');
}