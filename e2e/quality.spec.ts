import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { BASE_URL } from '../playwright.config.ts'

const SECTIONS = ['create', 'scan', 'batch', 'history'] as const

test.describe('Accessibility (axe, WCAG 2.2 AA)', () => {
  for (const section of SECTIONS) {
    test(`${section} has no violations`, async ({ page }) => {
      await page.goto(`./#${section}`)
      if (section === 'create') {
        await page.getByLabel('Web address').fill('example.com')
        await expect(page.getByText('Scans correctly')).toBeVisible({ timeout: 15_000 })
      }
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
    })
  }
})

test.describe('Layout', () => {
  for (const section of SECTIONS) {
    test(`${section} fits a 320 px screen without sideways scrolling`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 })
      await page.goto(`./#${section}`)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }

  test('the skip link is the first thing keyboard users reach', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard navigation is a desktop concern')
    await page.goto('./')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  })
})

test.describe('Privacy and offline', () => {
  test('makes no requests to any other site', async ({ page }) => {
    const foreign: string[] = []
    page.on('request', (request) => {
      if (!request.url().startsWith(new URL(BASE_URL).origin) && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) {
        foreign.push(request.url())
      }
    })
    await page.goto('./')
    await page.getByLabel('Web address').fill('example.com')
    await expect(page.getByText('Scans correctly')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('tab', { name: 'Scan' }).click()
    expect(foreign).toEqual([])
  })

  test('the Content Security Policy is in place and nothing violates it', async ({ page }) => {
    const violations: string[] = []
    page.on('console', (message) => {
      if (/Content Security Policy/i.test(message.text())) violations.push(message.text())
    })
    await page.goto('./')
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
    expect(csp).toContain("default-src 'self'")
    await page.getByLabel('Web address').fill('example.com')
    await expect(page.getByText('Scans correctly')).toBeVisible({ timeout: 15_000 })
    expect(violations).toEqual([])
  })

  test('works offline after the first visit', async ({ page, context }) => {
    await page.goto('./')
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    // The service worker precaches the app shell, fonts and the reader's wasm on install.
    await expect
      .poll(async () => page.evaluate(async () => (await caches.keys()).length), { timeout: 15_000 })
      .toBeGreaterThan(0)
    await page.reload()
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await context.setOffline(true)
    await page.reload()
    await page.getByLabel('Web address').fill('example.com/offline')
    await expect(page.getByText('Scans correctly')).toBeVisible({ timeout: 15_000 })
    await context.setOffline(false)
  })
})
