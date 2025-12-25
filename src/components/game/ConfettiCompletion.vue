<!-- components/game/ConfettiCelebration.vue -->
<script setup>
import { onMounted, watch, onUnmounted } from 'vue'
import confetti from 'canvas-confetti'

const props = defineProps({
  trigger: {
    type: Boolean,
    required: true,
  },
})

let confettiInterval = null

const fireConfetti = () => {
  // Main burst
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
    gravity: 0.8,
    scalar: 1.2,
  })

  // Side burst
  confetti({
    particleCount: 50,
    angle: 60,
    spread: 55,
    origin: { x: 0 },
    colors: ['#8b5cf6', '#3b82f6', '#10b981'],
  })

  confetti({
    particleCount: 50,
    angle: 120,
    spread: 55,
    origin: { x: 1 },
    colors: ['#f59e0b', '#ef4444', '#10b981'],
  })
}

onMounted(() => {
  if (props.trigger) {
    fireConfetti()

    // Continuous light confetti for 4 seconds
    confettiInterval = setInterval(() => {
      confetti({
        particleCount: 30,
        spread: 100,
        origin: { y: 0.6 },
        gravity: 0.5,
        ticks: 200,
        scalar: 0.8,
      })
    }, 400)

    setTimeout(() => {
      if (confettiInterval) clearInterval(confettiInterval)
    }, 4000)
  }
})

onUnmounted(() => {
  if (confettiInterval) clearInterval(confettiInterval)
})

watch(
  () => props.trigger,
  (newVal) => {
    if (newVal) {
      fireConfetti()
    }
  },
)
</script>

<template>
  <div />
</template>
