import * as Flex from '@twilio/flex-ui';
import FlexState from '../states/FlexState';

const hangupNonWebRtcCall = async (task) => {
  const { conference } = task;
  const { conferenceSid, participants } = conference;
  const workerParticipant = participants.find(p => p.workerSid === FlexState.workerSid);
  
  const { callSid: participantCallSid } = workerParticipant;
  const removeParticipantUrl = `https://navient-serverless-2279-dev.twil.io/conference/remove-participant`;

  const fetchBody = {
    conferenceSid,
    participantCallSid
  };
  const fetchResponse = await fetch(removeParticipantUrl, {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST',
    body: JSON.stringify(fetchBody)
  });
  let response;
  try {
    response = fetchResponse && await fetchResponse.json();
  } catch (error) {
    console.error('Unable to parse remove participant response to JSON.', error);
  }
  console.debug('*** Conference participant remove response:', response);
}

Flex.Actions.addListener('beforeWrapupTask', async (payload, abort) => {
  if (FlexState.isWorkerUsingWebRTC()) {
    return;
  }
  const { task } = payload;
  if (!Flex.TaskHelper.isCallTask(task)) {
    return;
  }
  await hangupNonWebRtcCall(task);
  abort();
});

Flex.Actions.addListener('beforeHangupCall', async (payload, abort) => {
  if (FlexState.isWorkerUsingWebRTC()) {
    return;
  }
  const { task } = payload;
  if (!Flex.TaskHelper.isCallTask(task)) {
    return;
  }
  await hangupNonWebRtcCall(task);
  abort();
})
