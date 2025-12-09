<script setup>
import JoinGameButton from './buttons/JoinGameButton.vue'
import BMGLogo from '/BMG-Logo.png'
</script>

<template>
  <main class="main flex flex-col justify-center items-center font-montserrat px-4">
    <form class="relative w-full max-w-sm text-center" method="POST">
      <div class="rounded-lg bg-white shadow-xl w-full">
        <!-- logo and text -->
        <div class="flex items-center flex-col px-6 pt-6 pb-4 space-y-6">
          <img :src="BMGLogo" class="w-48 h-24.25" alt="Bring Me Game Logo" />
          <p class="text-sm">Enter your Instagram handle to join the game.</p>
        </div>
        <!-- input field and button -->
        <div class="flex items-center flex-col p-6 space-y-4">
          <input
            type="text"
            name="instagram_handle"
            class="bg-soft w-full font-montserrat text-sm p-3 rounded-md outline-primary"
            placeholder="@yourhandle"
            required
          />
          <JoinGameButton label="Join Game" />
        </div>
        <div class="px-6 pb-6">
          <p class="text-xs">
            By Clicking "Join Game", you agree that you are the owner of the given Instagram handle.
            Any prizes won will be communicated directly via Instagram.
          </p>
        </div>
      </div>
    </form>
  </main>
</template>

<style scoped>
.main {
  height: 100dvh;
  width: 100vw;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  background-image: radial-gradient(circle, hsl(270 50% 88%) 0.125rem, transparent 0.125rem);
  background-size: 1.25rem 1.25rem;
}
</style>

<!-- <style scoped>
.main {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding-left: 1rem;
  padding-right: 1rem;
  height: 100dvh;
  width: 100vw;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  background-image:
    linear-gradient(45deg, hsl(270 50% 88%) 25%, transparent 25%),
    linear-gradient(-45deg, hsl(270 50% 88%) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, hsl(270 50% 88%) 75%),
    linear-gradient(-45deg, transparent 75%, hsl(270 50% 88%) 75%);
  background-size: 40px 40px;
  background-position:
    0 0,
    0 20px,
    20px -20px,
    -20px 0px;
}
</style> -->
