// router/index.js – FINAL WORKING VERSION
import { createRouter, createWebHistory } from 'vue-router'
import HomeFormView from '../views/HomeFormView.vue'
import { auth } from '/firebase/config'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeFormView,
    },
    {
      path: '/game',
      name: 'game',
      component: () => import('../views/GameView.vue'),
      meta: { requiresUser: true },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

// Helper para sa Firebase Auth
const getCurrentUser = () => {
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe()
      resolve(user)
    })
  })
}

// ROUTE GUARD – FIXED VERSION
router.beforeEach(async (to, from, next) => {
  console.log('Navigating to:', to.path)
  console.log('From:', from.path)

  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
  const requiresUser = to.matched.some((record) => record.meta.requiresUser)

  console.log('Requires Auth:', requiresAuth)
  console.log('Requires User:', requiresUser)

  // ADMIN AUTH (Firebase Auth)
  if (requiresAuth) {
    const user = await getCurrentUser()
    if (user) {
      next()
    } else {
      next('/')
    }
    return
  }

  // PLAYER SESSION (localStorage)
  if (requiresUser) {
    // IMPORTANT: Use synchronous check – localStorage is sync!
    const session = localStorage.getItem('bmg_user')

    if (session) {
      console.log('Player session found:', session)
      next()
    } else {
      console.log('No player session – redirecting to home')
      next('/')
    }
    return
  }

  // Public route
  next()
})

export default router
