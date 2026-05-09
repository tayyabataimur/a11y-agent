<!-- Intentionally broken for a11y testing. Do not copy. -->
<script setup>
import { ref } from "vue";
const avatar = ref("https://placehold.co/40");
</script>

<template>
  <main>
    <h1>Broken Vue Demo</h1>

    <img src="https://placehold.co/200" />
    <img :src="avatar" />

    <button>
      <svg width="16" height="16" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6" />
      </svg>
    </button>

    <a href="/profile">
      <img :src="avatar" />
    </a>

    <form>
      <input type="text" placeholder="Email" />
      <input type="password" placeholder="Password" />
      <button type="submit">Submit</button>
    </form>

    <p style="color:#bbb;background:#ddd">Low-contrast paragraph.</p>
  </main>
</template>
