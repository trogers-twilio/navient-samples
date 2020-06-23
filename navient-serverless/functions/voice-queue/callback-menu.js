/*
    Synopsis:  This function provide complete handling of Flex In-Queue Callback capabilities to include:
        1. Immediate call-back request to originating ANI ( Press 1), and
        2. Request a callback to separate number
        
    Callback task are created and linked to the originating call (Flex Insights reporting). The flex plugin provides 
    a UI for management of the callback request including a re-queueing capability.capability
    
    name: util_InQueueCallBackMenu
    path: /voice-queue/callback-menu
    private: CHECKED
    
    Function Methods (mode)
     - main             => main entry point for callback flow
     - mainProcess      => process main menu DTMF selection
     - newNumber        => menu initiating new number capture
     - newNumberProcess => process new number DTMF selection
     - submitCallback   => initiate callback creation ( getTask, cancelTask, createCallback)
     
    Customization:
     - Set TTS voice option
     - Set initial priority of callback task (default: 50)
     - Set timezone configuration ( server_tz )

    Install/Config: See documentation

    Last Updated: 03/27/2020
*/

const Twilio = require('twilio');
const moment = require('moment-timezone');

exports.handler = async function(context, event, callback) {
  const {
    ACCOUNT_SID,
    AUTH_TOKEN,
    DOMAIN_NAME,
    WORKSPACE_SID
  } = context;
  const client = Twilio(ACCOUNT_SID, AUTH_TOKEN);
  const workspaceSid = WORKSPACE_SID;

  const twiml = new Twilio.twiml.VoiceResponse();

  const baseUrl = "https://" + DOMAIN_NAME;

  const {
    CallSid,
    Digits,
    cbPhone,
    From,
    mode
  } = event;

  //   CUSTOMIZATIONS
  const sayOptions = { voice: "Polly.Joanna" };
  const priority = 50;
  //    agent audible alert sound file - task attribute value
  const alertTone = `${baseUrl}/alertTone.mp3`;
  const server_tz = "America/Los_Angeles";
  //    END CUSTOMIZATIONS

  const customerPhone = From.substring(From.length - 10);
  console.log("mode: " + mode);
  console.log("Digits:", Digits);

  //  method to split the phone string - prepare phone string for TTS read-ability
  //  format ==> reture '13035551212'
  //  explode ==> return '1...3...0...3...5...5...5...1...2...1...2'
  //
  // function explodePhone(mode, phone) {
  //   if (mode == "format") {
  //     phone = phone.replace("+", "");
  //     return phone;
  //   }
  //   if (mode == "explode") {
  //     let temp = "";
  //     phone = phone.replace("+", "");
  //     var res = phone.split("");
  //     for (i = 0; i < res.length; i++) {
  //       temp += res[i] + "...";
  //     }
  //     return temp;
  //   }
  // }

  //  get current time adjusted to PST timezone
  const getTime = (server_tz) => {
    const now = new Date();
    let time_recvd = moment(now);
    let time_json = {
      time_recvd: time_recvd,
      server_tz: server_tz,
      server_time_long: time_recvd
        .tz(server_tz)
        .format("MMM Do YYYY, h:mm:ss a z"),
      server_time_short: time_recvd
        .tz(server_tz)
        .format("MM-D-YYYY, h:mm:ss a z")
    };
    return time_json;
  };

  //  find the task given the callSid - get TaskSid
  const getTask = async (callSid) => {
    console.log("callsid: " + callSid);
    attrFilter = `call_sid=  '${callSid}'`;

    try {
      let taskList = await client.taskrouter
        .workspaces(workspaceSid)
        .tasks.list({
          evaluateTaskAttributes: attrFilter,
          limit: 20
        });
      console.log("getTask success");

      // let taskInfo = {
      //   originalTaskData: task[0]
      // };
      return taskList[0];
    } catch (error) {
      console.log("getTask error");
    }
  };

  //  cancel the existing task
  //  update ==> assignmentStatus and reason
  const cancelTask = async (taskSid) => {
    console.log(taskSid);
    try {
      await client.taskrouter
        .workspaces(workspaceSid)
        .tasks(taskSid)
        .update({
          assignmentStatus: "canceled",
          reason: "Callback Requested"
        });
      console.log("cancelTask success");
      return;
    } catch (error) {
      console.log("cancelTask error");
      return;
    }
  };

  // create the callback task
  const createCallback = async (phone, originalTask, priority, alertTone) => {
    let time = getTime(server_tz);
    const {
      attributes,
      sid,
      taskQueueFriendlyName,
      taskQueueSid,
      workflowSid
    } = originalTask;

    const originalTaskAttributes = (
      attributes && JSON.parse(attributes))
      || {};
    const taskAttributes = {
      ...originalTaskAttributes,
      taskType: "callback",
      ringback: alertTone,
      to: phone,
      direction: "inbound",
      name: "Callback: " + phone,
      from: originalTaskAttributes.called,
      callTime: time,
      queueTargetName: taskQueueFriendlyName,
      queueTargetSid: taskQueueSid,
      workflowTargetSid: workflowSid,
      ui_plugin: { cbCallButtonAccessibility: false },
      placeCallRetry: 1,
      conversations: {
        ...originalTaskAttributes.conversations,
        conversation_id: sid
      }
    };
    try {
      let cbTask = await client.taskrouter
        .workspaces(workspaceSid)
        .tasks.create({
          attributes: JSON.stringify(taskAttributes),
          type: "callback",
          taskChannel: "callback",
          priority,
          workflowSid
        });
      console.log("createCallBack success");
      return cbTask;
    } catch (error) {
      console.log("createCallBack error");
    }
  };

  const handleModeMain = () => {
    const gather = twiml.gather({
      input: "dtmf",
      numDigits: 1,
      timeout: "5",
      action: `${baseUrl}/voice-queue/callback-menu`
        + `?mode=mainProcess`
        + `&cbPhone=${customerPhone}`
    });
    const gatherSay = gather.say(sayOptions, "You have requested a callback at, ");
    gatherSay.sayAs({ "interpret-as": "telephone" }, customerPhone);
    gatherSay.p("If this is correct, press 1");
    gatherSay.p("Press 2 to be called at a different number");
    
    return callback(null, twiml);
  };

  const handleModeMainProcess = () => {
    switch (Digits) {
      //  existing number
      case "1": {
        // redirect to submitCalBack
        twiml.redirect(`${baseUrl}/voice-queue/callback-menu`
          + `?mode=submitCallback`
          + `&cbPhone=${customerPhone}`
        );
        break;
      }
      //  new number
      case "2": {
        message = "Using your keypad, enter in your phone number...";
        message += "Press the pound sign when you are done...";

        const gather = twiml.gather({
          input: "dtmf",
          numDigits: 10,
          timeout: "5",
          finishOnKey: "#",
          action: `${baseUrl}/voice-queue/callback-menu`
            + `?mode=newNumber`
        });
        gather.say(sayOptions, message);
        break;
      }
      default: {
        twiml.say(sayOptions, "I did not understand your selection.");
        twiml.redirect(`${baseUrl}/voice-queue/callback-menu`
          + `?mode=main`
        );
        break;
      }
    }
    return callback(null, twiml);
  };

  const handleModeNewNumber = () => {
    const gather = twiml.gather({
      input: "dtmf",
      numDigits: 1,
      timeout: "5",
      finishOnKey: "#",
      action: `${baseUrl}/voice-queue/callback-menu`
        + `?mode=newNumberProcess`
        + `&cbPhone=${Digits}`
    });
    const gatherSay = gather.say(sayOptions, "You entered, ");
    gatherSay.sayAs({ 'interpret-as': 'telephone' }, Digits);
    gatherSay.p("Press 1 if this is correct");
    gatherSay.p("Press 2 to re-enter your number");
    gatherSay.p("Press the star key to return to the main menu");
    return callback(null, twiml);
  };

  const handleModeNewNumberProcess = () => {
    //  process digits
    switch (Digits) {
      //  redirect to submitCallback
      case "1": {
        twiml.redirect(`${baseUrl}/voice-queue/callback-menu`
          + `?mode=submitCallback`
          + `&cbPhone=${cbPhone}`
        );
        break;
      }
      //  re-enter number
      case "2": {
        twiml.redirect(`${baseUrl}/voice-queue/callback-menu`
          + `?mode=mainProcess`
          + `&Digits=${Digits}`
        );
        break;
      }
      //  redirect to main menu
      case "*": {
        twiml.redirect(`${baseUrl}/voice-queue/main-menu`
          + `?mode=main`
          + `&skipGreeting=true`
        );
        break;
      }
    };
    return callback(null, twiml);
  };

  const handleModeSubmitCallback = async () => {
      //  get taskSid based on callSid
    //  taskInfo = { "sid" : <taskSid>, "queueTargetName" : <taskQueueName>, "queueTargetSid" : <taskQueueSid> };
    const originalTask = await getTask(CallSid);

    //  cancel (update) the task given taskSid
    await cancelTask(originalTask.sid);

    //  create the callback task
    // TODO: Add some US phone number entry validation
    let cbTask = await createCallback(`+1${cbPhone}`, originalTask, priority, alertTone);

    //  hangup the call
    twiml.say(sayOptions, "Your callback has been delivered...");
    twiml.say(
      sayOptions,
      "An available care specialist will reach out to contact you..."
    );
    twiml.say(sayOptions, "Thank you for your call.");
    twiml.hangup();
    return callback(null, twiml);
  }

  // main logic for callback methods
  switch (mode) {
    //  present main menu options
    case "main": {
      return handleModeMain();
    }
    //  process main menu selections
    case "mainProcess":{
      return handleModeMainProcess();
    }
    //  present new number menu selections
    case "newNumber": {
      return handleModeNewNumber();
    }
    //  process new number submission
    case "newNumberProcess":{
      return handleModeNewNumberProcess();
    }
    //  handler to submit the callback
    case "submitCallback": {
      //  Steps
      //  1. Fetch TaskSid ( read task w/ attribute of call_sid);
      //  2. Update existing task (assignmentStatus==>'canceled'; reason==>'callback requested' )
      //  3. Create new task ( callback );
      //  4. Hangup callback
      //
      //  main callback logic
      return await handleModeSubmitCallback();
    }
  }
};
