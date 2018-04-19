
import fetch from 'node-fetch';
import btoa from 'btoa';
import { stringify } from 'query-string';
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
        "Content-Type": "application/json",
        "Authorization": "Basic " + btoa(
          this.params.clientId + ":" + this.params.secret
        )
      },
      body: JSON.stringify({
        "username" : this.params.username,
        "password" : this.params.password,
        "grant_type": "password",
      })
    })
    .then(res => {
      if (res.status == 200) {
        return res.json()
      } else {
        console.error(`Request returned status "${res.status}"`)
        return false
      }
    })
    .catch (err => {
      console.error(err)
    })

    if (json !== false) {
      this.token = json.access_token
      this.refreshToken = json.refresh_token
      this.expiresAt = Date.now() + (json.expires_in*1000)

      console.log("OAuth authentication successful")
    } else {
      console.log("OAuth authentication failed")
    }
  }

  async get(endpoint, params) {
    if (! this.endpoints.includes(endpoint)) {
      throw new Error(`Unknown endpoint "${endpoint}"`)
    }

    const qs = stringify(params)
    const json = await fetch(`${this.params.server}/api/rest/v1/${endpoint}?${qs}`, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.token}`,
      }
    })
    .then(res => {
      if (res.status == 200) {
        return res.json()
      } else {
        console.error(`Request returned status "${res.status}" with message "${res.statusText}"`)
        return false
      }
    })
    .catch(err => {
      console.error(err)
      return false
    })

    return json
  }

  cursor(endpoint, limit) {
    if (! this.endpoints.includes(endpoint)) {
      throw new Error(`Unknown endpoint "${endpoint}"`)
    }

    return new AkeneoCursor(this, endpoint, limit)
  }
}

export class AkeneoCursor {

  constructor(client, endpoint, limit = 10) {
    this.client = client
    this.endpoint = endpoint
    this.limit = limit

    this.page = 0
    this.max = -1

    this.items
  }

  async fetch(params) {
    const json = await this.client.get(
      this.endpoint, {
        limit: this.limit,
        with_count: true
      }
    )

    if (json._links) {
    }

    this.page = json.current_page
    this.max = json.items_count

    return json
  }

  async next() {

    if (this.page + 1 > this.max / this.limit) {
      return false
    }

    const json = await this.client.get(
      this.endpoint, {
        page: this.page+1,
        limit: this.limit,
      }
    )

    return json
  }

  async get(page) {
    const json = await this.client.get(
      this.endpoint, {
        limit: this.limit,
        with_count: true
      }
    )

    this.populate(json.items)

    if (json._links) {
    }

    if (page == 1) {
      this.max = json.items_count
    }

    return json
  }

  populate(items) {
    this.items = items
  }

  getItems() {
    return this.items
  }
}
