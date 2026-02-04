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
      meta: { title: 'Home' },
    },
    {
      path: '/leaderboard',
      name: 'leaderboard',
      component: () => import('../views/LiveLeaderboardView.vue'),
      meta: { requiresUser: true, title: 'Leaderboard' },
    },
    {
      path: '/game',
      name: 'game',
      component: () => import('../views/GameView.vue'),
      meta: { requiresUser: true, title: 'Game' },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminView.vue'),
      meta: { requiresAuth: true, title: 'Admin Dashboard' },
    },

    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

const getCurrentUser = () => {
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe()
      resolve(user)
    })
  })
}

router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
  if (requiresAuth) {
    const user = await getCurrentUser()
    if (user) {
      next()
    } else {
      next('/')
    }
    return
  }

  const requiresUser = to.matched.some((record) => record.meta.requiresUser)
  if (requiresUser) {
    const session = localStorage.getItem('bmg_user')
    if (session) {
      next()
    } else {
      next('/')
    }
    return
  }

  next()
})

// Update document title after each route change
router.afterEach((to) => {
  document.title = to.meta.title || 'Default Title'
})

export default router
