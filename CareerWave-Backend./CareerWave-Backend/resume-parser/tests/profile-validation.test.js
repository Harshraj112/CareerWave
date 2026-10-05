import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProfileInput } from '../src/parser.js';

test('rejects empty profile payload before any LLM call', () => {
  assert.throws(() => validateProfileInput({}), /at least one meaningful profile field/i);
});

test('accepts meaningful profile payload', () => {
  assert.doesNotThrow(() =>
    validateProfileInput({
      targetRole: 'SDE',
      experienceLevel: 'Beginner',
      skills: ['Python', 'JavaScript'],
    })
  );
});
