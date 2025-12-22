import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: 'AIzaSyBQNhD8PQcxJom8isoxZouZ4Di8L5FvHSU',
  authDomain: 'instarace.firebaseapp.com',
  projectId: 'instarace',
  storageBucket: 'instarace.firebasestorage.app',
  messagingSenderId: '675008722127',
  appId: '1:675008722127:web:a908b71e9c8de1412a73ba',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
