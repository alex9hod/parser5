const sleep = require('util').promisify(setTimeout)

module.exports = class carrefour {
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
    await this.gourl('https://www.carrefour.com.ar/')
    while (true) {
      try {
        const menu1 = await this.page.$('.vtex-menu-2-x-menuContainer .vtex-menu-2-x-menuItem--MenuCategoryFirstItem')
        if (menu1) break
        const menu2 = await this.page.waitForSelector('[class*=menuCategory] [role=button]')
        if (menu2) menu2.click()
      } catch (e) {}
      await sleep(5000)
    }
    await this.page.evaluate(() => [...document.querySelectorAll('.vtex-menu-2-x-menuContainer .vtex-menu-2-x-menuItem--MenuCategoryFirstItem')].splice(1).forEach(a => a[Object.keys(a).find(a => a.indexOf('rops') + 1)].onMouseEnter()))
    await sleep(20000)
    const categoryList = await this.page.$$eval('a.vtex-menu-2-x-styledLink--MenuCategorySecondItem-hasSubmenu', e => e.map(e => e.href))
    for (const category of categoryList) {
      let pageNum = 1
      await this.gourl(category, true)
      do {
        await this.page.evaluate(() => window.scrollBy(0, 10000))
        await sleep(5000)
        const productList = await this.page.$$eval('a.vtex-product-summary-2-x-clearLink', e => e.map(e => e.href))
        for (const product of productList) {
          await this.gourl(product)
          const result = { shop: 'carrefour', additional: {} }
          const titlePrice = await this.page.$$eval('.vtex-store-components-3-x-productNameContainer, .valtech-carrefourar-product-price-0-x-currencyContainer', e => e.map(e => e.textContent.replace(/[\n]/g, '').trim()))
          if (titlePrice && titlePrice[0] && titlePrice[1]) {
            result.link = product
            result.title = titlePrice[0]
            result.price = titlePrice[1]
            for (const t of [
              ['imageUrl', 'img.vtex-store-components-3-x-productImageTag', 'src'],
              ['category', '.vtex-breadcrumb-1-x-arrow--breadcrumb-products', 'textContent'],
              ['subCategory', '.vtex-breadcrumb-1-x-arrow--breadcrumb-products+*', 'textContent'],
              ['description', '.vtex-store-components-3-x-productDescriptionText', 'textContent'],
              ['code', "[property='product:retailer_item_id']", 'content'],
              ['brand', "[property='product:brand']", 'content']
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
            result.imageUrls = await this.page.$$eval('.vtex-store-components-3-x-thumbImg', e => e.map(e => e.src))
            if (result.imageUrls.length == 0) result.imageUrls = [result.imageUrl]
            const priceDiscount = await this.page.$('.valtech-carrefourar-product-price-0-x-listPrice')
            if (priceDiscount) result.additional.priceBeforeDiscount = await this.page.evaluate(a => a.textContent, priceDiscount)
            const attributeList = await this.page.$$eval('.vtex-store-components-3-x-specificationItemProperty[data-specification]', e => e.map(e => [e.textContent, e.nextElementSibling.textContent]))
            for (const attribute of attributeList) {
              if (attribute && attribute[0] && attribute[1]) {
                result.additional[attribute[0]] = attribute[1]
              }
            }
            result.additional = Object.entries(result.additional).map(a => a.join(':')).join(', ')
            this.callback(1, result)
          } else {
            this.callback(2, ['No title or price', product])
          }
        }
        const nextPage = await this.page.$('.valtech-carrefourar-search-resultult-0-x-paginationButtonPages:not(.false)+* button[value]')
        if (!nextPage) break
        await this.gourl(category + (category.indexOf('?') + 1 ? '&' : '?') + 'page=' + (++pageNum))
      } while (true)
    }
    this.stop()
  }

  stop () {
    this.page.close()
  }
}
