const sleep = require('util').promisify(setTimeout)

module.exports = class jumbo {
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
    await this.page.evaluate(() => window.scrollBy(0, 10000))
    try { await this.page.waitForSelector('.footer-container-general') } catch (e) {}
    await sleep(this.wait || 5000)
  }

  async parse () {
    for (const c of ['bebes-y-ninos/', 'almacen', 'bebidas', 'frutas-y-verduras/', 'carnes', 'pescados-y-mariscos', 'quesos-y-fiambresult', 'lacteos/', 'congelados', 'perfumeria/', 'limpieza/', 'mascotas']) {
      const baseUrl = 'https://www.jumbo.com.ar/' + c
      let pageNum = 1
      await this.gourl(baseUrl, true)
      do {
        const productList = await this.page.$$eval('#gallery-layout-container a.flex', e => e.map(e => e.href))
        for (const product of productList) {
          await this.gourl(product)
          const result = { shop: 'jumbo', additional: {} }
          let title = await this.page.$('[class*=productNameContainer]')
          if (title) title = await this.page.evaluate(el => el.textContent, title)
          let price = false
          try {
            price = await this.page.waitForSelector('[class*=main-price-box] [style*=align-items]>[class^=jumbo]>[class^=jumbo]', { timeout: 5000 })
          } catch (e) {
            price = await this.page.$('[property="product:price:amount"]')
          }
          if (title && price) {
            result.link = product
            const priceDiscount = await this.page.evaluate(el => el.parentNode?.parentNode?.nextElementSibling?.textContent, price)
            if (priceDiscount && priceDiscount.indexOf('.') + 1) result.additional.priceBeforeDiscount = priceDiscount
            result.title = title
            result.price = await this.page.evaluate(el => el.content || el.textContent, price)
            for (const t of [
              ['category', '[data-testid=breadcrumb] .vtex-breadcrumb-1-x-link--1', 'textContent'],
              ['subCategory', '[data-testid=breadcrumb] .vtex-breadcrumb-1-x-link--2', 'textContent'],
              ['brand', "[property='product:brand']", 'content'],
              ['description', '[name=description]', 'content'],
              ['code', "[property='product:retailer_item_id']", 'content']
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
            result.imageUrls = await this.page.$$eval("[property='og:image']", e => e.map(e => e.content))
            if (result.imageUrls.length > 0) result.imageUrl = result.imageUrls[0]
            if (!result.subCategory) result.subCategory = result.category
            result.additional = Object.entries(result.additional).map(a => a.join(':')).join(', ')
            this.callback(1, result)
          } else {
            this.callback(2, ['No title or price', product])
          }
        }
        const nextPage = await this.page.$("button.bg-base[value='" + (++pageNum) + "']")
        if (!nextPage) break
        await this.gourl(baseUrl + '?page=' + pageNum)
      } while (true)
    }
    this.stop()
  }

  stop () {
    this.page.close()
  }
}
