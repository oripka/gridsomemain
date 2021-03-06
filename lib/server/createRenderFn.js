const fs = require('fs-extra')
const chalk = require('chalk')
const createHTMLRenderer = require('./createHTMLRenderer')
const { createBundleRenderer } = require('vue-server-renderer')
const { error } = require('../utils/log')

module.exports = function createRenderFn ({
  htmlTemplate,
  clientManifestPath,
  serverBundlePath,
  shouldPrefetch,
  shouldPreload
}) {
  const renderHTML = createHTMLRenderer(htmlTemplate)
  const clientManifest = require(clientManifestPath)
  const serverBundle = require(serverBundlePath)

  const renderer = createBundleRenderer(serverBundle, {
    clientManifest,
    runInNewContext: false,
    shouldPrefetch,
    shouldPreload,
    basedir: __dirname
  })

  return async function render(page, hash) {
    const pageData = page.dataOutput
      ? await fs.readFile(page.dataOutput, 'utf8')
      : JSON.stringify({ hash })

    const context = {
      path: page.path,
      location: page.location,
      state: JSON.parse(pageData)
    }

    let app = ''

    try {
      app = await renderer.renderToString(context)
    } catch (err) {
      const location = page.location.name || page.location.path
      error(chalk.red(`Could not generate HTML for "${location}":`))
      throw err
    }

    const inject = context.meta.inject()
    const htmlAttrs = inject.htmlAttrs.text()
    const bodyAttrs = inject.bodyAttrs.text()

    const pageTitle = inject.title.text()
    const metaBase = inject.base.text()
    const vueMetaTags = inject.meta.text()
    const vueMetaLinks = inject.link.text()
    const styles = context.renderStyles()
    const noscript = inject.noscript.text()
    const vueMetaStyles = inject.style.text()
    const vueMetaScripts = inject.script.text()
    const resourceHints = context.renderResourceHints()

    const head =
      '' +
      pageTitle +
      metaBase +
      vueMetaTags +
      vueMetaLinks +
      resourceHints +
      styles +
      vueMetaStyles +
      vueMetaScripts +
      noscript

    if (pageData.length > 25000) {
      delete context.state.data
      delete context.state.context
    }

    const renderedState = context.renderState()

    const scripts = '' +
      renderedState +
      context.renderScripts() +
      inject.script.text({ body: true })

      return renderHTML({
        htmlAttrs: `data-html-server-rendered="true" ${htmlAttrs}`,
        bodyAttrs,
        head,
        title: pageTitle,
        base: metaBase,
        vueMetaTags,
        vueMetaLinks,
        resourceHints,
        styles,
        vueMetaStyles,
        vueMetaScripts,
        noscript,
        app,
        scripts
      })
  }
}
