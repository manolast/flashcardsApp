require('dotenv').config();
const express = require('express');
const { requiresAuth } = require('express-openid-connect');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const {generateTextChunksFromPDF, gptApiCall} = require('./functions.js');
var ManagementClient = require('auth0').ManagementClient;
const fs = require('fs');
const {encode} = require('gpt-tokenizer');
const util = require('util');
// const writeFileAsync = util.promisify(fs.writeFile);
const writeFileAsync = async (file, data) => {
    await fs.promises.writeFile(file, data, { flag: 'a' });
  };    
const {getUser, insertUser, updateUserTokens, updateDatabaseWebhook, updateDatabaseGrade} = require('../db');
const axios = require('axios');



const planLimits = {
    free:process.env.FREE_PLAN_LIMIT,
    basic: process.env.BASIC_PLAN_LIMIT,
    premium:process.env.PREMIUM_PLAN_LIMIT,
}

router.get('/', (req, res) => {
    res.render('./main/index.ejs', {isAuthenticated:req.oidc.isAuthenticated()});
})

router.get('/dashboard', requiresAuth(), async (req, res) => {
    if(!req.oidc.isAuthenticated()){
        res.redirect('/login');
    }else{
        let user = await getUser(req.oidc.user.sub);
        console.log('user: ', user)
        if(user == null){
            const newUserId = await insertUser(req.oidc.user);
            console.log('new user: ', newUserId)
            user = {
                email: req.oidc.user.email,
                plan: 'free',
                tokens:0,
                token_limit: process.env.FREE_PLAN_LIMIT
            }
        }
        //switch to the mysql approach
        res.render('./dashboard/dashboard.ejs', {user, auth0user: req.oidc.user})
    }
})

router.get('/signup', (req, res) => {
    if(!req.oidc.isAuthenticated()){
        res.oidc.login({
            returnTo: '/dashboard',
            authorizationParams: {
                screen_hint: 'signup',
            },
        });
    }else{
        res.redirect('/dashboard');
    }

});

router.get('/basic', requiresAuth(), async (req, res) =>{
    const checkoutUrl = await(getCheckoutBasic(req.oidc.sub));
    res.redirect(checkoutUrl);
})

router.get('/premium', requiresAuth(), async (req, res) =>{
    const checkoutUrl = await(getCheckoutPremium(req.oidc.sub));
    res.redirect(checkoutUrl);
})

const uploadDir = path.join(__dirname, '../uploads/temp');

const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        const uniqueFilename = `${Date.now()}-${file.originalname}`;
        req.generatedFilename = uniqueFilename;
        cb(null, uniqueFilename);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (
            file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            const error = new Error('Invalid file type. Only PDFs are allowed.');
            error.statusCode = 400;
            cb(error, false);
      }
    },
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
  });
  
router.post('/upload', async function(req, res, next) {
    if (!req.oidc.isAuthenticated()) {
        return res.status(403).send('Access denied');
    }
    const referer = req.headers.referer;
    if (!referer || (referer !== `${process.env.BASE_URL}/dashboard` && referer !== `${process.env.BASE_URL}/dashboard/`)) {
        return res.status(403).send('Access denied');
    }
    upload.single('file')(req, res, async function(err) {
        if(err){
            err.message = err.message || 'An error occurred during file upload. Please try again.';
            return res.status(err.statusCode || 500).json({ error: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file was included in the request' });
        }
        try {
            const pdfFilename = req.generatedFilename;
            const uploadedFileDir = path.join(uploadDir, pdfFilename);
            
            const filename = `${pdfFilename}-flashcards.txt`;
            const txtFilepath = path.join(__dirname, '../generated_files', filename);
            const fileTopic = req.topic || req.body.topic;
            console.log("topic: "+ fileTopic);
            //uploaded file, topic, destinyFile, user-tokens, token-limit, user subid
            const flashcardGeneration = await generateFlashcards(uploadedFileDir, fileTopic, txtFilepath, 0, 600, req.oidc.user.sub);
            const fileUrl = `${req.protocol}://${req.get('host')}/download/${filename}`;
            if(flashcardGeneration === 'exceeded quota'){
                return res.json({ error: 'quota', fileUrl });
            }else{
                res.json({ message: 'success', fileUrl });
            }
            try {
                fs.unlink(uploadedFileDir, (error) => {
                    if (error) {
                        console.error('Error al eliminar el archivo PDF:', error);
                    } else {
                        console.log('Archivo PDF eliminado correctamente');
                    }
                });
            } catch (error) {
                console.error('Error al eliminar el archivo PDF:', error);
            }
        }catch (error){
            console.error('Error during flashcard generation:', error);
            return res.status(500).json({ error: 'Failed to generate flashcards' });
        }
    });
  });

  async function generateFlashcards(uploadedFile, topic, destinyFile, tokens, limit, userSub) {
    try {
        const chunkedDocuments = await generateTextChunksFromPDF(uploadedFile);
        for (let i = 0; i < chunkedDocuments.length; i++) {
            const doc = chunkedDocuments[i];
            const docTokens = encode(doc).length;
            console.log(doc);
            console.log('doc tokens: ', docTokens);
            if(tokens + docTokens < limit){
                let gptResponse = await gptApiCall(doc, topic);
                gptResponse = gptResponse['content'];
                gptResponse += '\n';
                console.log(gptResponse)
                await writeFileAsync(destinyFile, gptResponse);
                tokens += docTokens;
            }else{
                console.log('quota exceeded');
                const update = await updateUserTokens(userSub, tokens);
                if(!update){
                    console.error('couldnt update tokens');
                }
                return 'exceeded quota';
            }
        }
        const update = await updateUserTokens(userSub, tokens);
        if(!update){
            console.error('couldnt update tokens');
        }
        return destinyFile;

    } catch (err) {
            console.error('Error during flashcard generation:', err);
            throw new Error('Failed to generate flashcards');
    }
}

  router.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../generated_files', filename);
  
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/plain'); 
    res.sendFile(filePath);
  });

  router.post('/upgrade', async (req, res) =>{
    if (!req.oidc.isAuthenticated()) {
        return res.status(403).send('Access denied');
    }else{
        const user = await getUser(req.oidc.user.sub);
        const plan = user.plan;
        let redirectUrl ="";
        if(plan === 'basic'){
            if(await upgradePlan(user.lemon_sub_id, user.cycle)){
                res.json(message, "Plan upgraded successfully.")
            }

        }else{
            res.redirect('/#pricing');
        }
    }
})

router.post('/downgrade', async (req, res) =>{
    if (!req.oidc.isAuthenticated()) {
        return res.status(403).send('Access denied');
    }else{
        const user = await getUser(req.oidc.user.sub);
        const plan = user.plan;
        let redirectUrl ="";
        if(plan === 'premium'){
            let sape = await downgradePlan(user.lemon_sub_id, user.cycle);
            if(sape){
                res.json({message: "Downgrade successful"})
            }
        }else{
            redirectUrl = '/pricing';
            res.json({redirectUrl});
        }
    }
});

router.post('/webhooks', async (req, res) =>{
    const secret = `${process.env.SECRET_SIGNING_LEMON}`;
    const hmac = crypto.createHmac('sha256', secret);
    const digest = Buffer.from(hmac.update(req.rawBody).digest('hex'), 'utf8');
    const sign = Buffer.from(req.get('X-Signature') || '', 'utf8');

    if (!crypto.timingSafeEqual(digest, sign)) {
        console.log('invalidsignature');
        return res.status(403).send('Invalid signature');
    }else{
        console.log(req.body)
        const { body: {meta: { event_name, custom_data} } } = req;
        let subscriptionId;
        let sub;
        let variantName;
        let productName;
        let limit;
        let userTriggered;
        switch(event_name){
            case "subscription_created":
                subscriptionId = req.body['data']['id'];
                sub = custom_data.sub;
                variantName = req.body['data']['attributes']['variant_name'];
                productName = req.body['data']['attributes']['product_name'];
                productName = productName.substring(0, productName.indexOf(' '));
                limit = planLimits[productName.toLowerCase()]
                if(variantName.toLowerCase() === 'yearly'){
                    limit *= 12;
                }
                if(await updateDatabaseWebhook(sub, productName.toLowerCase(), subscriptionId, limit, variantName.toLowerCase())){
                    console.log('updated correctly')
                }
                break;
            case "subscription_updated":
                const status = req.body['data']['attributes']['status'];
                if(status === 'active'){
                    subscriptionId = req.body['data']['id'];
                    sub = custom_data.sub;
                    variantName = req.body['data']['attributes']['variant_name'];
                    productName = req.body['data']['attributes']['product_name'];
                    productName = productName.substring(0, productName.indexOf(' '));
                    limit = planLimits[productName.toLowerCase()];
                    if(variantName.toLowerCase() === 'yearly'){
                        limit *= 12;
                    }
                    //se upgrade
                    if(await updateDatabaseWebhook(sub, productName.toLowerCase(), subscriptionId, limit)){
                        console.log('subscription_updaated, DB updated correctly')
                    }
                }
                break;
            case "subscription_expired":
                sub = custom_data.sub;
                productName = req.body['data']['attributes']['product_name'];
                productName = productName.substring(0, productName.indexOf(' '));
                userTriggered = await getUser(sub);
                console.log(userTriggered);
                console.log(productName);
                if(userTriggered.plan === productName.toLowerCase()){
                    limit = planLimits['free'];
                    if(await updateDatabaseWebhook(sub, 'free', null, limit)){
                        console.log('expired handled correctly');
                    }
                }
                break;
            default:
                console.log(event_name);
        }
    }
})

const getCheckoutPremium = async (sub) =>{
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
                    "sub": `${sub}`,
                }
            },
            "product_options": {
                "redirect_url": `${process.env.BASE_URL}/dashboard`,
                "enabled_variants": [process.env.PREMIUM_YEARLY_VARIANT, process.env.PREMIUM_MONTHLY_VARIANT]
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
            "id": `${[process.env.PREMIUM_YEARLY_VARIANT]}`
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
const getCheckoutBasic = async (sub) =>{
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
                    "sub": `${sub}`,
                }
            },
            "product_options": {
                "redirect_url": `${process.env.BASE_URL}/dashboard`,
                "enabled_variants": [process.env.BASIC_YEARLY_VARIANT, process.env.BASIC_MONTHLY_VARIANT]
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
            "id": `${[process.env.BASIC_YEARLY_VARIANT]}`
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

const cancelSubscription = async (lemon_sub_id) => {
    const url = `https://api.lemonsqueezy.com/v1/subscriptions/${lemon_sub_id}`;
    const headers = {
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        "Authorization": `Bearer ${process.env.LEMON_APIKEY}`
    };

    try {
        const response = await axios.delete(url, { headers });

        console.log("Subscription cancelled:", response.data);
    } catch (error) {
        console.error("An error occurred:", error.response ? error.response.data : error.message);
    }
};

const upgradePlan = async (lemon_sub_id, cycle) => {
    let variant = process.env.PREMIUM_MONTHLY_VARIANT
    if(cycle === 'yearly'){
        variant = process.env.PREMIUM_YEARLY_VARIANT;
    }
    const url = `https://api.lemonsqueezy.com/v1/subscriptions/${lemon_sub_id}`;
    const headers = {
        "Accept": "application/vnd.api+j    son",
        "Content-Type": "application/vnd.api+json",
        "Authorization": `Bearer ${process.env.LEMON_APIKEY}`
    };
    const data = {
        "data": {
            "type": "subscriptions",
            "id": `${lemon_sub_id}`,
            "attributes": {
                "product_id": `${process.env.PREMIUM_PLAN_ID}`,
                "variant_id": `${variant}`,
                "disable_prorations": true,
                "invoice_immediately": true
            }
        }
    };

    try {
        const response = await axios.patch(url, data, { headers });
        console.log('previous subid:  ', lemon_sub_id)
        console.log("Subscription upgraded:", response.data);
        let productName = response.data['data']['attributes']['product_name'];
        productName = productName.substring(0, productName.indexOf(' '));
        let limit = planLimits[productName.toLowerCase()]
        if(cycle === 'yearly'){
            limit *= 12;
        }   
        if(await updateDatabaseGrade(productName.toLowerCase(), lemon_sub_id, limit, cycle)){
            console.log("upgrade on db successful");
            return true;
        }
    } catch (error) {
        console.error("An error occurred:", error.response ? error.response.data : error.message);
        return false;
    }
};
const downgradePlan = async (lemon_sub_id, cycle) => {
    let variant = process.env.BASIC_MONTHLY_VARIANT
    if(cycle === 'yearly'){
        variant = process.env.BASIC_YEARLY_VARIANT;
    }
    const url = `https://api.lemonsqueezy.com/v1/subscriptions/${lemon_sub_id}`;
    const headers = {
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        "Authorization": `Bearer ${process.env.LEMON_APIKEY}`
    };
    const data = {
        "data": {
            "type": "subscriptions",
            "id": `${lemon_sub_id}`,
            "attributes": {
                "product_id": `${process.env.BASIC_PLAN_ID}`,
                "variant_id": `${variant}`,
                "disable_prorations": true,
                "invoice_immediately": true
            }
        }
    };

    try {
        const response = await axios.patch(url, data, { headers });
        console.log('previous subid:  ', lemon_sub_id)
        console.log("Subscription downgraded: ", response.data);
        let productName = response.data['data']['attributes']['product_name'];
        productName = productName.substring(0, productName.indexOf(' '));
        let limit = planLimits[productName.toLowerCase()]
        if(cycle === 'yearly'){
            limit *= 12;
        }
        if(await updateDatabaseGrade(productName.toLowerCase(), lemon_sub_id, limit, cycle)){
            console.log("downgrde on db successful");
            return true;
        }
    } catch (error) {
        console.error("An error occurred:", error.response ? error.response.data : error.message);
        return false;
    }
};





    // Step 4: Remove the file
    // Remove the uploaded file from the temporary directory
    // fs.unlink(uploadedFile.path, (err) => {
    //   if (err) {
    //     console.error('Error occurred while removing the uploaded file:', err);
    //   }
    //   // File removal completed
    // });
  
    // Send a response to the client

// res.render('index.ejs', {isAuthenticated:req.oidc.isAuthenticated()});
module.exports= router;