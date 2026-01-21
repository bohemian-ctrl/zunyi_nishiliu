import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'

Vue.config.productionTip = false
// window.CESIUM_BASE_URL = '/zunyi_nishiliu/dist/cesium/'
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiOTA0NzFmOC1kYmNmLTQzMDctYjQxYS1iOTIwOWZhMTBmODkiLCJpZCI6Mzc1MTkwLCJpYXQiOjE3NjgyOTU3OTZ9.LSMLo60NHgkaMtgmxWSTGt_XYLpAp01StwJwMaiL8p4";
    
window.CESIUM_BASE_URL = 'https://cdn.jsdelivr.net/npm/cesium@1.107/Build/Cesium/'
new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
