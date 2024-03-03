const playwright = require('playwright')
const sleep = require('util').promisify(setTimeout)
const fs = require('fs')
const createCsvWriter = require('csv-writer').createObjectCsvWriter
const csvReadableStream = require('csv-reader')
const config = require('./config')
const buenosayresexpress = require('./sites/buenosayresexpress')
const jumbo = require('./sites/jumbo')
const thefreshmarket = require('./sites/thefreshmarket')
const cotodigital3 = require('./sites/cotodigital3')
const carrefour = require('./sites/carrefour')

process.on('uncaughtException', error => {
  if (error.message.indexOf('Target page, context or browser') < 0) console.log(error, 'Uncaught Exception thrown')
});

(async () => {
  const header = [
    { id: 'id', title: 'ID' },
    { id: 'title', title: 'Название' },
    { id: 'shop', title: 'Магазин' },
    { id: 'brand', title: 'Бренд' },
    { id: 'price', title: 'Цена' },
    { id: 'category', title: 'Категория' },
    { id: 'subCategory', title: 'Субкатегория' },
    { id: 'description', title: 'Описание' },
    { id: 'link', title: 'Ссылка' },
    { id: 'additional', title: 'Дополнительно' },
    { id: 'imageUrl', title: 'Фото' },
    { id: 'imageUrls', title: 'Список фото' }
  ]
  let data = []
  let id = 0
  let csv = createCsvWriter({
    path: config.LOG_FILE,
    header,
    encoding: 'utf8'
  })
  setInterval(() => {
    if (data.length > 0) {
      csv.writeRecords(data)
      data = []
    }
  }, 1000)

  const callback = (type, log) => {
    if (type == 1) {
      log.id = ++id
      data.push(log)
    }
    if (type == 2) console.error(log)
    if (type == 3) console.log(log)
  }

  const browser = await playwright.firefox.launch({
    args: ['--no-sandbox'],
    headless: config.BROWSER_HIDE
  })

  await Promise.all([
    (await new buenosayresexpress(browser, callback, config.WAIT.buenosayresexpress)).parse(),
    (await new jumbo(browser, callback, config.WAIT.jumbo)).parse(),
    (await new thefreshmarket(browser, callback, config.WAIT.thefreshmarket, config.API_CAPTCHA)).parse(),
    (await new cotodigital3(browser, callback, config.WAIT.cotodigital3)).parse(),
    (await new carrefour(browser, callback, config.WAIT.carrefour)).parse()
  ])

  const csvRows = []
  fs.createReadStream(config.LOG_FILE, 'utf8').pipe(new csvReadableStream()).on('data', row => {
    const objRow = {}
    const headerIdList = header.map(h => h.id)
    for (const i in row) objRow[headerIdList[i]] = row[i]
    csvRows.push(objRow)
  }).on('end', async () => {
    csv = createCsvWriter({
      path: config.LOG_FILE,
      header,
      encoding: 'utf8'
    })
    await Promise.all([
      (await new thefreshmarket(browser, callback, config.WAIT.thefreshmarket, config.API_CAPTCHA)).imgs(csvRows)
    ])
    await sleep(2000)
    process.exit()
  })
})()
