const Twilio = require('twilio');

exports.handler = async function(context, event, callback) {
  const {
    ACCOUNT_SID,
    AUTH_TOKEN,
    DOMAIN_NAME,
    WORKSPACE_SID
  } = context;

  const client = Twilio(ACCOUNT_SID, AUTH_TOKEN);

  const {
    From,
    To
  } = event;

  const matchingWorkers = await client.taskrouter
    .workspaces(WORKSPACE_SID)
    .workers
    .list({
      targetWorkersExpression: `contact_uri == "${To}"`
    });

  const targetWorkerSid = matchingWorkers && matchingWorkers[0].sid;
  console.log('targetWorkerSid:', targetWorkerSid);

  const twiml = new Twilio.twiml.VoiceResponse();

  const dial = twiml.dial();

  dial.conference({
    endConferenceOnExit: false,
    startConferenceOnEnter: false,
    statusCallback: `https://${DOMAIN_NAME}/remote-station/conference-status-handler`,
    statusCallbackEvent: 'start end join leave'
  }, targetWorkerSid);
  console.log('twiml:', twiml.toString());

  callback(null, twiml);
};
