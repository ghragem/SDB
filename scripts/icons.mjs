// Gera os ícones PWA a partir de um SVG. Uso: node scripts/icons.mjs
import sharp from "sharp";
import { writeFileSync } from "node:fs";

// Um quadrado aberto (o bairro) e um bloco vermelho saindo pela abertura.
const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#141413"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 512})">
    <path d="M330 150 H150 V362 H330" fill="none" stroke="#ecebe8" stroke-width="34" stroke-linecap="square"/>
    <rect x="300" y="222" width="68" height="68" fill="#e0483c"/>
  </g>
</svg>`;

const out = [
  ["public/icon-192.png", 192, 40],
  ["public/icon-512.png", 512, 40],
  ["public/icon-maskable.png", 512, 110],
  ["src/app/apple-icon.png", 180, 40],
  ["src/app/icon.png", 64, 20],
];
for (const [file, size, pad] of out) {
  await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(file);
}
writeFileSync("public/icon.svg", svg(40).trim());
console.log("ok");
