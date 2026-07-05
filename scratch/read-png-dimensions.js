import fs from 'fs';
const buffer = fs.readFileSync('public/logo.png');
const width = buffer.readUInt32BE(16);
const height = buffer.readUInt32BE(20);
console.log(`Logo: width=${width}, height=${height}`);
