// Vista de desarrollo: copia el <body> de src/index.html (así no se desincroniza) y carga el
// main.js real con el Tauri falso de falso.js.
const html = await (await fetch(new URL('../src/index.html', import.meta.url))).text()
const doc = new DOMParser().parseFromString(html, 'text/html')
document.body.innerHTML = doc.body.innerHTML
await import('../src/main.js')
