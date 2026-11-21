// Tests del tamaño de la ventana: escala del dibujo, ajuste al contenido, límites y posición.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  zoomDe, direccionDeTecla, tamanoDeseado, debeAjustar, posicionEnPantalla, tamanoMini, medidaVentana, fueraDeLugar, MINIMO, FRACCION_MAXIMA,
  esquinaTira, MARGEN_TIRA, fraccionFlotante, posicionDeFraccion,
} from '../src/tamano.js'

const AREA = { x: 0, y: 0, ancho: 1920, alto: 1040 }

test('el zoom sale del porcentaje elegido: 100 % es el tamaño original, 200 % el doble', () => {
  assert.equal(zoomDe(100), 1)
  assert.equal(zoomDe(125), 1.25)
  assert.equal(zoomDe(150), 1.5)
  assert.equal(zoomDe(175), 1.75)
  assert.equal(zoomDe(200), 2)
  // Un valor raro o fuera de los pasos vuelve al tamaño original
  assert.equal(zoomDe(undefined), 1)
  assert.equal(zoomDe(300), 1)
  assert.equal(zoomDe('grande'), 1)
})

test('teclas: Ctrl + agranda, Ctrl − achica, Ctrl 0 vuelve a 100 %; sin Ctrl no hace nada', () => {
  const t = (key, ctrlKey = true, code = '') => direccionDeTecla({ key, ctrlKey, code })
  assert.equal(t('+'), 1)
  assert.equal(t('='), 1)
  assert.equal(t('', true, 'NumpadAdd'), 1)
  assert.equal(t('-'), -1)
  assert.equal(t('', true, 'NumpadSubtract'), -1)
  assert.equal(t('0'), 0)
  assert.equal(t('', true, 'Numpad0'), 0)
  assert.equal(t('+', false), null)
  assert.equal(t('a'), null)
})

test('la ventana toma el tamaño del contenido, redondeado hacia arriba', () => {
  assert.deepEqual(tamanoDeseado({ ancho: 763.4, alto: 640.2 }, AREA), { ancho: 764, alto: 641 })
})

test('nunca más chica que el mínimo ni más grande que el 90 % del área de trabajo', () => {
  assert.deepEqual(tamanoDeseado({ ancho: 100, alto: 40 }, AREA), { ancho: MINIMO.ancho, alto: MINIMO.alto })
  assert.equal(FRACCION_MAXIMA, 0.9)
  assert.deepEqual(tamanoDeseado({ ancho: 5000, alto: 5000 }, AREA), { ancho: 1728, alto: 936 })
  // Un área más chica que el mínimo: gana el área (que la ventana entre en pantalla)
  assert.deepEqual(tamanoDeseado({ ancho: 500, alto: 500 }, { x: 0, y: 0, ancho: 300, alto: 100 }), { ancho: 270, alto: 90 })
})

test('solo se ajusta si cambió más de 2 px (sin bucles de redimensión)', () => {
  assert.equal(debeAjustar({ ancho: 400, alto: 600 }, { ancho: 402, alto: 598 }), false)
  assert.equal(debeAjustar({ ancho: 400, alto: 600 }, { ancho: 403, alto: 600 }), true)
  assert.equal(debeAjustar({ ancho: 400, alto: 600 }, { ancho: 400, alto: 560 }), true)
})

test('al crecer la esquina de arriba a la izquierda no se mueve, salvo que se salga de la pantalla', () => {
  assert.deepEqual(posicionEnPantalla({ x: 100, y: 80 }, { ancho: 764, alto: 641 }, AREA), { x: 100, y: 80 })
  assert.deepEqual(posicionEnPantalla({ x: 1500, y: 700 }, { ancho: 764, alto: 641 }, AREA), { x: 1156, y: 399 })
  assert.deepEqual(posicionEnPantalla({ x: -50, y: -10 }, { ancho: 400, alto: 300 }, AREA), { x: 0, y: 0 })
  // Monitor secundario a la izquierda (coordenadas negativas)
  const izq = { x: -1280, y: 0, ancho: 1280, alto: 984 }
  assert.deepEqual(posicionEnPantalla({ x: -300, y: 50 }, { ancho: 764, alto: 641 }, izq), { x: -764, y: 50 })
})

test('la tira mini crece con el zoom', () => {
  assert.deepEqual(tamanoMini(zoomDe(100)), { ancho: 400, alto: 56 })
  assert.deepEqual(tamanoMini(zoomDe(125)), { ancho: 500, alto: 70 })
  assert.deepEqual(tamanoMini(zoomDe(175)), { ancho: 700, alto: 98 })
  assert.deepEqual(tamanoMini(zoomDe(200)), { ancho: 800, alto: 112 })
})

test('tablero: alto fijo, el mismo en todos los proyectos; el ancho sale del contenido', () => {
  const extras = { ancho: 34, alto: 50 }
  // Un proyecto con poco contenido y otro con mucho miden lo mismo: el alto no depende del proyecto
  const corto = medidaVentana({ contenido: { ancho: 664, alto: 300 }, extras, altoTablero: 640, margen: 16 })
  const largo = medidaVentana({ contenido: { ancho: 664, alto: 1400 }, extras, altoTablero: 640, margen: 16 })
  assert.deepEqual(corto, { ancho: 698, alto: 656 })
  assert.deepEqual(largo, corto)
})

test('tablero: el alto fijo crece con el zoom (en px de la ventana)', () => {
  const m = medidaVentana({ contenido: { ancho: 996, alto: 300 }, extras: { ancho: 34, alto: 50 }, f: 1.5, altoTablero: 640, margen: 16 })
  assert.deepEqual(m, { ancho: 1047, alto: 984 })
  // Topado al 90 % del área, como siempre: el resto se ve con scroll adentro
  assert.equal(tamanoDeseado(medidaVentana({ contenido: { ancho: 1328, alto: 0 }, extras: { ancho: 34, alto: 50 }, f: 2, altoTablero: 640, margen: 16 }), AREA).alto, 936)
})

test('vacío y carga: siguen al contenido (sin alto fijo)', () => {
  const m = medidaVentana({ contenido: { ancho: 330, alto: 410 }, extras: { ancho: 34, alto: 50 } })
  assert.deepEqual(m, { ancho: 364, alto: 460 })
  assert.deepEqual(medidaVentana({ contenido: { ancho: 330, alto: 410 }, extras: { ancho: 34, alto: 50 }, f: 2 }), { ancho: 398, alto: 510 })
})

test('acoplada, la ventana se recoloca solo si cambió de tamaño (más de 2 px) o de lugar (más de 1 px)', () => {
  const v = { x: 600, y: 0, ancho: 708, alto: 656 }
  assert.equal(fueraDeLugar(v, { ...v }), false)
  assert.equal(fueraDeLugar(v, { ...v, ancho: 710, x: 601 }), false)
  assert.equal(fueraDeLugar(v, { ...v, ancho: 711 }), true)
  assert.equal(fueraDeLugar(v, { ...v, x: 602 }), true)
  assert.equal(fueraDeLugar(v, { ...v, y: -2 }), true)
})

// ------------------------------------------------------------------ ventana única: tira y posición flotante

test('la tira mini va abajo a la derecha del área, apoyada sobre la barra de tareas con un margen de 8', () => {
  assert.equal(MARGEN_TIRA, 8)
  // Pantalla de 1920 × 1080 con la barra de tareas de 48 abajo: el área llega hasta 1032
  assert.deepEqual(esquinaTira({ x: 0, y: 0, ancho: 1920, alto: 1032 }, { ancho: 400, alto: 56 }), { x: 1920 - 400 - 8, y: 1032 - 56 - 8 })
  // Otro monitor a la izquierda, con coordenadas negativas
  assert.deepEqual(esquinaTira({ x: -1280, y: 0, ancho: 1280, alto: 984 }, { ancho: 362, alto: 56 }), { x: -362 - 8, y: 984 - 56 - 8 })
  // Si no entra, no se sale del área por la izquierda ni por arriba
  assert.deepEqual(esquinaTira({ x: 0, y: 0, ancho: 300, alto: 40 }, { ancho: 362, alto: 56 }), { x: 0, y: 0 })
  // Crece con el zoom: la tira de 200 % sigue pegada a la esquina
  assert.deepEqual(esquinaTira(AREA, tamanoMini(2)), { x: 1920 - 800 - 8, y: 1040 - 112 - 8 })
})

test('posición flotante: se guarda como fracción del lugar libre del área y se restaura dentro del área', () => {
  const tam = { ancho: 700, alto: 500 }
  // Arriba a la izquierda es 0, abajo a la derecha 1, al medio 0,5
  assert.deepEqual(fraccionFlotante({ x: 0, y: 0 }, tam, AREA), { x: 0, y: 0 })
  assert.deepEqual(fraccionFlotante({ x: 1220, y: 540 }, tam, AREA), { x: 1, y: 1 })
  assert.deepEqual(fraccionFlotante({ x: 610, y: 270 }, tam, AREA), { x: 0.5, y: 0.5 })
  // Ida y vuelta en la misma área: el mismo lugar
  assert.deepEqual(posicionDeFraccion(fraccionFlotante({ x: 300, y: 120 }, tam, AREA), tam, AREA), { x: 300, y: 120 })
  // En un área más chica (otro monitor, otra barra de tareas) queda adentro, en la misma proporción
  const chica = { x: -1280, y: 0, ancho: 1280, alto: 984 }
  const p = posicionDeFraccion({ x: 1, y: 1 }, tam, chica)
  assert.deepEqual(p, { x: -700, y: 484 })
  assert.deepEqual(posicionDeFraccion({ x: 0.5, y: 0 }, tam, chica), { x: -990, y: 0 })
  // Fuera de lugar o basura: entre 0 y 1, y al medio si no es número
  assert.deepEqual(posicionDeFraccion({ x: 7, y: -3 }, tam, AREA), { x: 1220, y: 0 })
  assert.deepEqual(posicionDeFraccion({ x: 'no', y: null }, tam, AREA), { x: 610, y: 270 })
  assert.deepEqual(posicionDeFraccion(null, tam, AREA), { x: 610, y: 270 })
  // Pasado el borde (arrastrado medio afuera) la fracción se topa
  assert.deepEqual(fraccionFlotante({ x: -200, y: 900 }, tam, AREA), { x: 0, y: 1 })
  // Un tablero más grande que el área: arriba a la izquierda
  assert.deepEqual(posicionDeFraccion({ x: 0.7, y: 0.7 }, { ancho: 2000, alto: 2000 }, AREA), { x: 0, y: 0 })
})
