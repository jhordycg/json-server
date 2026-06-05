import { expect } from '@std/expect/expect'
import { it } from '@std/testing/bdd'
import { createEta } from './eta.ts'

const eta = createEta('./fixtures/views')

it('ETA template engine', () => {
  const template = 'valid.html'
  const data = { name: 'World' }
  const result = eta.render(template, data)

  expect(result).toBe('Hello, World!\n')
})
