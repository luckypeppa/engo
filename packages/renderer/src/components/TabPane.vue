<template>
  <div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  tab: string;
}>();
</script>

<style scoped></style>
