const Twilio = require('twilio');
const fs = require('fs');
const https = require('https');

exports.handler = async function(context, event, callback) {
  let response = new Twilio.Response();
  let headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
  response.setHeaders(headers);

  // const {
  //   ACCOUNT_SID,
  //   AUTH_TOKEN
  // } = context;

  // const client = Twilio(ACCOUNT_SID, AUTH_TOKEN);

  const {
    certType
  } = event;
  
  console.log('Requested certType:', certType);

  // VERY INSECURE!! ONLY USING THIS TO ALLOW HITTING AN API SECURED
  // WITH A SELF SIGNED CERTIFICATE. REMOVE WHEN TESTING AGAINST AN
  // API USING A PROPER CERTIFICATE FROM A TRUSTED CA.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';

  const validClientKeyFile = Runtime.getAssets()['/client_valid_key.pem'].path;
  const validClientCertFile = Runtime.getAssets()['/client_valid_cert.pem'].path;

  const invalidClientKeyFile = Runtime.getAssets()['/client_invalid_key.pem'].path;
  const invalidClientCertFile = Runtime.getAssets()['/client_invalid_cert.pem'].path;

  let clientKeyFile;
  let clientCertFile;
  
  switch(certType) {
    case 'valid': {
      console.log('Valid cert requested');
      clientKeyFile = validClientKeyFile;
      clientCertFile = validClientCertFile;
      break;
    }
    case 'invalid': {
      console.log('Invalid cert requested');
      clientKeyFile = invalidClientKeyFile;
      clientCertFile = invalidClientCertFile;
      break;
    }
    default: {
      console.log('No cert requested');
      // Nothing to do here
    }
  };

  const requestOptions = {
    hostname: '144.202.94.213',
    port: 443,
    path: '/authenticate',
    method: 'POST',
    key: clientKeyFile && fs.readFileSync(clientKeyFile),
    cert: clientCertFile && fs.readFileSync(clientCertFile),
  };

  const req = https.request(requestOptions, (res) => {
    console.log('HTTPS Response Status Code:', res.statusCode);
    res.setEncoding('utf8');
    let body = '';
    res.on('data', (data) => {
      body += data;
    });
    res.on('end', () => {
      body = JSON.parse(body);
      console.log('Response body:', body);
      response.setBody(body);
      callback(null, response);
    })
  });
  req.end();
};
