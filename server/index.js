require('dotenv').config();
const express = require('express');
const { requiresAuth } = require('express-openid-connect');
const router = express.Router();
const {Flashcard, User} = require('../models/user');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');

router.get('/', (req, res) => {
    res.render('index.ejs', {isAuthenticated:req.oidc.isAuthenticated()});
})


router.get('/dashboard', requiresAuth(), async (req, res) => {
    if(!req.oidc.isAuthenticated()){
        res.redirect('/login');
    }else if(!await isPaying(req.oidc.user)){
        const url = await getCheckout(req.oidc.user.email);
        res.redirect(url);
    }else{
        res.render('dashboard.ejs', {user:req.oidc.user, isAuthenticated:req.oidc.isAuthenticated()})
    }
})

router.post('/webhooks', (req, res) =>{
    //falta handle fake posts con el secret
    const secret = `${process.env.SECRET_SIGNING_LEMON}`;
    const hmac = crypto.createHmac('sha256', secret);
    const digest = Buffer.from(hmac.update(req.rawBody).digest('hex'), 'utf8');
    const sign = Buffer.from(req.get('X-Signature') || '', 'utf8');

    if (!crypto.timingSafeEqual(digest, sign)) {
        console.log('invalidsignature');
        return res.status(403).send('Invalid signature');
    }else{
        const { body: {meta: { event_name, custom_data} } } = req;
        let subscriptionId;
        switch(event_name){
            case "subscription_created":
                subscriptionId = req.body['data']['id'];
                createdSubscription(custom_data, subscriptionId);
                break;
            case "subscription_resumed":
                subscriptionId = req.body['data']['id'];
                createdSubscription(custom_data, subscriptionId);
                break;
            case "subscription_expired":
                expiredSubscription(custom_data);
                break;
            default:
                console.log(event_name);
        }
    }
})

const uploadDir = path.join(__dirname, '../uploads/temp');

const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        // Generate a unique filename for the uploaded file
        const uniqueFilename = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueFilename);
    }
  });

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
      if (
        file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/vnd.ms-powerpoint' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      ) {
        // Accept the file
        cb(null, true);
      } else {
        // Reject the file
        cb(new Error('Invalid file type. Only PDFs and PowerPoint presentations are allowed.'));
      }
    },
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });
  
router.post('/upload', function(req, res, next) {
    if (!req.oidc.isAuthenticated()) {
        return res.status(403).send('Access denied');
    }
    const referer = req.headers.referer;
    if (!referer || !referer.endsWith('/dashboard')) {
        return res.status(403).send('Access denied');
    }
    // The request came from the /dashboard page and the user is authenticated, process the file
    upload.single('file')(req, res, function(err) {
        if(err){
            console.log(err);
            return next(err);
        }
        const uploadedFile = req.file;
        if (!req.file) {
            return res.status(400).send('No file was included in the request');
        }
        console.log(uploadedFile);
        res.send('File processed successfully');
    });
    // Step 4: Remove the file
    // Remove the uploaded file from the temporary directory
    // fs.unlink(uploadedFile.path, (err) => {
    //   if (err) {
    //     console.error('Error occurred while removing the uploaded file:', err);
    //   }
    //   // File removal completed
    // });
  
    // Send a response to the client

  });
  
module.exports= router;

// res.render('index.ejs', {isAuthenticated:req.oidc.isAuthenticated()});


const isPaying = async (user) => {
    const email = user.email;
    const userQuery = await User.findOne({ 'email': email }).exec();
    console.log(userQuery);
    if(userQuery !== null){
        if(userQuery.status === 'active'){
            return true;
        }
    }else{
        return false;
    }
}

require('dotenv').config()
const getCheckout = async (email) =>{
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
                    "email": `${email}`,
                }
            },
            "product_options": {
                "redirect_url": `${process.env.BASE_URL}/dashboard`
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
            "id": `${[process.env.VARIANT]}`
            }
        }
        }
    }
    };

    return fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(responseData => {
        // return responseData
        return responseData['data']['attributes']['url'];
    })
    .catch(error => {
        console.error("Error:", error);
    });
}

const createdSubscription = async (customData, subscriptionId) =>{
    //actualizar db
    const email = customData['email'];
    const userQuery = await User.findOne({ 'email': email }).exec();
    console.log(userQuery)
    if (userQuery !== null) {
        // User already exists, changes the status property to active
        console.log(`User with email ${email} already exists`);
        userQuery.status = 'active';
        await userQuery.save();
        console.log(userQuery);
        return;
    }
    // User doesn't exist, create a new user with active status
    const newUser = new User({
        email,
        status: 'active',
        flashcards : [],
        subscriptionId: subscriptionId,
    });
    await newUser.save();
    console.log("created ", customData);
}

const expiredSubscription = async (customData) => {
    const userEmail = customData['email'];
    const userQuery = await User.findOne({'email': `${userEmail}`}).exec();
    userQuery.status = 'expired';
    await userQuery.save();
}

const cancelledSubcription = async (userAuth0) => {
    const userEmail = userAuth0.email;
    const userQuery = await User.findOne({'email': userEmail});
    const subId = userQuery.subscriptionId;

    const url = `https://api.lemonsqueezy.com/v1/subscriptions/${subId}`;
    const headers = {
    "Accept": "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
    "Authorization": `Bearer ${process.env.LEMON_APIKEY}`
    };

    fetch(url, {
        method: "DELETE",
        headers: headers,
        body: JSON.stringify(data)
    })
}