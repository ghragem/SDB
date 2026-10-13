// Gera os ícones do app a partir da arte oficial (assets/icone-app.png). Uso: node scripts/icons.mjs
import sharp from "sharp";

const SRC = "assets/icone-app.png";
// Recorta o quadrado do ícone sem a moldura preta e sem a borda clara do tile.
const tile = () => sharp(SRC).extract({ left: 84, top: 84, width: 1086, height: 1086 });

const square = [
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512],
  ["src/app/apple-icon.png", 180],
  ["src/app/icon.png", 64],
  ["public/logo-mark.png", 96],
];
for (const [file, size] of square) await tile().resize(size, size).png().toFile(file);

// Maskable: arte dentro da zona segura (80%) sobre o fundo do app.
const inner = await tile().resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#0a0a0b" } })
  .composite([{ input: inner, gravity: "center" }]).png().toFile("public/icon-maskable.png");
console.log("ok");
