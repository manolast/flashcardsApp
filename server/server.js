require('dotenv').config();
const express = require('express');
const { auth, requiresAuth } = require('express-openid-connect');
const indexRouter = require('./index.js');
const db = require('../db');
const bodyParser = require('body-parser');
const path = require('path');


const app = express();

app.set('view_engine', 'ejs');
app.set('views', path.join(__dirname, '/../public/views'));

const config = {
    authRequired: false,
    auth0Logout: true,
    secret: process.env.SECRET,
    baseURL: process.env.BASE_URL,
    clientID: process.env.CLIENT_ID,
    issuerBaseURL: process.env.ISSUER
};


// app.use(express.static('./../public'))
app.use(auth(config));
app.use(bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf
    }
  }))

app.use('/', indexRouter);


db.once('open', () => {
    app.listen(3000, () => {
      console.log('Server started on port 3000');
    });
  });

const { get } = require(".");

const getCheckout = (userId) =>{
    const url = "https://api.lemonsqueezy.com/v1/checkouts";
    const headers = {
    "Accept": "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
    "Authorization": `Bearer ${process.env.LEMON_APIKEY}`
    };

    const data = {
    "data": {
        "type": "checkouts",
        "attributes": {
        "checkout_data": {
            "custom": {
            "user_id": `${userId}`,
            "campaign_id": "abc"
            }
        }
        },
        "relationships": {
        "store": {
            "data": {
            "type": "stores",
            "id": `${process.env.STORE_ID}`
            }
        },
        "variant": {
            "data": {
            "type": "variants",
            "id": `${process.env.VARIANT}`
            }
        }
        }
    }
    };

    fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(responseData => {
        return responseData['data']['attributes']['url']
    })
    .catch(error => {
        console.error("Error:", error);
    });
}