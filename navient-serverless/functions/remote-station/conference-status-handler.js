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
    ConferenceSid,
    FriendlyName,
    StatusCallbackEvent
  } = event;

  console.log(`Received ${StatusCallbackEvent} for conference ${FriendlyName}`);

  if (StatusCallbackEvent !== 'participant-join') {
    return callback(null, {});
  }

  const participants = await client
    .conferences(ConferenceSid)
    .participants
    .list();
  
  const worker = await client.taskrouter
    .workspaces(WORKSPACE_SID)
    .workers(FriendlyName)
    .fetch();

  console.log('Retrieved worker:', worker)
  const { stationNumber } = worker.attributes && JSON.parse(worker.attributes);
  console.log('stationNumber:', stationNumber);

  let isWorkerJoined = false;

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    const call = await client.calls(p.callSid).fetch();
    if (call.to === stationNumber) {
      isWorkerJoined = true;
      break;
    }
  }

  if (!isWorkerJoined) {
    const workerParticipant = await client.conferences(ConferenceSid)
      .participants
      .create({
        from: '+17868477747',
        to: stationNumber,
        earlyMedia: false,
        endConferenceOnExit: true,
        startConferenceOnEnter: true,
      });
    console.log('Worker joined:', workerParticipant.callSid);
  } else {
    console.log('Worker participant already joined');
  }

  callback(null, {});
};
