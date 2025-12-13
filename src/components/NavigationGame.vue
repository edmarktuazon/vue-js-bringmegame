<script setup>
import { ref } from 'vue'
import { router } from 'vue-router'
const user = ref(null)
const handleLogout = () => {
  localStorage.removeItem('bmg_user')
  router.push('/')
}
</script>

<template>
  <header class="bg-white shadow-xl px-4 py-6 sticky top-0 z-10">
    <div class="flex justify-between items-center w-full max-w-4xl mx-auto">
      <div>
        <span class="text-xl font-bold"> Bring<span class="text-primary">Me</span> </span>
        <p class="text-xs text-slate mt-1">{{ user?.instagramHandle }}</p>
      </div>
      <button @click="handleLogout" class="text-sm text-slate hover:text-dark transition">
        Exit Game
      </button>
    </div>
  </header>
</template>
