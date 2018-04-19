
import { params } from '../config/params'
import { AkeneoClient } from './common/akeneo';

const client = new AkeneoClient(params)

client.authenticate().then(() => {
  const cursor = client.cursor('products')
  cursor.fetch().then(() => {

    console.log(cursor.getItems())

    cursor.next().then(items => {
      console.log(items)
    })
  })
})
