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
      { locale: 'es_ES', scope: null, data: 'Repose tête "Monza" ES' },
      { locale: 'fr_FR', scope: null, data: 'Repose tête "Monza"' },
    ],
  }

  const expected = {
    label: {
      es_ES: 'Repose tête "Monza" ES',
      fr_FR: 'Repose tête "Monza"',
    },
  }

  const obj = {}

  AkeneoParser.parseValues(obj, extract)
  expect(obj).toEqual(expected)
})
