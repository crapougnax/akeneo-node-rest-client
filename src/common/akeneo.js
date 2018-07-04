import fetch from 'node-fetch'
import btoa from 'btoa'
import { stringify } from 'query-string'
import AWS from 'aws-sdk'

/**
 * Akeneo API Client
 */
export class AkeneoClient {
  /**
   *
   * @param {object} params
   */
  constructor(params) {
    this.params = params
    this.endpoints = ['products', 'categories']
    this.token = null
    this.refreshToken = null
    this.expiresAt = 0
    this.defaultLocale = 'fr_FR'
  }

  /**
   * Connect to API if necessary
   */
  async connect() {
    if (this.expiresAt > Date.now()) {
      await this.authenticate()
    }
  }

  /**
   * Authenticate to PIM API
   */
  async authenticate() {
    const json = await fetch(`${this.params.server}/api/oauth/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:
          'Basic ' + btoa(this.params.clientId + ':' + this.params.secret),
      },
      body: JSON.stringify({
        username: this.params.username,
        password: this.params.password,
        grant_type: 'password',
      }),
    })
      .then((res) => {
        if (res.status == 200) {
          return res.json()
        } else {
          console.error(`Request returned status "${res.status}"`)
          return false
        }
      })
      .catch((err) => {
        console.error(err)
      })

    if (json !== false) {
      this.token = json.access_token
      this.refreshToken = json.refresh_token
      this.expiresAt = Date.now() + json.expires_in * 1000
      console.debug('OAuth authentication successful')
      return true
    } else {
      console.debug('OAuth authentication failed')
      return false
    }
  }

  /**
   * Execute GET query on API
   * @param {string} endpoint
   * @param {object} params
   */
  async get(endpoint, params) {
    if (
      !this.endpoints.includes(endpoint.substring(0, endpoint.indexOf('/')))
    ) {
      throw new Error(`Unknown endpoint "${endpoint}"`)
    }

    const qs = stringify(params)
    const json = await fetch(
      `${this.params.server}/api/rest/v1/${endpoint}?${qs}`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
      }
    )
      .then((res) => {
        if (res.status === 200) {
          return res.json()
        } else {
          console.error(
            `Request returned status "${res.status}" with message "${
              res.statusText
            }"`
          )
          return false
        }
      })
      .catch((err) => {
        console.error(err)
        return false
      })

    return json
  }

  /**
   * Return the binary content of a file attribute
   * @param {string} path
   * @param {function} callback
   */
  async blob(path, callback) {
    switch (this.params.storage) {
      case 's3':
        // @todo persist connection ?
        const s3 = new AWS.S3(this.params.s3.credentials)
        await s3.getObject(
          {
            Bucket: this.params.s3.bucket,
            Key: `${this.params.s3.prefix}${path}`,
          },
          callback
        )
        break

      default:
        // @todo implement default storage
        break
    }
  }

  /**
   * Return a cursor to a collection of records
   * @param {string} endpoint
   * @param {object} limit
   */
  cursor(endpoint, limit) {
    if (!this.endpoints.includes(endpoint)) {
      throw new Error(`Unknown endpoint "${endpoint}"`)
    }

    return new AkeneoCursor(this, endpoint, limit)
  }

  /**
   * Return an AkeneoEntity() instance matching the provided endpoint id
   * @param {string} endpoint
   * @param {string} id
   */
  entity(endpoint, id) {
    return new AkeneoEntity(this, endpoint, id)
  }

  /**
   * Return an AkeneoEntity() instance for a product matching the provided id
   * @param {string} id
   */
  product(id) {
    return this.entity('products', id)
  }
}

/**
 * Represents an entity
 */
export class AkeneoEntity {
  /**
   * Class constructor
   * @param {AkeneoClient} client
   * @param {string} endpoint
   * @param {string} id
   */
  constructor(client, endpoint, id) {
    this.client = client
    this.endpoint = endpoint
    this.id = id
    this.data = []
    this.subs = {
      products: {},
      groups: {},
    }
  }

  /**
   * Retrieve the entity data from the API
   * @returns {object}
   */
  async fetch() {
    const json = await this.client.get(`${this.endpoint}/${this.id}`)
    this.data = AkeneoParser.populateItem(json)
    return this.data
  }

  /**
   * Retrieve the value of the attribute matching the provided key
   * with respect of provided  or default locale
   * @param {string} key
   * @param {string} locale
   */
  attribute(key, locale = this.client.defaultLocale) {
    if (this.data[key]) {
      if (typeof this.data[key] === 'object' && this.data[key][locale]) {
        return this.data[key][locale]
      } else {
        return this.data[key]
      }
    } else {
      throw new Error(`Attribute '${key}' doesn't exist`)
    }
  }

  /**
   * Retrieve the binary content of the file attribute
   * matching the provided key
   * @param {string} key
   */
  async blob(key) {
    if (!this.data[key] || this.data[key].length === 0) {
      throw new Error(`Attribute '${key}' doesn't exist or has an empty value`)
    }
    await this.client.blob(this.data[key], (err, data) => {
      if (err) {
        throw new Error(`Attribute '${key}' value doesn't match a blob object`)
      }
      return data.Body.toString('binary')
    })
  }

  /**
   * Return a collection of associated products
   * or groups matching the provided key
   * @param {string} key
   * @param {string} type
   */
  async associations(key, type = 'products') {
    if (!this.subs[type][key]) {
      const associations = this.attribute('associations')
      this.subs[type][key] = []

      for (let sku of associations[key][type]) {
        const product = this.client.product(sku)
        this.subs[type][key].push(product)
        await product.fetch()
      }
    }

    return this.subs[type][key]
  }
  // AkeneoEntity class end
}

export class AkeneoCursor {
  constructor(client, endpoint, limit = 1) {
    this.client = client
    this.endpoint = endpoint
    this.limit = limit

    this.page = 0
    this.max = -1

    this.items = []
  }

  async get(params) {
    return this.fetch(1)
  }

  async next() {
    return this.fetch(this.page + 1)
  }

  async prev() {
    return this.fetch(this.page - 1)
  }

  async fetch(page) {
    if (!this.pageExists(page)) {
      return false
    }

    const withCount = page === 1

    const json = await this.client.get(this.endpoint, {
      limit: this.limit,
      page: page,
      with_count: withCount,
    })

    AkeneoParser.populateCollection(json._embedded.items)

    if (page === 1) {
      this.max = json.items_count
    }

    return this.getItems()
  }

  getItems() {
    return this.items
  }

  pageExists(page) {
    return page > this.max / this.limit
  }
}

export class AkeneoParser {
  static populateCollection(items) {
    this.items = []
    for (let item of items) {
      this.items[item.identifier] = this.populateItem(item)
    }

    return this.items
  }

  static populateItem(item) {
    const obj = {}
    for (let arr of Object.entries(item)) {
      // console.log(arr)

      switch (arr[0]) {
        case 'associations':
          AkeneoParser.parseAssociations(obj, arr[1])
          break

        case 'values':
          AkeneoParser.parseValues(obj, arr[1])
          break

        default:
          if (arr[0].substring(0, 1) !== '_') {
            obj[arr[0]] = arr[1]
          }
          break
      }
    }

    return obj
  }

  static parseAssociations(obj, associations, removeEmpties = false) {
    obj.associations = {}
    for (let association of Object.entries(associations)) {
      if (removeEmpties === false) {
        obj.associations[association[0]] = association[1]
      } else {
        obj.associations[association[0]] = {}
        for (let type of association[1]) {
          if (type.length === 0) {
            continue
          }
        }
      }
    }
  }

  static parseValues(obj, values) {
    for (let value of Object.entries(values)) {
      if (value[1].length > 1) {
        obj[value[0]] = {}
        for (let version of value[1]) {
          obj[value[0]][version.locale] = version.data
        }
      } else {
        obj[value[0]] = value[1][0].data
      }
    }
  }
}
