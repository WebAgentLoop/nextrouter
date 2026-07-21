import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { AgentSettings, GroupOption, ModelOption } from '../../../types'
import {
  resolveAgentModel,
  resolveInitialAgentGroup,
} from '../resolve-agent-config'

const settings: AgentSettings = {
  system_prompt: '',
  default_model: 'preferred-model',
  default_group: 'preferred-group',
  temperature: null,
  max_tokens: null,
  max_iterations: 10,
}

const groups: GroupOption[] = [
  { label: 'default', value: 'default', ratio: 1 },
  { label: 'preferred-group', value: 'preferred-group', ratio: 1 },
]

const models: ModelOption[] = [
  { label: 'first-model', value: 'first-model' },
  { label: 'preferred-model', value: 'preferred-model' },
]

describe('resolveInitialAgentGroup', () => {
  test('uses the configured group when it is available to the user', () => {
    assert.equal(resolveInitialAgentGroup(groups, settings), 'preferred-group')
  })

  test('falls back to default and then the first available group', () => {
    const unavailable = { ...settings, default_group: 'missing' }
    assert.equal(resolveInitialAgentGroup(groups, unavailable), 'default')
    assert.equal(
      resolveInitialAgentGroup([groups[1]], unavailable),
      'preferred-group'
    )
  })
})

describe('resolveAgentModel', () => {
  test('keeps the current model when it remains available', () => {
    assert.equal(
      resolveAgentModel(models, 'first-model', 'preferred-model'),
      'first-model'
    )
  })

  test('falls back to the configured model and then the first model', () => {
    assert.equal(
      resolveAgentModel(models, 'missing', 'preferred-model'),
      'preferred-model'
    )
    assert.equal(
      resolveAgentModel(models, 'missing', 'also-missing'),
      'first-model'
    )
  })
})
