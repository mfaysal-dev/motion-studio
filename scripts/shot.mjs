import puppeteer from 'puppeteer-core'
const url = process.argv[2] || 'http://localhost:4173/'
const out = process.argv[3] || '/tmp/shot.png'
const w = +(process.argv[4] || 1600), h = +(process.argv[5] || 1000)
const theme = process.argv[6]
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader'] })
const page = await browser.newPage()
await page.setViewport({ width: w, height: h, deviceScaleFactor: +(process.env.DPR || 1) })
const logs = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()) })
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message))
if (theme) await page.evaluateOnNewDocument((t) => localStorage.setItem('kinetica:theme', t), theme)
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 })
await new Promise((r) => setTimeout(r, 2500))
if (process.env.ACTIONS) { const fn = new Function('page', `return (async()=>{${process.env.ACTIONS}})()`); await fn(page); await new Promise((r) => setTimeout(r, 1200)) }
await page.screenshot({ path: out })
console.log(logs.join('\n') || 'no console errors')
await browser.close()
