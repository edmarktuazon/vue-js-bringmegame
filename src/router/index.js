// src/router/index.js (or wherever your router file is)

import { createRouter, createWebHistory } from 'vue-router'
import HomeFormView from '../views/HomeFormView.vue'
import { auth } from '/firebase/config' // Adjust path if needed

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeFormView,
      // Walang meta requiresUser – public ito para makapag-create ng session
    },
    {
      path: '/game',
      name: 'game',
      component: () => import('../views/GameView.vue'),
      meta: { requiresUser: true }, // Protektado – kailangan ng player session
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminView.vue'),
      meta: { requiresAuth: true }, // Protektado – kailangan ng Firebase auth
    },
    // Optional: catch-all redirect para sa invalid routes
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

// Helper para kunin ang current Firebase user
const getCurrentUser = () => {
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe()
      resolve(user)
    })
  })
}

router.beforeEach(async (to, from, next) => {
  console.log('Navigating to:', to.path)
  console.log('From:', from.path)

  // 1. Check kung admin route (Firebase Auth)
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
  if (requiresAuth) {
    const user = await getCurrentUser()
    if (user) {
      next() // May Firebase user → pasok sa admin
    } else {
      next('/') // Walang Firebase user → balik sa home
    }
    return
  }

  // 2. Check kung player route (localStorage session)
  const requiresUser = to.matched.some((record) => record.meta.requiresUser)
  if (requiresUser) {
    const session = localStorage.getItem('bmg_user')
    if (session) {
      next() // May session → pasok sa game
    } else {
      next('/') // Walang session → balik sa home para mag-fill up
    }
    return
  }

  // 3. Lahat ng iba (public routes tulad ng home)
  next()
})

export default router
