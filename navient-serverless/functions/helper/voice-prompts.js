const prompts = {
  'voice-queue_main-menu': {
    'en-US': {
      waitMsg: 'The estimated wait time is',
      waitMsgOne: 'less than a minute',
      waitMsgTwo: 'less than two minutes',
      waitMsgThree: 'less than three minutes',
      waitMsgFour: 'less than four minutes',
      waitMsgFive: 'longer than four minutes',
      positionQueueNext: 'Your call is next in queue',
      positionQueuePrefixOne: 'There is',
      positionQueuePrefixMany: 'There are',
      positionQueuePrefixMax: 'There are more than',
      positionQueueSuffixOne: 'caller ahead of you',
      positionQueueSuffixMany: 'callers ahead of you',
      initialGreeting: 'Please wait while we direct your call to the next available specialist',
      pressOneForMenu: 'To listen to a menu of options while on hold, press 1 at anytime',
      mainMenu: 'The following options are available. '
        + 'Press 1 to remain on hold. '
        + 'Press 2 to request a callback. '
        + 'Press 3 to leave a voicemail message for the care team. '
        + 'Press the star key to listen to these options again.',
      invalidEntry: 'I did not understand your selection.'
    },  
    'es-US': {
      waitMsg: 'El tiempo de espera estimado es',
      waitMsgOne: 'inferior a un minuto',
      waitMsgTwo: 'inferior a dos minutos',
      waitMsgThree: 'inferior a tres minutos',
      waitMsgFour: 'inferior a cuatro minutos',
      waitMsgFive: 'superior a cuatro minutos',
      positionQueueNext: 'Tu llamada es la siguiente en la cola',
      positionQueuePrefixOne: 'Hay',
      positionQueuePrefixMany: 'Hay',
      positionQueuePrefixMax: 'Hay mas que',
      positionQueueSuffixOne: 'persona que llama por delante',
      positionQueueSuffixMany: 'personas que llaman por delante',
      initialGreeting: 'Espere mientras dirigimos su llamada al siguiente especialista disponible',
      pressOneForMenu: 'Para escuchar un menú de opciones mientras está en espera, presione 1 en cualquier momento',
      mainMenu: 'Las siguientes opciones están disponibles. '
        + 'Presione 1 para permanecer en espera. '
        + 'Presione 2 para solicitar una devolución de llamada. '
        + 'Presione 3 para dejar un mensaje de correo de voz para el equipo de atención. '
        + 'Presione la tecla asterisco para escuchar estas opciones nuevamente.',
      invalidEntry: 'No entendi tu seleccion.'
    }
  },
  'voice-queue_callback-menu': {
    'en-US': {

    },
    'es-US': {
      
    }
  }
}

module.exports = function(collectionName, language) {
  const promptCollection = prompts[collectionName];
  const languagePrompts = promptCollection && promptCollection[language];

  if (languagePrompts) {
    return languagePrompts;
  } else {
    const errorMessage = `No prompts found for collection ${collectionName} and language ${language}`;
    console.log(errorMessage);
    return { success: false, message: errorMessage };
  }
};
