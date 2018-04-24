import { AkeneoParser } from './akeneo'

test('Parsing a simple value', () => {
  const extract = {
    collection: [
      {
        locale: null,
        scope: null,
        data: 43,
      },
    ],
  }

  const obj = {}

  AkeneoParser.parseValues(obj, extract)
  expect(obj).toEqual({ collection: 43 })
})

test('Parsing a localized value', () => {
  const extract = {
    label: [
      { locale: 'es_ES', scope: null, data: 'Redacción en español' },
      { locale: 'fr_FR', scope: null, data: 'Un libellé en français' },
    ],
  }

  const expected = {
    label: {
      es_ES: 'Redacción en español',
      fr_FR: 'Un libellé en français',
    },
  }

  const obj = {}

  AkeneoParser.parseValues(obj, extract)
  expect(obj).toEqual(expected)
})

test('Parsing associations with empties', () => {
  const extract = {
    PACK: {
      groups: [],
      products: [],
      product_models: [],
    },
    PROVIDED_BY: {
      groups: [],
      products: ['A_SKU'],
      product_models: [],
    },
    SUBSTITUTION: {
      groups: [],
      products: [],
      product_models: ['ANOTHER_SKU'],
    },
  }

  const expected = {
    associations: {
      PACK: { groups: [], product_models: [], products: [] },
      PROVIDED_BY: { groups: [], product_models: [], products: ['A_SKU'] },
      SUBSTITUTION: {
        groups: [],
        product_models: ['ANOTHER_SKU'],
        products: [],
      },
    },
  }

  const obj = {}

  AkeneoParser.parseAssociations(obj, extract)
  expect(obj).toEqual(expected)
})

test('Parsing associations without empties', () => {
  const input = require('../../test/fixtures/associations')

  const [input, expected] = require('../../test/fixtures/associations')

  const obj = {}

  AkeneoParser.parseAssociations(obj, input, true)
  expect(obj).toEqual(expected)
})