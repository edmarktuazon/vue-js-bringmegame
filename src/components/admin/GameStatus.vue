<script setup>
import { computed, ref, watch } from 'vue'
import { updateGameStatus } from '/firebase/gameHelpers'

const props = defineProps({
  currentGame: {
    type: Object,
    default: null,
  },
})

const localStatus = ref('waiting')

watch(
  () => props.currentGame?.status,
  (newStatus) => {
    localStatus.value = newStatus || 'waiting'
  },
  { immediate: true },
)

const gameStatus = computed({
  get: () => localStatus.value,
  set: (val) => {
    localStatus.value = val
  },
})

const hasThreePrompts = computed(() => {
  const p = props.currentGame?.prompts
  return (
    p &&
    Array.isArray(p) &&
    p.length === 3 &&
    p.every((s) => typeof s === 'string' && s.trim().length > 0)
  )
})

const isUpdating = ref(false)

const handleStatusChange = async () => {
  if (!props.currentGame?.id || isUpdating.value) return

  const newStatus = localStatus.value
  const oldStatus = props.currentGame.status || 'waiting'

  isUpdating.value = true

  try {
    await updateGameStatus(props.currentGame.id, newStatus)
    alert(`Game is now ${newStatus.toUpperCase()}`)
  } catch (error) {
    alert('Failed to update game status: ' + (error.message || 'Unknown error'))
    localStatus.value = oldStatus
  } finally {
    isUpdating.value = false
  }
}
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm p-6">
    <div class="flex items-center gap-2 mb-2">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
      <h2 class="text-lg font-semibold text-dark-gray">Game Status</h2>
    </div>

    <p class="text-xs text-slate mb-4">Update the current status of the game for all players.</p>

    <div v-if="!currentGame" class="text-center py-8 text-slate">
      <p class="text-sm">No active game yet.</p>
      <p class="text-xs mt-2">Create a new game to enable status controls.</p>
    </div>

    <div v-else>
      <select
        v-model="gameStatus"
        @change="handleStatusChange"
        :disabled="isUpdating"
        class="w-full px-3 py-2 bg-soft text-sm rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer disabled:opacity-50"
      >
        <option value="waiting">Waiting</option>
        <option value="active" :disabled="!hasThreePrompts">
          Active {{ !hasThreePrompts ? '(Requires 3 valid prompts)' : '' }}
        </option>
        <option value="ended">Ended</option>
      </select>

      <div v-if="isUpdating" class="mt-3 text-center text-sm text-primary">Updating status...</div>
    </div>
  </div>
</template>
