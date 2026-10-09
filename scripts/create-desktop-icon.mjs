import sharp from 'sharp';
import fs from 'node:fs';
// ICO supports PNG frames; include common sizes for crisp Windows desktop icons.
const frames=[];const sizes=[16,32,48,64,128,256];
for(const size of sizes)frames.push(await sharp('public/zhiye-icon.svg').resize(size,size).png().toBuffer());
const header=Buffer.alloc(6+16*frames.length);header.writeUInt16LE(1,2);header.writeUInt16LE(frames.length,4);let offset=header.length;
frames.forEach((frame,i)=>{const base=6+i*16;header[base]=sizes[i]===256?0:sizes[i];header[base+1]=header[base];header.writeUInt16LE(1,base+4);header.writeUInt16LE(32,base+6);header.writeUInt32LE(frame.length,base+8);header.writeUInt32LE(offset,base+12);offset+=frame.length;});
fs.writeFileSync('public/zhiye.ico',Buffer.concat([header,...frames]));
await sharp('public/zhiye-icon.svg').resize(512,512).png().toFile('public/zhiye-icon.png');
console.log('知页 Windows icon created.');
