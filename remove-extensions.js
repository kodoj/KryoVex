import * as fs from 'fs';
import * as path from "path";

const dir = 'src/main';  // Change to 'src/renderer' if needed for other files

function processFiles(dir) {
  fs.readdir(dir, { withFileTypes: true }, (err, files) => {
    if (err) return console.error(err);
    files.forEach(file => {
      const filePath = path.join(dir, file.name);
      if (file.isDirectory()) {
        processFiles(filePath);
      } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        let code = fs.readFileSync(filePath, 'utf8');
        // Remove .ts or .tsx from relative imports (./ or ../)
        code = code.replace(/from (["'])(\.[.\/].*?)\.ts(x?)\1/g, 'from $1$2$1');
        fs.writeFileSync(filePath, code, 'utf8');
        console.log('Updated', filePath);
      }
    });
  });
}

processFiles(dir);