import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import api from "./api"; 

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

let messaging = null;

isSupported().then((supported) => {
  if (supported) {
    messaging = getMessaging(app);
  } else {
    console.warn("Firebase Messaging tidak aktif (Mungkin karena dibuka di HTTP/IP biasa). Aplikasi tetap berjalan tanpa notifikasi.");
  }
}).catch((err) => {
  console.error("Firebase Support Error:", err);
});

export const requestForToken = async () => {
  if (!messaging) return; 

  try {
    const currentToken = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
    });
    if (currentToken) {
      try {
        await api.put('/auth/fcm-token', { fcm_token: currentToken });
        console.log("Token sent to backend");
      } catch (err) {
        console.log('Backend belum siap/error update token');
      }
    } else {
      console.log('Tidak ada registration token.');
    }
  } catch (err) {
    console.log('Error saat mengambil token:', err);
  }
};

export const onMessageListener = (callback) => {
  if (!messaging) return;
  
  return onMessage(messaging, (payload) => {
    console.log("📩 Pesan masuk (Foreground):", payload);
    callback(payload);
  });
};

export default app;