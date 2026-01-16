<template>
  <div class="home">
    <CesiumViewer />
  </div>
</template>

<script>
// @ is an alias to /src
import CesiumViewer from '@/components/CesiumViewer.vue'

export default {
  name: 'HomeView',
  components: {
    CesiumViewer
  }
}
</script>

<style scoped>
.home {
  width: 100%;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>
