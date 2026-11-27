'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTheme } = require('../src/theme.js');

const memory = (initial = {}) => {
  const data = { ...initial };
  return { data, getItem: (key) => data[key] ?? null, setItem: (key, value) => (data[key] = value) };
};
const setup = (storage = memory(), prefersDark = false) => {
  const element = { dataset: {} };
  return { element, storage, theme: createTheme({ element, storage, prefersDark }) };
};

test('without a saved choice the theme follows the system', () => {
  assert.equal(setup(memory(), true).element.dataset.theme, 'dark');
  assert.equal(setup(memory(), false).element.dataset.theme, 'light');
});

test('a saved choice wins over the system and unknown values are ignored', () => {
  assert.equal(setup(memory({ 'alysion-theme': 'light' }), true).theme.current(), 'light');
  assert.equal(setup(memory({ 'alysion-theme': 'pink' }), true).theme.current(), 'dark');
});

test('toggling switches the page and remembers the choice', () => {
  const { element, storage, theme } = setup();
  assert.equal(theme.toggle(), 'dark');
  assert.equal(element.dataset.theme, 'dark');
  assert.equal(storage.data['alysion-theme'], 'dark');
  assert.equal(setup(storage).theme.current(), 'dark');
  assert.equal(theme.toggle(), 'light');
});

test('blocked storage still lets the theme change', () => {
  const blocked = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  const { element, theme } = setup(blocked, true);
  assert.equal(theme.toggle(), 'light');
  assert.equal(element.dataset.theme, 'light');
});
