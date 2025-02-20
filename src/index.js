const { register, listen } = require('push-receiver');
const Config = require('electron-config');

const config = new Config();

module.exports = {
  setNotificationServiceStartedCallback,
  setNotificationServiceErrorCallback,
  setNotificationReceivedCallback,
  setTokenUpdatedCallback,
  startNotificationService,
};

// To be sure that start is called only once
let started = false;
let notificationServiceStartedCallback;
let notificationServiceErrorCallback;
let notificationReceivedCallback;
let tokenUpdatedCallback;

function setNotificationServiceStartedCallback(callback) {
  notificationServiceStartedCallback = callback;
}

function setNotificationServiceErrorCallback(callback) {
  notificationServiceErrorCallback = callback;
}

function setNotificationReceivedCallback(callback) {
  notificationReceivedCallback = callback;
}

function setTokenUpdatedCallback(callback) {
  tokenUpdatedCallback = callback;
}

async function startNotificationService(senderId) {
  // Retrieve saved credentials
  let credentials = config.get('credentials');
  // Retrieve saved senderId
  const savedSenderId = config.get('senderId');
  if (started) {
    if (notificationServiceStartedCallback) {
      notificationServiceStartedCallback((credentials.fcm || {}).token);
    }
    return;
  }
  started = true;
  try {
    // Retrieve saved persistentId : avoid receiving all already received notifications on start
    const persistentIds = config.get('persistentIds') || [];
    // Register if no credentials or if senderId has changed
    if (!credentials || savedSenderId !== senderId) {
      credentials = await register(senderId);
      // Save credentials for later use
      config.set('credentials', credentials);
      // Save senderId
      config.set('senderId', senderId);
      // Notify the renderer process that the FCM token has changed
      if (tokenUpdatedCallback) {
        tokenUpdatedCallback(credentials.fcm.token);
      }
    }
    // Listen for GCM/FCM notifications
    await listen(Object.assign({}, credentials, { persistentIds }), onNotification(notificationReceivedCallback));
    // Notify the renderer process that we are listening for notifications
    if (notificationServiceStartedCallback) {
      notificationServiceStartedCallback(credentials.fcm.token);
    }
  } catch (e) {
    console.error('PUSH_RECEIVER:::Error while starting the service', e);
    // Forward error to the renderer process
    if (notificationServiceErrorCallback) {
      notificationServiceErrorCallback(e.message);
    }
  }
};

// Will be called on new notification
function onNotification(notificationReceivedCallback) {
  return ({ notification, persistentId }) => {
    const persistentIds = config.get('persistentIds') || [];
    // Update persistentId
    config.set('persistentIds', [...persistentIds, persistentId]);
    // Notify the renderer process that a new notification has been received
    if (notificationReceivedCallback) {
      notificationReceivedCallback(notification);
    }
  };
}
