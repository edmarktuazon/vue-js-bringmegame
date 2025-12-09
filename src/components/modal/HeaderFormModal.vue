<script setup>
import BMGLogo from '/BMG-Logo.png'

import { ref } from 'vue'

const showModal = ref(false)
const username = ref('')
const password = ref('')

const openModal = (e) => {
  e.preventDefault()
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  username.value = ''
  password.value = ''
}

const handleSubmit = (e) => {
  e.preventDefault()
  console.log('Login attempt:', { username: username.value, password: password.value })
  // Add your login logic here
  closeModal()
}
</script>

<template>
  <div>
    <header class="bg-white shadow-xl font-montserrat px-4 py-6 fixed w-full top-0 left-0 z-10">
      <div class="flex justify-between items-center w-full max-w-6xl mx-auto">
        <span class="text-xl">
          <strong>Bring<span class="text-primary">Me</span></strong>
        </span>
        <nav>
          <a href="#" @click="openModal" class="underline">Admin access</a>
        </nav>
      </div>
    </header>

    <!-- Modal Overlay -->
    <Transition name="fade">
      <div
        v-if="showModal"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
        @click="closeModal"
      >
        <!-- Modal Content -->
        <div class="relative w-full max-w-sm text-center font-montserrat" @click.stop>
          <div class="rounded-lg bg-white shadow-xl w-full">
            <!-- Close Button -->
            <button
              @click="closeModal"
              class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
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

            <!-- Logo and Text -->
            <div class="flex items-center flex-col px-6 pt-6 pb-4 space-y-6">
              <img :src="BMGLogo" class="w-48 h-24.25" alt="Bring Me Game Logo" />
              <p class="text-sm">
                Note: Admin access only. Please enter your username and password.
              </p>
            </div>

            <!-- Form -->
            <form @submit="handleSubmit" class="flex items-center flex-col p-6 space-y-4">
              <input
                v-model="username"
                type="text"
                name="username"
                class="bg-gray-100 w-full font-montserrat text-sm p-3 rounded-md outline-primary focus:outline focus:outline-2"
                placeholder="Username"
                required
              />
              <input
                v-model="password"
                type="password"
                name="password"
                class="bg-gray-100 w-full font-montserrat text-sm p-3 rounded-md outline-primary focus:outline focus:outline-2"
                placeholder="Password"
                required
              />
              <button
                type="submit"
                class="w-full bg-primary text-white font-semibold py-3 rounded-md transition-colors cursor-pointer hover:bg-primary/90 focus:outline focus:outline-2 focus:outline-primary"
              >
                Login
              </button>
            </form>

            <div class="px-6 pb-6">
              <p class="text-xs text-gray-600">
                Only authorized administrators can access the admin dashboard. Contact support if
                you're having trouble logging in.
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
