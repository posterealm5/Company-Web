import fs from 'fs';
import path from 'path';

function walk(dir: string, results: string[] = []) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        walk(fullPath, results);
      }
    } else {
      if (file.toLowerCase().includes('coupon')) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

const files = walk(process.cwd());
console.log("Matching files:", files);
