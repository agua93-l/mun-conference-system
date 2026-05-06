<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup>
// 不需要額外設定，router-view 會渲染對應的元件
</script>

<style>
#app {
  font-family: Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}
</style>