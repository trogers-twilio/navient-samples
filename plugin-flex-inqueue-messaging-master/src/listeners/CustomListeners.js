import * as Flex from '@twilio/flex-ui';

Flex.Actions.addListener('afterAcceptTask', async payload => {
  const { task } = payload;
  const { attributes } = task;
  const direction = attributes.direction || '';
  const taskType = attributes.taskType || '';

  const returnCallTaskTypes = [
    'callback',
    'voicemail'
  ];
  const outcome = {
    callback: 'Callback Return Call Placed',
    voicemail: 'Voicemail Return Call Placed'
  };

  if (direction.toLowerCase() === 'outbound'
    && returnCallTaskTypes.includes(taskType.toLowerCase())
  ) {
    const { tempReservationSid } = attributes;
    const tempTask = Flex.TaskHelper.getTaskByTaskSid(tempReservationSid);
    const { attributes: tempTaskAttributes } = tempTask;
    const newAttributes = {
      ...tempTaskAttributes,
      conversations: {
        ...tempTaskAttributes.conversations,
        outcome: outcome[taskType.toLowerCase()]
      }
    };
    // IMPORTANT: Be sure to await task attribute update before completing a task
    await tempTask.setAttributes(newAttributes);
    tempTask.complete();
  }
})
