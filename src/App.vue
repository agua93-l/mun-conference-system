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
  margin: 0;
  padding: 0;
}

body {
  margin: 0;
  padding: 0;
}
</style>