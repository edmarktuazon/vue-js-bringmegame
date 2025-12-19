<!-- eslint-disable no-unused-vars -->
<script setup>
import { ref } from 'vue'
import { updatePrize } from '/firebase/gameHelpers'

const props = defineProps({
  currentGame: Object,
})

const emit = defineEmits(['prize-saved'])

const prizeDescription = ref(props.currentGame?.prize?.description || '')
const prizeLogoFile = ref(null)
const prizeLogoPreview = ref(props.currentGame?.prize?.logoUrl || null)
const savingPrize = ref(false)

const handlePrizeLogoUpload = (e) => {
  const file = e.target.files[0]
  if (!file) return
  prizeLogoFile.value = file
  const reader = new FileReader()
  reader.onload = (ev) => (prizeLogoPreview.value = ev.target.result)
  reader.readAsDataURL(file)
}

const handleSavePrize = async () => {
  if (!props.currentGame || !prizeDescription.value.trim()) {
    alert('Please fill prize description')
    return
  }
  savingPrize.value = true
  try {
    await updatePrize(props.currentGame.id, prizeDescription.value, prizeLogoFile.value)
    alert('Prize saved')
    emit('prize-saved')
  } catch (_) {
    alert('Failed to save prize')
  } finally {
    savingPrize.value = false
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
          d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
        />
      </svg>
      <h2 class="text-lg font-semibold text-dark-gray">Edit Prize</h2>
    </div>
    <p class="text-xs text-slate mb-4">
      Set the prize description and upload a logo. This will be visible to everyone.
    </p>

    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-dark-gray mb-2">Prize Logo</label>
        <div class="flex items-center gap-4">
          <div
            class="w-16 h-16 bg-soft rounded-md flex items-center justify-center overflow-hidden"
          >
            <img
              v-if="prizeLogoPreview"
              :src="prizeLogoPreview"
              alt="Prize logo"
              class="w-full h-full object-cover"
            />
            <svg
              v-else
              class="w-8 h-8 text-slate"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <div>
            <label
              class="flex items-center gap-2 px-4 py-2 bg-soft text-dark-gray text-sm rounded-md cursor-pointer hover:bg-light transition"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              Upload Logo
              <input type="file" accept="image/*" class="hidden" @change="handlePrizeLogoUpload" />
            </label>
            <p class="text-xs text-slate mt-1">Recommended: Square image, &lt;1MB</p>
          </div>
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-dark-gray mb-2">Prize Description</label>
        <textarea
          v-model="prizeDescription"
          placeholder="e.g., A$50 gift card to Starbucks"
          rows="3"
          class="w-full px-3 py-2 bg-soft text-sm rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        ></textarea>
      </div>
      <button
        @click="handleSavePrize"
        :disabled="savingPrize || !currentGame"
        class="flex items-center justify-center gap-2 w-full bg-primary text-white font-semibold py-3 rounded-md transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
          />
        </svg>
        {{ savingPrize ? 'Saving...' : 'Save Prize' }}
      </button>
    </div>
  </div>
</template>
