import React from 'react';
import {
  IconButton,
  TaskHelper,
  withTheme
} from '@twilio/flex-ui';
import ConferenceService from '../services/ConferenceService';
import FlexState from '../states/FlexState';


class CustomMuteButton extends React.PureComponent {
  handleClick = async () => {
    console.debug('*** Custom Mute Button clicked');
    const { task } = this.props;
    const { conference } = task;
    const { conferenceSid, participants } = conference;
    const workerParticipant = participants.find(p => p.workerSid === FlexState.workerSid);
  
    const { callSid: participantCallSid } = workerParticipant;
    if (workerParticipant.muted) {
      await ConferenceService.unMuteParticipant(conferenceSid, participantCallSid);
    } else {
      await ConferenceService.muteParticipant(conferenceSid, participantCallSid);
    }
  }

  render() {
    const { task, theme } = this.props;
    const { conference } = task;
    const { participants } = conference;
    const workerParticipant = participants.find(p => p.workerSid === FlexState.workerSid);
    const isLiveCall = TaskHelper.isLiveCall(task);
    return (
      <React.Fragment>
        <IconButton
          icon={workerParticipant.muted ? 'MuteLargeBold' : 'MuteLarge'}
          disabled={!isLiveCall}
          onClick={this.handleClick}
          themeOverride={theme.CallCanvas.Button}
          title="Mute Call"
        />
      </React.Fragment>
    )
  }
}

export default withTheme(CustomMuteButton);
