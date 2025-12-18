<script setup>
import BMGLogo from '/BMG-Logo.png'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '/firebase/config'
import { signInWithEmailAndPassword } from 'firebase/auth'

const showModal = ref(false)
const username = ref('')
const password = ref('')
const errorMessage = ref('')
const loading = ref(false)

const router = useRouter()

const openModal = (e) => {
  e.preventDefault()
  showModal.value = true
  errorMessage.value = ''
}

const closeModal = () => {
  showModal.value = false
  username.value = ''
  password.value = ''
  errorMessage.value = ''
}

const handleSubmit = async (e) => {
  e.preventDefault()
  if (!username.value || !password.value) return

  loading.value = true
  errorMessage.value = ''

  try {
    const email = `${username.value}@bmg.com`

    const userCredential = await signInWithEmailAndPassword(auth, email, password.value)

    console.log('Login successful:', userCredential.user.email)

    closeModal()

    await new Promise((resolve) => setTimeout(resolve, 100))

    await router.push('/admin')
  } catch (error) {
    console.error('❌ Login error:', error.code, error.message)
    switch (error.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        errorMessage.value = 'Invalid username or password.'
        break
      case 'auth/too-many-requests':
        errorMessage.value = 'Too many attempts. Try again later.'
        break
      default:
        errorMessage.value = 'Login failed. Please try again.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <header class="bg-white shadow-xl font-montserrat px-4 py-4 fixed w-full top-0 left-0 z-10">
      <div class="flex justify-between items-center w-full max-w-6xl mx-auto">
        <div></div>
        <nav>
          <button @click="openModal" class="flex items-center gap-1 text-dark-gray cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </button>
        </nav>
      </div>
    </header>

    <!-- Modal -->
    <Transition name="fade">
      <div
        v-if="showModal"
        class="fixed inset-0 bg-black/85 flex items-center justify-center z-50 px-4"
        @click="closeModal"
      >
        <div class="relative w-full max-w-sm text-center font-montserrat" @click.stop>
          <div class="rounded-lg bg-white shadow-xl w-full">
            <!--Close modal -->
            <button
              @click="closeModal"
              class="absolute top-4 right-4 text-slate hover:text-dark-gray cursor-pointer"
              aria-label="Close modal"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <!-- User form login-->
            <div class="flex items-center flex-col px-6 pt-6">
              <img :src="BMGLogo" class="w-48 h-24.25 mb-10" alt="Bring Me Game Logo" />
              <p class="text-sm text-dark-gray">
                <strong>Note:</strong> Admin access only. If you're Admin, please enter the correct
                given username and password.
              </p>
            </div>
            <form @submit="handleSubmit" class="flex items-center flex-col p-6 space-y-4">
              <input
                v-model="username"
                type="text"
                placeholder="Username"
                class="bg-soft w-full font-montserrat text-sm p-3 rounded-md outline-primary"
                required
                autocomplete="username"
                :disabled="loading"
              />
              <input
                v-model="password"
                type="password"
                placeholder="Password"
                class="bg-soft w-full font-montserrat text-sm p-3 rounded-md outline-primary"
                required
                autocomplete="current-password"
                :disabled="loading"
              />

              <!--Error message from form -->
              <p v-if="errorMessage" class="text-red-600 text-sm">{{ errorMessage }}</p>

              <button
                type="submit"
                :disabled="loading"
                class="w-full bg-primary text-white font-semibold py-3 rounded-md transition-colors cursor-pointer hover:bg-primary/90 focus:outline focus:outline-2 focus:outline-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ loading ? 'Logging in...' : 'Login' }}
              </button>
            </form>

            <div class="px-6 pb-6">
              <p class="text-xs text-slate">
                Only authorized administrators can access the dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
