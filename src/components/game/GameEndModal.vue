<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: Boolean,
  userRank: {
    type: Number,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue', 'exit'])

const isFirst = computed(() => props.userRank === 1)
const isSecond = computed(() => props.userRank === 2)
const isTopThree = computed(() => props.userRank && props.userRank <= 3 && props.userRank !== 1)
</script>

<template>
  <Transition name="fade">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4"
    >
      <div class="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
        <div class="mb-6">
          <div
            v-if="isFirst"
            class="w-24 h-24 mx-auto bg-yellow-100 rounded-full flex items-center justify-center text-6xl"
          >
            🏆
          </div>
          <div
            v-else-if="isSecond"
            class="w-24 h-24 mx-auto bg-gray-200 rounded-full flex items-center justify-center text-6xl"
          >
            🥈
          </div>
          <div
            v-else-if="isTopThree"
            class="w-24 h-24 mx-auto bg-orange-100 rounded-full flex items-center justify-center text-6xl"
          >
            🎉
          </div>
          <div
            v-else
            class="w-24 h-24 mx-auto bg-purple-100 rounded-full flex items-center justify-center text-6xl"
          >
            👏
          </div>
        </div>

        <!-- Title -->
        <div class="flex items-center justify-evenly flex-col sm:flex-row mb-6">
          <h2 v-if="isFirst" class="text-2xl font-bold mb-1 text-yellow-400">Congratulations!!!</h2>
          <h2 v-else-if="isSecond" class="text-2xl font-bold text-gray-400 mb-1">
            Wow.. So Close!
          </h2>
          <h2 v-else-if="isTopThree" class="text-2xl font-bold text-orange-400 mb-1">
            Better Luck Next Time!
          </h2>
          <h2 v-else class="text-2xl font-bold mb-1">Thank You for Playing!</h2>

          <!-- Emojis -->
          <div v-if="isFirst" class="text-2xl mb-4">🎉🏅🙌</div>
          <div v-else-if="isSecond" class="text-2xl mb-4">😭😭😭</div>
          <div v-else-if="isTopThree" class="text-2xl mb-4">🤞</div>
        </div>

        <!-- Rank Box -->
        <div class="bg-purple-50 rounded-2xl p-6 my-6">
          <p class="text-slate mb-2">You finished:</p>
          <p
            class="text-5xl font-bold"
            :class="{
              'text-yellow-400': isFirst,
              'text-gray-400': isSecond,
              'text-orange-400': isTopThree && !isSecond,
              'text-purple-400': !isFirst && !isSecond && !isTopThree,
            }"
          >
            Rank #{{ props.userRank }}
          </p>
        </div>

        <p class="text-slate text-sm mb-8">
          The official leaderboard will be announced on our Instagram page tonight.
        </p>

        <button
          @click="emit('logout')"
          class="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-2xl transition cursor-pointer"
        >
          Exit Game
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
