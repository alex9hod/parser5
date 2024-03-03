const sleep = require('util').promisify(setTimeout)
const fs = require('fs')
const { Solver } = require('2captcha-ts')

module.exports = class thefreshmarket {
  constructor (browser, callback, wait, apiCaptcha) {
    return (async () => {
      this.baseUrl = 'https://www.thefreshmarket.com.ar/'
      this.callback = callback
      this.wait = wait
      this.browser = browser
      this.page = await this.browser.newPage()
      const solver = new Solver(apiCaptcha)
      await this.page.addInitScript(fs.readFileSync('./cloudflare.js', 'utf8'))
      await this.page.on('console', async msg => {
        const txt = msg.text()
        if (txt.includes('intercepted-params:')) {
          const params = JSON.parse(txt.replace('intercepted-params:', ''))
          console.log(params)
          try {
            console.log('Solving the captcha...')
            const res = await solver.cloudflareTurnstile(params)
            console.log(`Solved the captcha ${res.id}`)
            console.log(res)
            await this.page.evaluate((token) => {
              cfCallback(token)
            }, res.data)
          } catch (e) {
            console.log(e.err)
          }
        }
      })
      this.page.setDefaultTimeout(360000)
      this.page.setDefaultNavigationTimeout(360000)
      return this
    })()
  }

  async gourl (url) {
    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded' })
    } catch (e) {
      await sleep(5000)
      return await this.gourl(url)
    }
    do {
      try {
        const cloudFlare = await this.page.$('#challenge-running')
        if (cloudFlare) {
          console.log('CAPCTHA WAIT')
          await sleep(5000)
        }
        const logoSite = await this.page.$('#logo')
        if (logoSite) break
      } catch (e) {}
      await sleep(1000)
    } while (true)
    await sleep(this.wait || 5000)
  }

  async parse () {
    await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded' })
    await sleep(5000)
    await this.gourl(this.baseUrl)
    const categoryList = await this.page.$$eval('.nav-desktop-list>li>.nav-item-container>a', e => e.map(e => [e.href, e.textContent.replace(/\n/g, '')]))
    for (const category of categoryList) {
      await this.gourl(category[0])
      const subCategoryList = await this.page.$$eval('.category-body li>a.btn-link', e => e.map(e => [e.href, e.textContent.replace(/\n/g, '')]))
      for (const subCategory of subCategoryList) {
        await this.gourl(subCategory[0])
        await sleep(5000)
        const isNotEmpty = await this.page.$('.js-item-product [data-variants]')
        if (isNotEmpty) {
          let scrollCount = 0
          do {
            await sleep(1000)
            const evArray = await this.page.evaluate(() => [window.scrollY, document.querySelector('a.js-load-more')?.click(), window.scrollBy(0, 100000), window.scrollY])
            if (evArray[0] == evArray[3]) scrollCount++; else scrollCount = 0
            if (scrollCount > 5) break
          } while (true)
          const productList = await this.page.$$eval('.js-item-product [data-variants]', e => e.map(e => [e.querySelector('a').getAttribute('aria-label'), e.querySelector('a').href, e.getAttribute('data-variants')]))
          for (const product of productList) {
            if (product[0] && product[1] && product[2]) { 
              const result = { shop: 'thefreshmarket', additional: {} }
              result.category = category[1]
              result.title = product[0]
              result.subCategory = subCategory[1]
              result.link = product[1]
              try {
                const i = JSON.parse(product[2])[0]
                result.id = i.product_id
                result.price = i.price_short
                if (i.image_url)result.imageUrl = 'https:' + i.image_url
                if (i.compare_at_price_short && i.compare_at_price_short != i.price_short) result.additional.priceBeforeDiscount = i.compare_at_price_short
              } catch (e) {}
              result.additional = Object.entries(result.additional).map(a => a.join(':')).join(', ')
              this.callback(1, result)
            } else {
              this.callback(2, ['No title or price', product])
            }
          }
        }
      }
    }
  }

  async imgs (csvRows) {
    await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded' })
    await sleep(5000)
    for (const row of csvRows) {
      try {
        if (row.shop == 'thefreshmarket' && !row.imageUrls) {
          await this.gourl(row.link)
          row.imageUrls = await this.page.$$eval('.js-product-thumb img', imgs => imgs.map(img => img.srcset.split(' ')[0]))
          row.imageUrls = row.imageUrls.filter(i => i).map(i => 'https:' + i)
          if (row.imageUrls == 0) row.imageUrls = [row.imageUrl]
          const description = await this.page.$('.product-description')
          if (description) row.description = await this.page.evaluate(el => el.textContent, description)
        }
        this.callback(1, row)
      } catch (e) {
        this.callback(2, [e, row])
      }
    }
    this.stop()
  }

  stop () {
    this.page.close()
  }
}
