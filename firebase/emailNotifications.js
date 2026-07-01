import emailjs from '@emailjs/browser'
import { db } from './config'
import { doc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore'

const SERVICE_ID = 'service_sg3lgri'
const TEMPLATE_ID = 'template_ehf0a2v'
const PUBLIC_KEY = 'KB5T-dnEM_66_dd-T'

export const saveEmailSubscriber = async (email) => {
  try {
    await setDoc(doc(db, 'email_subscribers', email), {
      email,
      subscribedAt: serverTimestamp(),
    })
    return { success: true }
  } catch (error) {
    console.error('Save email error:', error)
    return { success: false, reason: error.message }
  }
}

export const sendGameStartEmails = async () => {
  try {
    const subscribersSnap = await getDocs(collection(db, 'email_subscribers'))

    if (subscribersSnap.empty) {
      return { success: false, reason: 'no_subscribers' }
    }

    const subscribers = subscribersSnap.docs.map((d) => d.data())

    emailjs.init(PUBLIC_KEY)

    let successCount = 0
    let failCount = 0

    for (const subscriber of subscribers) {
      try {
        await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
          to_email: subscriber.email,
          to_name: subscriber.email,
        })
        successCount++
      } catch (error) {
        console.error(`Failed to send to ${subscriber.email}:`, error)
        failCount++
      }
    }

    return { success: true, count: successCount, failed: failCount }
  } catch (error) {
    console.error('Send emails error:', error)
    return { success: false, reason: error.message }
  }
}
