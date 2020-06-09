

class ConferenceService {
  static updateParticipant = async (conferenceSid, participantCallSid, updateProperties) => {
    const updateParticipantUrl = 'https://navient-serverless-2279-dev.twil.io/conference/update-participant';
    const fetchBody = {
      conferenceSid,
      participantCallSid,
      ...updateProperties
    };
    const fetchResponse = await fetch(updateParticipantUrl, {
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
      console.error('Unable to parse update participant response to JSON.', error);
    }
    console.debug('*** Conference participant updated:', response);
  }

  static muteParticipant = async (conferenceSid, participantCallSid) => {
    const updateProperties = {
      muted: true
    };
    await this.updateParticipant(conferenceSid, participantCallSid, updateProperties);
  }

  static unMuteParticipant = async (conferenceSid, participantCallSid) => {
    const updateProperties = {
      muted: false
    };
    await this.updateParticipant(conferenceSid, participantCallSid, updateProperties);
  }
}

export default ConferenceService;
