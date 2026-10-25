import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const state = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/state.json', import.meta.url)), 'utf8'),
)

test.beforeEach(async ({ page }) => {
  await page.route('**/api/state*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state),
    })
  })
  await page.route('**/api/events*', async (route) => {
    await route.fulfill({ status: 204, body: '' })
  })
  await page.route('**/api/agents/*', async (route) => {
    const agent = state.agents[0]
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        agent,
        tasks: state.tasks,
        approvals: [],
        events: [],
        delegations: [],
      }),
    })
  })
})

test('muestra la escena y el listado accesible', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Agentes y estados' })).toBeAttached()
  await expect(page.getByRole('button', { name: /orchestrator/i })).toBeAttached()
  await expect(page.locator('.office-scene')).toBeVisible()
})

test('oculta y restaura la barra lateral', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.agent-detail__title h2')).toHaveText('orchestrator')
  const toggle = page.getByRole('button', { name: /ocultar panel lateral/i })
  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect(page.locator('.side-panel')).toBeHidden()
  await expect(page.getByRole('button', { name: /mostrar panel lateral/i })).toBeVisible()
  await expect(page.locator('.stage')).toHaveCSS('width', /^\d+(\.\d+)?px$/)
})

test('actualiza la hora de la escena', async ({ page }) => {
  await page.goto('/')
  const slider = page.getByRole('slider', { name: 'Hora de la escena' })
  await expect(slider).toBeVisible()
  await slider.fill('13')
  await expect(page.locator('.scene-tools__value')).toHaveText('13:00')
})

test('expone el presupuesto y la calidad adaptativa', async ({ page }) => {
  await page.goto('/')
  const scene = page.locator('.office-scene')
  await expect(scene).toHaveAttribute('data-quality', /^(high|medium|low)$/)
  await expect
    .poll(async () => Number(await scene.getAttribute('data-fps')), { timeout: 10_000 })
    .toBeGreaterThan(0)
  await expect(page.locator('.scene-quality')).toBeVisible()
})

test('skip link y foco visible', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.locator('.skip-link')).toBeFocused()
})

test('sin violaciones críticas de accesibilidad', async ({ page }) => {
  await page.goto('/')
  const results = await new AxeBuilder({ page }).analyze()
  const critical = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  )
  expect(critical, JSON.stringify(critical, null, 2)).toEqual([])
})
