
import { params } from '../config/params'
import { Client as restClient } from 'node-rest-client';
import btoa from 'btoa';

const client = new restClient();

client.post(
  params.server + "/api/oauth/v1/token" ,
  {
    headers: {
      "Content-Type": "application/json",
      "Authorization":
        "Basic " + btoa(params.clientId + ":" + params.secret)
     },
     data: {
        "username" : params.username,
        "password" : params.password,
        "grant_type": "password",
     }
  }, (data, response) => {
    // parsed response body as js object
    if (data.access_token) {
      params.access_token = data.access_token
      params.refreshToken = data.refreshToken

      client.get(
        params.server + "/api/rest/v1/products",
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + params.access_token
           }
        }, (data, response) => {
          console.log(data)
      });
    }
})

