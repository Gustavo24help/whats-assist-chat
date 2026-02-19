import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseOperationalScore,
  parseNpsScore,
  classifyNps,
  npsFeedbackType,
  shouldProcessOperationalFirst,
} from '../supabase/functions/twilio-webhook/score-routing.js';

test('parseOperationalScore accepts only strict 1-5', () => {
  assert.equal(parseOperationalScore('1'), 1);
  assert.equal(parseOperationalScore('5'), 5);
  assert.equal(parseOperationalScore(' 3 '), 3);
  assert.equal(parseOperationalScore('0'), null);
  assert.equal(parseOperationalScore('6'), null);
  assert.equal(parseOperationalScore('nota 4'), null);
  assert.equal(parseOperationalScore('5 estrelas'), null);
});

test('parseNpsScore accepts strict 0-10', () => {
  assert.equal(parseNpsScore('0'), 0);
  assert.equal(parseNpsScore('10'), 10);
  assert.equal(parseNpsScore(' 8 '), 8);
  assert.equal(parseNpsScore('11'), null);
  assert.equal(parseNpsScore('nota 9'), null);
});

test('NPS classification helpers match business rules', () => {
  assert.equal(classifyNps(10), 'promotor');
  assert.equal(classifyNps(9), 'promotor');
  assert.equal(classifyNps(8), 'neutro');
  assert.equal(classifyNps(7), 'neutro');
  assert.equal(classifyNps(6), 'detrator');

  assert.equal(npsFeedbackType(9), 'positivo');
  assert.equal(npsFeedbackType(7), 'neutro');
  assert.equal(npsFeedbackType(3), 'negativo');
});

test('operational routing has priority only when pending operational exists', () => {
  assert.equal(
    shouldProcessOperationalFirst({ text: '4', hasPendingOperational: true }),
    true,
  );
  assert.equal(
    shouldProcessOperationalFirst({ text: '4', hasPendingOperational: false }),
    false,
  );
  assert.equal(
    shouldProcessOperationalFirst({ text: '9', hasPendingOperational: true }),
    false,
  );
});
