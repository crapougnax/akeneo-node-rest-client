export const input = {
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

export const expectedWithEmpties = {
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