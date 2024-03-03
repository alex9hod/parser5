const sleep = require('util').promisify(setTimeout)

module.exports = class cotodigital3 {
  constructor (browser, callback, wait) {
    return (async () => {
      this.callback = callback
      this.wait = wait
      this.browser = browser
      this.page = await this.browser.newPage()
      this.page.setDefaultTimeout(360000)
      this.page.setDefaultNavigationTimeout(360000)
      return this
    })()
  }

  async gourl (url, reopen) {
    if (typeof url !== 'string') url = await (await url.getProperty('href')).jsonValue()
    try {
      if (reopen) {
        await this.page.close()
        this.page = await this.browser.newPage()
      }
      await this.page.goto(url, { waitUntil: 'domcontentloaded' })
    } catch (e) {
      await sleep(5000)
      return await this.gourl(url)
    }
    await sleep(this.wait || 5000)
  }

  async parse () {
    await this.gourl('https://www.cotodigital3.com.ar/')
    let categoryList = await this.page.$$eval('#atg_store_catNav h2>a', e => e.map(e => e.href))
    categoryList = categoryList.filter(a => ['ofertas', 'electro', 'textil', 'hogar', 'aire-libre'].filter(b => a.indexOf(b) + 1).length == 0)
    for (const category of categoryList) {
      await this.gourl(category, true)
      do {
        const productList = await this.page.$$eval('.product_info_container a', e => e.map(e => e.href))
        for (const product of productList) {
          await this.gourl(product)
          const result = { shop: 'cotodigital3' }
          try {
            this.page.waitForSelector('h1.product_page', { timeout: 30000 })
          } catch (e) {}
          const titlePrice = await this.page.$$eval('h1.product_page, .atg_store_newPrice', e => e.map(e => e.textContent.replace(/[\n]/g, '').trim()))
          if (titlePrice && titlePrice[0] && titlePrice[1]) {
            result.link = product
            result.price = titlePrice[0]
            result.title = titlePrice[1]
            for (const t of [
              ['imageUrl', '#zoomContent img', 'src'],
              ['category', '#atg_store_breadcrumbs .breadcrumbSeparador+a', 'textContent', i => i.replace(/[\t\r\n>]/g, '')],
              ['subCategory', '#atg_store_breadcrumbs .breadcrumbSeparador+a+a', 'textContent', i => i.replace(/[\t\r\n>]/g, '')],
              ['description', '#txtComentario', 'textContent'],
              ['code', '.addToCart', 'id', i => i.replace(/[^0-9]/g, '')]
            ]) {
              try {
                let v = await this.page.$(t[1])
                if (v && t[2] && v.getProperty) {
                  v = await v.getProperty(t[2])
                  if (v) v = await v.jsonValue()
                }
                if (v && t[0]) {
                  result[t[0]] = v.trim()
                  if (typeof t[3] === 'function') result[t[0]] = t[3](result[t[0]])
                }
              } catch (e) {}
            }
            result.imageUrls = await this.page.$$eval('.zoomThumbLink img[data-large]', e => e.map(e => e.getAttribute('data-large')))
            if (result.imageUrls.length == 0) result.imageUrls = [result.imageUrl]
            this.callback(1, result)
          } else {
            this.callback(2, ['No title or price', product])
          }
        }
        const nextPage = await this.page.$('#atg_store_pagination li.active+li a')
        if (!nextPage) break
        await this.gourl(nextPage)
      } while (true)
    }
    this.stop()
  }

  stop () {
    this.page.close()
  }
}
