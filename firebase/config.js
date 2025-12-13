// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyBfo1mieIIR02UNDiFDVFDF857LMU57J_o',
  authDomain: 'bmgadmin-85fa6.firebaseapp.com',
  projectId: 'bmgadmin-85fa6',
  storageBucket: 'bmgadmin-85fa6.firebasestorage.app',
  messagingSenderId: '391789967992',
  appId: '1:391789967992:web:dbc3fc2ab59b29f9b48b8d',
  measurementId: 'G-GYG93R9JJ4',
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const analytics = getAnalytics(app)

// Initialize services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
