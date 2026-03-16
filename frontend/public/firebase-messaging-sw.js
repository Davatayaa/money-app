importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');


firebase.initializeApp({
  apiKey: "AIzaSyCrneiy9ZiJMFgOOgdLb-wg_JJ_T9PqD1I",
  authDomain: "money-app-d5330.firebaseapp.com",
  projectId: "money-app-d5330",
  storageBucket: "money-app-d5330.firebasestorage.app",
  messagingSenderId: "407219924814",
  appId: "1:407219924814:web:7ca060cba35a088226781f"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
});

self.addEventListener('notificationclick', function(event) {
  const notification = event.notification;
  
  notification.close();

  let urlToOpen = '/';
  
  if (notification.data && notification.data.url) {
    urlToOpen = notification.data.url; 
  } else if (notification.data && notification.data.fcmOptions && notification.data.fcmOptions.link) {
    urlToOpen = notification.data.fcmOptions.link; 
  }

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          if (urlToOpen && client.url !== urlToOpen) {
              client.navigate(urlToOpen);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});