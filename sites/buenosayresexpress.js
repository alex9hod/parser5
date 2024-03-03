const sleep = require('util').promisify(setTimeout)

module.exports = class buenosayresexpress {
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
    const whitePage = await this.page.$('#debugMessages a[href*=white]')
    if (whitePage) await this.gourl(whitePage)
  }

  async parse () {
    await this.gourl('https://buenosayresexpress.com.ar/')
    const categoryList = await this.page.$$eval('a[href*=categoria]', e => e.map(e => e.href))
    for (const category of categoryList) {
      await this.gourl(category, true)
      do {
        const productList = await this.page.$$eval('.fusion-product-buttons .show_details_button', e => e.map(e => e.href))
        for (const prod of productList) {
          await this.gourl(prod)
          const result = { shop: 'buenosayresexpress' }
          const titlePrice = await this.page.$$eval('.price, .product_title', e => e.map(e => e.textContent))
          if (titlePrice && titlePrice[0] && titlePrice[1]) {
            result.link = prod
            result.title = titlePrice[0]
            result.price = titlePrice[1]
            for (const t of [
              ['imageUrl', '.woocommerce-product-gallery__image img', 'src'],
              ['category', '.posted_in a', 'textContent'],
              ['brand', '.tagged_as a', 'textContent'],
              ['description', '[name=description]', 'content'],
              ['code', 'button.single_add_to_cart_button', 'value']
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
            if (result.imageUrl) result.imageUrls = [result.imageUrl]
            if (result.category) result.subCategory = result.category
            this.callback(1, result)
          } else {
            this.callback(2, ['No title or price', prod])
          }
        }
        const nextPage = await this.page.$('a.next')
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
