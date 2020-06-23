/*
    Synopsis:  This function provides complete handling of Flex In-Queue Voicemail capabilities to include:
        1. request to leave a voicemail with callback to originating ANI
        
    Voicemail tasks are created and linked to the originating call (Flex Insights reporting). The flex plugin provides 
    a UI for management of the voicemail request including a re-queueing capability.
    
    name: main-menu
    path: /voice-queue/main-menu
    private: CHECKED
    
    Function Methods (mode)
     - main                 => present menu for in-queue main menu options
     - mainProcess          => present menu for main menu options (1=>Stay Queue; 2=>Callback; 3=>Voicemail)
     - menuProcess          => process DTMF for redirect to supporting functions (Callback, voicemail)

    Customization:
     - Set TTS voice option
     - Set hold music path to ASSET resource (trimmed 30 seconds source)

    Install/Config: See documentation

    Last Updated: 03/27/2020
*/
// const axios = require('axios');
const moment = require('moment');
const Twilio = require('twilio');

exports.handler = async function(context, event, callback) {
  const client = context.getTwilioClient();
  const domain = 'https://' + context.DOMAIN_NAME;
  let twiml = new Twilio.twiml.VoiceResponse();

  const {
    CallSid,
    language,
    mode,
    voice
  } = event;

  //    CUSTOMIZATIONS
  const sayOptions = {
    voice: voice || 'Polly.Joanna',
    language: language || 'en-US'
  };
  const holdMusicUrl = '/guitar_music.mp3';

  // Retrieving voice prompts
  const voicePromptsHelper = require(Runtime.getFunctions()['helper/voice-prompts'].path);

  const collectionName = 'voice-queue_main-menu';
  const prompts = voicePromptsHelper(collectionName, language);
  
  if (!prompts || prompts.success === false) {
    console.log('Error retrieving prompts.', prompts);
    console.log('Returning hold music');
    twiml.play(`${domain}${holdMusicUrl}`);
    return callback(null, twiml);
  }

  const statPeriod = 5; //  time interval (minutes) to gather cumulative statistics

  const getEwt = true;
  const getQueuePosition = true;
  const maxQueuePosition = 20;

  //    END CUSTOMIZATIONS

  //  variable initialization
  let message = '';

  // vars for EWT/PostionInQueue
  let temp = {};
  let res = {};

  let callSid = '';
  let task = {};
  let workflowSid = '';
  let waitTts = '';
  let waitMsg = '';
  let posQueueMsg = '';

  let avgWaitTime = 0;
  let maxWaitTime = 0;
  let minWaitTime = 0;

  let waitTime = [];
  let taskList = [];
  let attr = {};

  // BEGIN: Supporting functions for Estimated Wait Time and Position in Queue



  // retrieve task object based on Call SID
  async function getTaskByCallSid(callSid) {
    try {
      const matchingTasks = await client.taskrouter
        .workspaces(context.WORKSPACE_SID)
        .tasks.list({
          evaluateTaskAttributes: `call_sid == '${callSid}'`,
          limit: 20
        });
      if (!Array.isArray(matchingTasks) || matchingTasks.length === 0) {
        console.warn('Found no matching tasks for call SID', callSid);
        return undefined;
      } else if (matchingTasks.length > 1) {
        console.warn(`Found ${matchingTasks.length} tasks matching call SID ${callSid}`);
        console.warn('Unable to proceed with more than one matching task');
        return undefined
      }
      console.log(`Found task ${matchingTasks[0].sid} matching call SID ${callSid}`);
      return matchingTasks[0];
    } catch (error) {
      console.log('Error in getTaskByCallSid.', error);
      return undefined
    }
  }

  //  retrieve workflow cumulative statistics for Estimated wait time
  async function getWorkflowStats(workflowSid) {
    return client.taskrouter
      .workspaces(context.WORKSPACE_SID)
      .workflows(workflowSid)
      .cumulativeStatistics({
        Minutes: statPeriod
      })
      .fetch()
      .then(workflow_statistics => {
        res = {
          status: 'success',
          topic: 'getWorkflowStats',
          action: 'getWorkflowStats',
          data: workflow_statistics
        };
        return res;
      })
      .catch(error => {
        res = {
          status: 'error',
          topic: 'getWorkflowStats',
          action: 'getWorkflowStats',
          data: error
        };
      });
  }

  async function getTaskListForQueue(callSid, taskQueueName) {
    return await client.taskrouter
      .workspaces(context.WORKSPACE_SID)
      .tasks.list({
        assignmentStatus: 'pending, reserved',
        taskQueueName: taskQueueName,
        ordering: 'DateCreated:asc,Priority:desc',
        limit: maxQueuePosition
      })
      .then(async tasks => {
        let totTasks = tasks.length;
        for (i = 0; i < tasks.length; i++) {
          attr = JSON.parse(tasks[i].attributes);
          temp = {
            taskSid: tasks[i].sid,
            callSid: attr.call_sid,
            priority: tasks[i].priority,
            age: tasks[i].age,
            taskQueueSid: tasks[i].taskQueueSid,
            taskQueueName: tasks[i].taskQueueFriendlyName,
            taskChannelName: tasks[i].taskChannelUniqueName,
            dateCreated: tasks[i].dateCreated,
            dateEnteredQueue: tasks[i].taskQueueEnteredDate
          };
          taskList.push(temp);
        }

        // find position in Queue
        var position = 0;
        position = taskList.findIndex(function(task) {
          return task.callSid == callSid;
        });

        // task not in task list ==> position > 20
        if (position == -1) {
          res = {
            status: 'success',
            topic: 'getTaskList',
            action: 'getTaskList',
            position: -1,
            totTasks: totTasks,
            numAhead: -1,
            data: taskList
          };
        } else {
          //  task found in list
          position = position + 1;
          let numAhead = position - 1;
          res = {
            status: 'success',
            topic: 'getTaskList',
            action: 'getTaskList',
            position: position,
            totTasks: totTasks,
            numAhead: numAhead,
            data: taskList
          };
        }
        return res;
      })
      .catch(error => {
        res = {
          status: 'error',
          topic: 'getTaskList',
          action: 'getTaskList',
          data: error
        };
        return res;
      });
  }

  //  moment function to derive hours, minutes and seconds from cummulative time in seconds
  function waitTimeCalc(type, seconds, waitTime) {
    var duration = moment.duration(seconds, 'seconds');
    res = {
      type: type,
      hours: duration._data.hours,
      minutes: duration._data.minutes,
      seconds: duration._data.seconds
    };
    waitTime.push(res);
    return waitTime;
  }

  function getWaitTimeResults(t, waitTime) {
    //  get formatted wait times
    waitTimeCalc('maxWaitTime', t.max, waitTime);
    waitTimeCalc('avgWaitTime', t.avg, waitTime);
    waitTimeCalc('minWaitTime', t.min, waitTime);

    // get average wait time
    temp = waitTime.filter(item => item.type == 'avgWaitTime');

    return temp;
  }

  // Helper function to always add language and voice to TwiML URLs
  function prepareTwimlUrl(url, language, voice) {
    return `${url}&language=${language}&voice=${voice}`;
  }

  //  END: Supporting functions

  //  ==========================
  //  BEGIN:  Main logic
  console.log('mode: ' + event.mode);
  switch (mode) {
    case 'main': {
      async function main() {
        console.log('in main');
        //  logic for retrieval of Estimated Wait Time
        if (getEwt) {
          task = await getTaskByCallSid(CallSid);
          temp = await getWorkflowStats(task.workflowSid);
          //  get max, avg, min wait times for the workflow
          let t = temp.data.waitDurationUntilAccepted;
          let result = getWaitTimeResults(t, waitTime);
          //  develop TTS response based on computed wait times

          let ewt = result[0].minutes;
          console.log('EWT: ' + ewt);

          if (ewt == 0) {
            waitTts = prompts.waitMsgOne;
          }
          if (ewt == 1) {
            waitTts = prompts.waitMsgTwo;
          }
          if (ewt == 2) {
            waitTts = prompts.waitMsgThree;
          }
          if (ewt == 3) {
            waitTts = prompts.waitMsgFour;
          }
          if (ewt >= 4) {
            waitTts = prompts.waitMsgFive;
          }

          waitMsg += `${prompts.waitMsg} ${waitTts}`;
        }

        //  Logic for Position in Queue
        if (getQueuePosition) {
          if (!task) {
            task = await getTaskByCallSid(CallSid);
          }
          temp = await getTaskListForQueue(CallSid, task.taskQueueFriendlyName);

          // formatting for the position in queue
          numAhead = temp.numAhead;

          switch (temp.numAhead) {
            case 0: {
              posQueueMsg = prompts.positionQueueNext;
              break;
            }
            case 1: {
              posQueueMsg = `${prompts.positionQueuePrefixOne} ${temp.numAhead} ${prompts.positionQueueSuffixOne}`
              break;
            }
            case -1: {
              posQueueMsg = `${prompts.positionQueuePrefixMax} ${maxQueuePosition} ${prompts.positionQueueSuffixMany}`;
              break;
            }
            default: {
              posQueueMsg = `${prompts.positionQueuePrefixMany} ${temp.numAhead} ${prompts.positionQueueSuffixMany}`;
              break;
            }
          }
        }

        if (event.skipGreeting !== 'true') {
          let initGreeting = `${waitMsg}. ${posQueueMsg}.`;
          initGreeting += ` ${prompts.initialGreeting}.`;
          twiml.say(sayOptions, initGreeting);
        }
        message = `${prompts.pressOneForMenu}.`;
        const gather = twiml.gather({
          input: 'dtmf',
          numDigits: 1,
          timeout: '2',
          action: prepareTwimlUrl(domain + '/voice-queue/main-menu?mode=mainProcess', language, voice)
        });
        gather.say(sayOptions, message);
        gather.play(domain + '/guitar_music.mp3');
        callback(null, twiml);
      }
      main();
      break;
    }
    case 'mainProcess': {
      console.log('digits: ' + event.Digits);
      if (event.Digits === '1') {
        message = prompts.mainMenu;

        const gather = twiml.gather({
          input: 'dtmf',
          numDigits: 1,
          timeout: '2',
          action: prepareTwimlUrl(domain + '/voice-queue/main-menu?mode=menuProcess', language, voice)
        });
        gather.say(sayOptions, message);
        gather.play(domain + '/guitar_music.mp3');

        callback(null, twiml);
      } else {
        twiml.say(sayOptions, prompts.invalidEntry);
        twiml.redirect(prepareTwimlUrl(domain + '/voice-queue/main-menu?mode=main&skipGreeting=true', language, voice));
        callback(null, twiml);
      }

      break;
    }
    case 'menuProcess': {
      switch (event.Digits) {
        //  stay in queue
        case '1': {
          twiml.redirect(prepareTwimlUrl(domain + '/voice-queue/main-menu?mode=main&skipGreeting=true', language, voice));
          callback(null, twiml);
          break;
        }
        //  request a callback
        case '2': {
          twiml.redirect(prepareTwimlUrl(domain + '/voice-queue/callback-menu?mode=main', language, voice));
          callback(null, twiml);
          break;
        }
        //  leave a voicemail
        case '3': {
          twiml.redirect(prepareTwimlUrl(domain + '/voice-queue/voicemail-menu?mode=pre-process', language, voice));
          callback(null, twiml);
          break;
        }
        // listen options menu again
        case '*': {
          twiml.redirect(prepareTwimlUrl(domain + '/voice-queue/main-menu?mode=mainProcess&Digits=1', language, voice));
          callback(null, twiml);
          break;
        }
        //  listen to menu again
        default: {
          twiml.say(sayOptions, prompts.invalidEntry);
          twiml.redirect(prepareTwimlUrl(domain + '/voice-queue/main-menu?mode=mainProcess&Digits=1', language, voice));
          callback(null, twiml);
          break;
        }
      }
      break;
    }
    default: {
      console.log('Unhandled mode value:', mode);
      console.log('Returning hold music');
      twiml.play(`${domain}${holdMusicUrl}`);
      callback(null, twiml);
    }
  }
};
