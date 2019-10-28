require('chromedriver')
require('geckodriver')
const fs = require('fs-extra')
const os = require('os')
const path = require('path')
const puppeteer = require('puppeteer')
// const pptrFirefox = require('puppeteer-firefox')
const webdriver = require('selenium-webdriver')
const Command = require('selenium-webdriver/lib/command').Command
const By = webdriver.By

module.exports = {
  delay,
  buildPuppeteerDriver,
  verboseReportOnFailure,
  buildChromeWebDriver,
  buildFirefoxWebdriver,
  installWebExt,
  getExtensionIdPuppeteer,
  getExtensionIdChrome,
  getExtensionIdFirefox,
}

function delay (time) {
  return new Promise(resolve => setTimeout(resolve, time))
}

async function buildPuppeteerDriver (extPath, opts = {}) {
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-chrome-profile'))
  const args = [
    `--disable-extensions-except=${extPath}`,
    `--load-extension=${extPath}`,
    `--user-data-dir=${tmpProfile}`,
  ]
  if (opts.responsive) {
    args.push('--auto-open-devtools-for-tabs')
  }
  const driver = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args,
  })

  return driver
}

function buildChromeWebDriver (extPath, opts = {}) {
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-chrome-profile'))
  const args = [
    `load-extension=${extPath}`,
    `user-data-dir=${tmpProfile}`,
  ]
  if (opts.responsive) {
    args.push('--auto-open-devtools-for-tabs')
  }
  return new webdriver.Builder()
    .withCapabilities({
      chromeOptions: {
        args,
        binary: process.env.SELENIUM_CHROME_BINARY,
      },
    })
    .build()
}

function buildFirefoxWebdriver (opts = {}) {
  const driver = new webdriver.Builder().build()
  if (opts.responsive) {
    driver.manage().window().setSize(320, 600)
  }
  return driver
}

async function getExtensionIdPuppeteer (browser) {
  const targets = await browser.targets()
  const backgroundPageTarget = targets.find(target => target.type() === 'background_page')
  const url = await backgroundPageTarget.url()
  const extensionId = url.split('/')[2]

  const page = await browser.newPage()
  await page.goto(`chrome-extension://${extensionId}/home.html`)
}

async function getExtensionIdChrome (driver) {
  await driver.get('chrome://extensions')
  const extensionId = await driver.executeScript('return document.querySelector("extensions-manager").shadowRoot.querySelector("extensions-item-list").shadowRoot.querySelector("extensions-item:nth-child(2)").getAttribute("id")')
  return extensionId
}


async function getExtensionIdFirefox (driver) {
  await driver.get('about:debugging#addons')
  const extensionId = await driver.findElement(By.css('dd.addon-target-info-content:nth-child(6) > span:nth-child(1)')).getText()
  return extensionId
}

async function installWebExt (driver, extension) {
  const cmd = await new Command('moz-install-web-ext')
    .setParameter('path', path.resolve(extension))
    .setParameter('temporary', true)

  await driver.getExecutor()
    .defineCommand(cmd.getName(), 'POST', '/session/:sessionId/moz/addon/install')

  return await driver.schedule(cmd, 'installWebExt(' + extension + ')')
}

async function verboseReportOnFailure ({ browser, driver, title }) {
  const artifactDir = `./test-artifacts/${browser}/${title}`
  const filepathBase = `${artifactDir}/test-failure`
  await fs.ensureDir(artifactDir)
  const screenshot = await driver.takeScreenshot()
  await fs.writeFile(`${filepathBase}-screenshot.png`, screenshot, { encoding: 'base64' })
  const htmlSource = await driver.getPageSource()
  await fs.writeFile(`${filepathBase}-dom.html`, htmlSource)
}
