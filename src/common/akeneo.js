import fetch from 'node-fetch'
import btoa from 'btoa'
import { stringify } from 'query-string'
export class AkeneoClient {
  constructor(params) {
    this.params = params

    this.endpoints = ['products', 'product', 'categories']
    this.token
    this.refreshToken
    this.expiresAt = 0
  }

  async connect() {
    if (this.expiresAt > Date.now()) {
      const auth = await this.authenticate()
    }
  }

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

      console.log('OAuth authentication successful')
    } else {
      console.log('OAuth authentication failed')
    }
  }

  async get(endpoint, params) {
    if (!this.endpoints.includes(endpoint)) {
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
        if (res.status == 200) {
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

  cursor(endpoint, limit) {
    if (!this.endpoints.includes(endpoint)) {
      throw new Error(`Unknown endpoint "${endpoint}"`)
    }

    return new AkeneoCursor(this, endpoint, limit)
  }
}

export class AkeneoCursor {
  constructor(client, endpoint, limit = 1) {
    this.client = client
    this.endpoint = endpoint
    this.limit = limit

    this.page = 0
    this.max = -1

    this.items
  }

  async get(params) {
    return await this.fetch(1)
  }

  async next() {
    return await this.fetch(this.page + 1)
  }

  async prev() {
    return await this.fetch(this.page - 1)
  }

  async fetch(page) {
    if (!this.pageExists(page)) {
      return false
    }

    const withCount = (page == 1)

    const json = await this.client.get(this.endpoint, {
      limit: this.limit,
      page: page,
      with_count: withCount,
    })

    this.populateCollection(json._embedded.items)

    if (page == 1) {
      this.max = json.items_count
    }

    return this.getItems()
  }

  populateCollection(items) {
    this.items = []
    for (let item of items) {
      this.items[item.identifier] = this.populateItem(item)
    }

    return this.items
  }

  populateItem(item) {
    const obj = {}
    for (let arr of Object.entries(item)) {
      console.log(arr)

      switch (arr[0]) {
        case 'associations':
          AkeneoParser.parseAssociations(obj, arr[1])
          break

        case 'values':
          AkeneoParser.parseValues(obj, arr[1])
          break

        default:
          if (arr[0].substring(0, 1) != '_') {
            obj[arr[0]] = arr[1]
          }
          break
      }
    }

    return obj
  }

  getItems() {
    return this.items
  }

  pageExists(page) {
    return page > this.max / this.limit
  }
}

export class AkeneoParser {
  static parseAssociations(obj, associations, removeEmpties = false) {
    obj.associations = {}
    for (let association of Object.entries(associations)) {
      if (removeEmpties === false) {
        obj.associations[association[0]] = association[1]
      } else {
        obj.associations[association[0]] = {}
        for (let types of association[1]) {
          console.log(type)
          if (type.length == 0) {
            continue
          }

          //obj.associations[association[0]] = type

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
