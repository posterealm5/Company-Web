import fs from 'fs';
import path from 'path';

function inspect(filename) {
  const filePath = path.join('src/assets/images', filename);
  if (!fs.existsSync(filePath)) {
    console.log(`${filename} does not exist`);
    return;
  }
  const stats = fs.statSync(filePath);
  console.log(`${filename}: size = ${(stats.size / 1024).toFixed(2)} KB`);
}

inspect('hero-left.jpg');
inspect('hero-center.jpg');
inspect('hero-right.jpg');
inspect('regenerated_image_1778348846524.jpg');
