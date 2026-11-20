// Genera el PNG fuente de los íconos de la app (opción B "Ficha ámbar" de bandeja.js), en 1024 px
// con 64 px por celda, nítido. Uso, dentro de widget/:
//   node scripts/icono.mjs <salida.png>
//   npx tauri icon <salida.png> -o src-tauri/icons   (y borrar android/, ios/ y los Square*/StoreLogo)
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { grillaFicha, rgbaDeGrilla } from '../src/bandeja.js'

const salida = process.argv[2]
if (!salida) { console.error('Uso: node scripts/icono.mjs <salida.png>'); process.exit(1) }

const CELDA = 64
const rgba = rgbaDeGrilla(grillaFicha(0), CELDA)
const lado = 16 * CELDA
const filas = Buffer.alloc(lado * (lado * 4 + 1))
for (let y = 0; y < lado; y++) Buffer.from(rgba.buffer, y * lado * 4, lado * 4).copy(filas, y * (lado * 4 + 1) + 1)

const tabla = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = b => { let r = 0xffffffff; for (const x of b) r = tabla[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0 }
const trozo = (tipo, datos) => {
  const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length)
  const td = Buffer.concat([Buffer.from(tipo), datos])
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
  return Buffer.concat([largo, td, c])
}
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(lado, 0); ihdr.writeUInt32BE(lado, 4); ihdr[8] = 8; ihdr[9] = 6
writeFileSync(salida, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo('IHDR', ihdr), trozo('IDAT', deflateSync(filas)), trozo('IEND', Buffer.alloc(0))]))
console.log('listo:', salida)
