
import { params } from '../config/params'
import { AkeneoClient } from './common/akeneo';

const client = new AkeneoClient(params)

client.authenticate().then(() => {
  const cursor = client.cursor('products')
  cursor.get().then(() => {
    //console.log(cursor.getItems(), cursor.page)

    cursor.next().then(items => {
      //console.log(cursor.getItems(), cursor.page)

      cursor.prev().then(() => {
        console.log( cursor.getItems(), cursor.page)
      })
    })
  })
})
