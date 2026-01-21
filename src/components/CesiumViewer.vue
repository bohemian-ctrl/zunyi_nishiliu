<template>
  <div class="cesium-container">
    <!-- Cesium Viewer -->
    <div id="cesiumContainer" ref="cesiumContainer"></div>
    
    <!-- 左侧控制面板 -->
    <div class="control-panel left-panel">
      <div class="panel-header">
        <h2>泥石流风险可视化</h2>
        <p class="subtitle">遵义市</p>
      </div>

      <!-- 预设视角 -->
      <div class="panel-section">
        <h3>预设视角</h3>
        <div class="button-group">
          <button @click="flyToView('overview')" class="btn-primary">全市概览</button>
          <button @click="flyToView('highRisk')" class="btn-primary">高风险区聚焦</button>
          <!-- <button @click="flyToView('typical')" class="btn-primary">典型沟谷</button> -->
        </div>
      </div>

      <!-- 图层控制 -->
      <div class="panel-section">
        <h3>图层控制</h3>
        <div class="layer-control">
          <label class="checkbox-label">
            <input type="checkbox" v-model="layers.terrain" @change="toggleLayer('terrain')">
            <span>地形</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="layers.satellite" @change="toggleLayer('satellite')" checked>
            <span>卫星底图</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="layers.slope" @change="toggleLayer('slope')">
            <span>坡度</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="layers.ndvi" @change="toggleLayer('ndvi')">
            <span>NDVI植被</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="layers.precipitation" @change="toggleLayer('precipitation')">
            <span>降水量</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="layers.risk" @change="toggleLayer('risk')" checked>
            <span>风险区</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="layers.buildings" @change="toggleLayer('buildings')">
            <span>建筑</span>
          </label>
        </div>
      </div>

      <!-- 风险区透明度 -->
      <div class="panel-section" v-if="layers.risk">
        <h3>风险区透明度</h3>
        <input type="range" v-model.number="riskOpacity" min="0" max="1" step="0.1" @input="updateRiskOpacity" class="slider">
        <span class="slider-value">{{ (Number(riskOpacity) * 100).toFixed(0) }}%</span>
      </div>

      <!-- 风险区分级显示 -->
      <div class="panel-section" v-if="layers.risk">
        <h3>风险等级</h3>
        <label class="checkbox-label">
          <input type="checkbox" v-model="riskLevels.high" @change="updateRiskLevels" checked>
          <span class="risk-high">高风险</span>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" v-model="riskLevels.medium" @change="updateRiskLevels" checked>
          <span class="risk-medium">中风险</span>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" v-model="riskLevels.low" @change="updateRiskLevels" checked>
          <span class="risk-low">低风险</span>
        </label>
      </div>

      <!-- 测量工具 -->
      <div class="panel-section">
        <h3>测量工具</h3>
        <div class="button-group">
          <button @click="startMeasure('distance')" :class="{'btn-active': measureMode === 'distance'}" class="btn-secondary">测距</button>
          <button @click="startMeasure('area')" :class="{'btn-active': measureMode === 'area'}" class="btn-secondary">测面积</button>
          <button @click="startMeasure('profile')" :class="{'btn-active': measureMode === 'profile'}" class="btn-secondary">剖面分析</button>
          <button @click="clearMeasure" class="btn-secondary">清除</button>
        </div>
      </div>

      <!-- 时间轴控制（扩展功能） -->
      <div class="panel-section" v-if="timeEnabled">
        <h3>时间轴</h3>
        <div class="time-control">
          <button @click="togglePlay" class="btn-secondary">{{ isPlaying ? '暂停' : '播放' }}</button>
          <input type="range" v-model="timeValue" min="0" max="100" @input="updateTime" class="slider">
          <span class="time-display">{{ formatTime(timeValue) }}</span>
        </div>
        <div class="speed-control">
          <label>播放速度：</label>
          <select v-model="playSpeed" @change="updatePlaySpeed">
            <option value="0.5">0.5x</option>
            <option value="1" selected>1x</option>
            <option value="2">2x</option>
            <option value="5">5x</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 数据加载提示 -->
    <div class="loading-overlay" v-if="isLoading">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <h3>正在加载数据...</h3>
        <p class="loading-message">{{ loadMessage }}</p>
        <div class="progress-bar-container">
          <div class="progress-bar" :style="{ width: loadProgress + '%' }"></div>
        </div>
        <p class="progress-text">{{ loadedEntities }} / {{ totalEntities }} 个区域已加载 ({{ Math.round(loadProgress) }}%)</p>
      </div>
    </div>

    <!-- 透明度更新提示 -->
    <div class="loading-overlay" v-if="isUpdatingOpacity">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <h3>正在更新透明度...</h3>
        <p class="loading-message">{{ updateOpacityMessage }}</p>
        <div class="progress-bar-container">
          <div class="progress-bar" :style="{ width: updateOpacityProgress + '%' }"></div>
        </div>
        <p class="progress-text">{{ Math.round(updateOpacityProgress) }}%</p>
      </div>
    </div>

    <!-- 右侧信息面板 -->
    <div class="info-panel right-panel" v-if="selectedFeature">
      <div class="panel-header">
        <h3>区域信息</h3>
        <button @click="closeInfoPanel" class="close-btn">×</button>
      </div>
      <div class="selected-count" v-if="selectedEntities.length > 1">
        已选中 {{ selectedEntities.length }} 个区域
      </div>
      <div class="info-content">
        <div class="info-item">
          <label>风险等级：</label>
          <span :class="getRiskClass(selectedFeature.properties.riskLevel)">
            {{ getRiskText(selectedFeature.properties.riskLevel) }}
            <span v-if="selectedFeature.properties.risk" class="risk-code">
              (Risk: {{ selectedFeature.properties.risk }})
            </span>
          </span>
        </div>
        <div class="info-item" v-if="selectedFeature.properties.count">
          <label>区域数量：</label>
          <span>{{ selectedFeature.properties.count }}</span>
        </div>
        <div class="info-item" v-if="selectedFeature.properties.slope">
          <label>坡度：</label>
          <span>{{ selectedFeature.properties.slope }}°</span>
        </div>
        <div class="info-item" v-if="selectedFeature.properties.ndvi">
          <label>NDVI：</label>
          <span>{{ selectedFeature.properties.ndvi }}</span>
        </div>
        <div class="info-item" v-if="selectedFeature.properties.precipitation">
          <label>年降水量：</label>
          <span>{{ selectedFeature.properties.precipitation }}mm</span>
        </div>
        <div class="info-item" v-if="selectedFeature.properties.township">
          <label>所属乡镇：</label>
          <span>{{ selectedFeature.properties.township }}</span>
        </div>
        <div class="info-item" v-if="selectedFeature.properties.area">
          <label>面积：</label>
          <span>{{ selectedFeature.properties.area }} km²</span>
        </div>
        <div class="info-actions" v-if="selectedEntities.length > 0">
          <button @click="exportSelectedData" class="btn-export">导出选中数据(CSV)</button>
        </div>
      </div>
    </div>

    <!-- 图例 -->
    <div class="legend">
      <h4>图例</h4>
      <div class="legend-item">
        <span class="legend-color risk-high"></span>
        <span>高风险区</span>
      </div>
      <div class="legend-item">
        <span class="legend-color risk-medium"></span>
        <span>中风险区</span>
      </div>
      <div class="legend-item">
        <span class="legend-color risk-low"></span>
        <span>低风险区</span>
      </div>
      <div class="legend-item">
        <span class="legend-color water"></span>
        <span>水体</span>
      </div>
    </div>

    <!-- 测量结果显示 -->
    <div class="measure-result" v-if="measureResult">
      <div class="result-content">
        <h4>测量结果</h4>
        <p v-if="measureResult.type === 'distance'">距离：{{ measureResult.value }} km</p>
        <p v-if="measureResult.type === 'area'">面积：{{ measureResult.value }} km²</p>
        <button @click="clearMeasure" class="btn-small">关闭</button>
      </div>
    </div>
  </div>
</template>

<script>
import Cesium from '@/utils/cesiumLoader'
import { CesiumMeasure } from '@/utils/cesiumMeasure'
import { RiskDataLoader } from '@/utils/riskDataLoader'
const ZUNYI_DEM_ASSET_ID = 4343955;

export default {
  name: 'CesiumViewer',
  data() {
    return {
      viewer: null,
      measureTool: null,
      riskDataLoader: null,
      layers: {
        terrain: true,
        satellite: true,
        slope: false,
        ndvi: false,
        precipitation: false,
        risk: true,
        buildings: false
      },
      riskOpacity: 0.6,
      riskLevels: {
        high: true,
        medium: true,
        low: true
      },
      measureMode: null,
      measureResult: null,
      selectedFeature: null,
      slopeLayer: null,
      ndviLayer: null,
      precipitationLayer: null,
      buildingsLayer: null,
      timeEnabled: false,
      isPlaying: false,
      timeValue: 0,
      playSpeed: 1,
      selectedEntities: [],
      clickHandler: null, // 保存事件处理器引用
      zoomTimeout: null, // 保存定时器引用gg
      // 数据加载状态
      isLoading: false,
      loadProgress: 0,
      loadMessage: '',
      totalEntities: 0,
      loadedEntities: 0,
      // 透明度更新状态
      isUpdatingOpacity: false,
      updateOpacityProgress: 0,
      updateOpacityMessage: '',
      // 遵义市坐标范围
      zunyiBounds: {
        center: [106.9375, 27.7250], // 经度, 纬度
        zoom: 9
      }
    }
  },
  mounted() {
    this.initCesium()
  },
  beforeDestroy() {
    // 清理所有资源
    this.cleanup()
  },
  methods: {
    cleanup() {
      // 清理定时器
      if (this.zoomTimeout) {
        clearTimeout(this.zoomTimeout)
        this.zoomTimeout = null
      }
      
      // 清理事件处理器
      if (this.clickHandler) {
        this.clickHandler.destroy()
        this.clickHandler = null
      }
      
      // 清理测量工具
      if (this.measureTool) {
        this.measureTool.clear()
        this.measureTool = null
      }
      
      // 清理数据加载器
      if (this.riskDataLoader) {
        this.riskDataLoader.clear()
        this.riskDataLoader = null
      }
      
      // 清理图层
      if (this.buildingsLayer && this.viewer) {
        try {
          this.viewer.scene.primitives.remove(this.buildingsLayer)
        } catch (e) {
          console.warn('清理建筑图层失败:', e)
        }
        this.buildingsLayer = null
      }
      
      // 销毁Viewer
      if (this.viewer) {
        try {
          this.viewer.destroy()
        } catch (e) {
          console.warn('销毁Viewer失败:', e)
        }
        this.viewer = null
      }
      
      // 清空数组引用
      this.selectedEntities = []
    },

    initCesium() {
      // 设置Cesium Ion访问令牌（需要替换为您的令牌）
      // 注意：这里使用占位符，实际使用时需要申请Cesium Ion账号获取token
      // 或者使用其他地图服务提供商
      try {
        const CESIUM_ION_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiOTA0NzFmOC1kYmNmLTQzMDctYjQxYS1iOTIwOWZhMTBmODkiLCJpZCI6Mzc1MTkwLCJpYXQiOjE3NjgyOTU3OTZ9.LSMLo60NHgkaMtgmxWSTGt_XYLpAp01StwJwMaiL8p4";
    
        Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN
      } catch (e) {
        console.warn('Cesium Ion token未设置，部分功能可能受限')
      }
      this.viewer = new Cesium.Viewer("cesiumContainer", {
                imageryProvider: new Cesium.UrlTemplateImageryProvider({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          // url: 'https://tile.openstreetmap.org/'
          credit: 'Esri'
        }),
        timeline: false, // 隐藏时间轴
        animation: false, // 隐藏动画控件
        baseLayerPicker: true, // 显示底图切换按钮
        geocoder: false, // 隐藏地理编码
        homeButton: true, // 显示主页按钮
        sceneModePicker: false, // 隐藏场景模式切换
        navigationHelpButton: false, // 隐藏帮助按钮
        terrainProvider: new Cesium.EllipsoidTerrainProvider() // 初始化基础椭球地形
    });
      // 创建Viewer - 优化性能设置
      // this.viewer = new Cesium.Viewer('cesiumContainer', {
      //   terrainProvider: Cesium.createWorldTerrain(),

      //   baseLayerPicker: false,
      //   geocoder: false,
      //   homeButton: false,
      //   infoBox: false,
      //   sceneModePicker: false,
      //   selectionIndicator: false,
      //   timeline: false,
      //   animation: false,
      //   fullscreenButton: true,
      //   vrButton: false,
      //   // 性能优化设置
      //   requestRenderMode: true, // 按需渲染，减少不必要的渲染
      //   maximumRenderTimeChange: Infinity // 避免频繁渲染
      // })
      // 4. 加载国内兼容影像底图（替换原版OSM，解决国内访问问题）
      
      // 设置性能优化
      this.viewer.scene.globe.enableLighting = false // 禁用光照以提高性能
      this.viewer.scene.requestRenderMode = true // 按需渲染
      this.viewer.scene.maximumRenderTimeChange = Infinity // 避免频繁渲染
      
      // 限制同时渲染的实体数量（大数据量时）
      this.viewer.scene.primitives.maximumScreenSpaceError = 2
      
      // 优化数据源渲染性能
      this.viewer.scene.globe.depthTestAgainstTerrain = false // 禁用深度测试以提高性能
      
      // 限制同时显示的实体数量
      this.viewer.scene.globe.tileCacheSize = 100 // 减少瓦片缓存大小

      // 初始化工具类
      this.measureTool = new CesiumMeasure(this.viewer)
      this.riskDataLoader = new RiskDataLoader(this.viewer)

      // 设置初始视角到遵义市
      this.viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(
          this.zunyiBounds.center[0],
          this.zunyiBounds.center[1],
          50000
        )
      })

      

      // 加载DEM地形（如果有本地DEM数据）
      this.loadTerrain()

      // 等待地形准备就绪后再加载风险区数据，确保贴地效果
      // 使用地形准备完成的回调
     

      // 设置点击事件
      this.setupClickHandler()

      // // 加载建筑数据
      // this.loadBuildings()

      // // // 设置剖面分析回调
      // this.measureTool.onProfileGenerated = (profileData) => {
      //   this.showProfileChart(profileData)
      // }

      
    },

    loadTerrain() {
      // 检查是否启用地形图层
      if (!this.layers.terrain) {
        return
      }

      try {
        // 在 Cesium 1.95 中，使用 IonResource 创建地形提供者
        const ionResource = Cesium.IonResource.fromAssetId(ZUNYI_DEM_ASSET_ID)
        
        // 创建地形提供者
        const terrainProvider = new Cesium.CesiumTerrainProvider({
          url: ionResource,
          requestVertexNormals: true, // 启用地形法线，支持光影渲染
          requestWaterMask: false // 无需水面蒙版，关闭优化性能
        })

        // 等待地形提供者准备就绪
        terrainProvider.readyPromise.then(() => {
          // 地形加载成功，替换Viewer的地形提供者
          this.viewer.terrainProvider = terrainProvider
          console.log("遵义DEM地形加载中，Asset ID：", ZUNYI_DEM_ASSET_ID)
          console.log("遵义DEM地形加载成功！")

          // 隐藏Cesium版权信息（可选，健壮性优化：增加元素判空）
          const creditsElement = document.querySelector(".cesium-widget-credits")
          if (creditsElement) {
            creditsElement.style.display = "none"
          }
          this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(106.9264, 27.7259, 10000), // 遵义经纬度+高度
            orientation: {
                heading: Cesium.Math.toRadians(0), // 正北方向（0°）
                pitch: Cesium.Math.toRadians(-60), // 俯视60°，便于观察地形
                roll: 0 // 无侧翻，保持水平
            },
            duration: 3 // 相机飞行时长，3秒完成定位
        });
        setTimeout(()=>{
          this.loadRiskZones()
        },3000)
          
        }).catch(error => {
          // 地形加载失败，捕获异常并提示
          console.error("DEM地形加载失败详情：", error)
          // 如果加载失败，使用默认地形
          console.warn("使用默认地形作为备用方案")
          this.viewer.terrainProvider = Cesium.createWorldTerrain()

         
        })
      } catch (error) {
        // 如果创建地形提供者失败，使用默认地形
        console.error("创建DEM地形提供者失败：", error)
        console.warn("使用默认地形作为备用方案")
        this.viewer.terrainProvider = Cesium.createWorldTerrain()
      }
    },

    async loadRiskZones() {
      try {
        // 显示加载提示
        this.isLoading = true
        this.loadProgress = 0
        this.loadMessage = '正在读取数据文件...'
        this.totalEntities = 0
        this.loadedEntities = 0
        
        console.log('开始加载风险区数据: /data/doc.geojson')
        
        // 使用RiskDataLoader加载数据，传入进度回调
        const entities = await this.riskDataLoader.loadFromGeoJSON('/zunyi_nishiliu/dist/data/doc.geojson', (loadedEntities) => {
          // 检查组件是否还存在
          if (!this.viewer || !this.$el) {
            console.warn('组件已销毁，取消数据加载回调')
            return
          }
          
          console.log('风险区数据加载成功，共', loadedEntities.length, '个区域')
          
          // 延迟更新样式，避免阻塞UI
          this.$nextTick(() => {
            this.updateRiskOpacity()
            this.updateRiskLevels()
          })
          
          // 自动缩放到数据范围
          if (loadedEntities.length > 0 && this.viewer) {
            // 清理之前的定时器
            if (this.zoomTimeout) {
              clearTimeout(this.zoomTimeout)
            }
            
            this.zoomTimeout = setTimeout(() => {
              // 再次检查组件是否存在
              if (!this.viewer || !this.$el) {
                return
              }
              
              try {
                this.viewer.zoomTo(this.riskDataLoader.dataSource)
                console.log('已自动缩放到数据范围')
              } catch (e) {
                console.warn('自动缩放失败:', e)
              }
            }, 1000)
          }
        }, (progress) => {
          console.log(progress,this.isLoading)
          // 进度回调：更新加载进度
          // 使用 $nextTick 确保 Vue 响应式更新能及时反映到 DOM
          if (this.$el && this.isLoading) {
            this.loadProgress = progress.progress || 0
              this.loadMessage = progress.message || '正在加载...'
              this.totalEntities = progress.total || 0
              this.loadedEntities = progress.loaded || 0
              this.$forceUpdate()
              // 如果加载完成，延迟隐藏加载提示
              if (progress.loaded === progress.total && progress.total > 0) {
                setTimeout(() => {
                  if (this.$el) {
                    this.isLoading = false
                    this.loadProgress = 100
                    this.loadMessage = '加载完成！'
                  }
                }, 300) // 延迟300ms，让用户看到完成状态
              }
          }
        })
        
        // 延迟隐藏加载提示，让用户看到完成状态
        // setTimeout(() => {
        //   if (this.$el) {
        //     this.isLoading = false
        //     this.loadProgress = 100
        //     this.loadMessage = '加载完成！'
        //   }
        // }, 500)
        
        console.log('风险区实体列表:', entities)
      } catch (error) {
        // 加载失败，隐藏加载提示并显示错误
        this.isLoading = false
        this.loadMessage = '加载失败！'
        console.error('加载风险区数据失败:', error)
        
        // 使用更友好的错误提示，避免阻塞
        if (this.$el) {
          setTimeout(() => {
            alert('加载风险区数据失败，请检查控制台错误信息')
          }, 500)
        }
      }
    },

    getRiskColor(riskLevel) {
      return this.riskDataLoader.getRiskColor(riskLevel, this.riskOpacity)
    },

    toggleLayer(layerName) {
      console.log('切换图层:', layerName, '状态:', this.layers[layerName])
      
      switch(layerName) {
        case 'terrain':
          if (this.layers.terrain) {
            this.viewer.terrainProvider = Cesium.createWorldTerrain()
          } else {
            this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider()
          }
          break
          
        case 'satellite':
          // 卫星底图是基础图层，通常不需要切换
          // 如果需要切换，可以在这里实现
          if (!this.layers.satellite) {
            // 可以切换到其他底图
            console.log('卫星底图已关闭')
          }
          break
          
        case 'risk':
          // 控制风险区显示/隐藏
          if (this.riskDataLoader) {
            this.riskDataLoader.setVisible(this.layers.risk)
            console.log('风险区图层', this.layers.risk ? '显示' : '隐藏')
          }
          break
          
        case 'buildings':
          if (this.layers.buildings && !this.buildingsLayer) {
            this.loadBuildings()
          } else if (!this.layers.buildings && this.buildingsLayer) {
            this.viewer.scene.primitives.remove(this.buildingsLayer)
            this.buildingsLayer = null
          }
          break
          
        case 'slope':
          // 加载坡度图层
          this.loadSlopeLayer()
          break
          
        case 'ndvi':
          // 加载NDVI图层
          this.loadNDVILayer()
          break
          
        case 'precipitation':
          // 加载降水量图层
          this.loadPrecipitationLayer()
          break
      }
    },

    loadBuildings() {
      if (this.buildingsLayer) return
      
      // 加载OSM Buildings（需要Cesium Ion访问令牌）
      try {
        this.buildingsLayer = this.viewer.scene.primitives.add(
          Cesium.createOsmBuildings()
        )
      } catch (error) {
        console.warn('无法加载OSM Buildings:', error)
      }
    },

    loadSlopeLayer() {
      // 加载坡度栅格图层
      // 实际项目中需要从GEE导出的坡度数据加载
      if (this.slopeLayer) {
        this.viewer.imageryLayers.remove(this.slopeLayer)
        this.slopeLayer = null
      }
      
      if (this.layers.slope) {
        // 示例：使用WMS服务或本地瓦片服务
        // this.slopeLayer = this.viewer.imageryLayers.addImageryProvider(...)
        console.log('加载坡度图层')
      }
    },

    loadNDVILayer() {
      // 加载NDVI图层
      if (this.ndviLayer) {
        this.viewer.imageryLayers.remove(this.ndviLayer)
        this.ndviLayer = null
      }
      
      if (this.layers.ndvi) {
        console.log('加载NDVI图层')
      }
    },

    loadPrecipitationLayer() {
      // 加载降水量图层
      if (this.precipitationLayer) {
        this.viewer.imageryLayers.remove(this.precipitationLayer)
        this.precipitationLayer = null
      }
      
      if (this.layers.precipitation) {
        console.log('加载降水量图层')
      }
    },

    updateRiskOpacity() {
      // 确保透明度值是数字类型
      const opacity = typeof this.riskOpacity === 'string' ? parseFloat(this.riskOpacity) : Number(this.riskOpacity)
      
      // 验证值是否有效
      if (isNaN(opacity) || opacity < 0 || opacity > 1) {
        console.warn('无效的透明度值:', this.riskOpacity)
        return
      }
      
      console.log('调用 updateRiskOpacity, 透明度值:', opacity, '类型:', typeof opacity)
      
      if (this.riskDataLoader && this.riskDataLoader.entities && this.riskDataLoader.entities.length > 0) {
        // 显示更新提示
        this.isUpdatingOpacity = true
        this.updateOpacityProgress = 0
        this.updateOpacityMessage = '正在更新风险区域透明度...'
        
        // 调用更新方法，传入进度回调
        this.riskDataLoader.updateOpacity(opacity, (progress) => {
          if (this.$el) {
            this.updateOpacityProgress = progress.progress || 0
            this.updateOpacityMessage = progress.message || '正在更新...'
            
            // 如果更新完成，延迟隐藏提示
            if (progress.progress >= 100) {
              setTimeout(() => {
                if (this.$el) {
                  this.isUpdatingOpacity = false
                  this.updateOpacityProgress = 0
                  this.updateOpacityMessage = ''
                }
              }, 300) // 延迟300ms，让用户看到完成状态
            }
          }
        })
      } else {
        console.warn('风险数据加载器未初始化或没有实体')
      }
    },

    updateRiskLevels() {
      if (this.riskDataLoader) {
        this.riskDataLoader.updateRiskLevels(this.riskLevels)
      }
    },

    setupClickHandler() {
      // 清理之前的事件处理器
      if (this.clickHandler) {
        this.clickHandler.destroy()
      }
      
      this.clickHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas)
      
      this.clickHandler.setInputAction((click) => {
        // 检查组件是否还存在
        if (!this.viewer || !this.$el) {
          return
        }
        
        // 如果正在测量，不处理点击事件
        if (this.measureMode) {
          return
        }

        try {
          const pickedObject = this.viewer.scene.pick(click.position)
          
          if (Cesium.defined(pickedObject) && pickedObject.id) {
            const entity = pickedObject.id
            
            // 检查是否是风险区实体（从 riskDataLoader 获取实体列表）
            const riskEntities = this.riskDataLoader?.entities || []
            if (riskEntities.includes(entity)) {
              const props = entity.properties || {}
              this.selectedFeature = {
                properties: {
                  riskLevel: props.riskLevel || 'low',
                  risk: props.risk || 0, // 原始 Risk 值
                  slope: props.slope || 0,
                  ndvi: props.ndvi || 0,
                  precipitation: props.precipitation || 0,
                  township: props.township || '',
                  area: props.area || 0,
                  count: props.count || 0
                }
              }

              // 添加到选中列表（支持多选）
              if (!this.selectedEntities.includes(entity)) {
                this.selectedEntities.push(entity)
              }
            }
          } else {
            this.selectedFeature = null
          }
        } catch (e) {
          console.warn('点击事件处理错误:', e)
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

      // 双击清除选择
      this.clickHandler.setInputAction(() => {
        if (!this.viewer || !this.$el) {
          return
        }
        this.selectedFeature = null
        this.selectedEntities = []
      }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    },

    flyToView(type) {
      if (type === 'highRisk') {
        // 高风险区聚焦：基于实际加载的数据
        this.flyToHighRiskAreas()
        return
      }

      const views = {
        overview: {
          destination: Cesium.Cartesian3.fromDegrees(106.9375, 27.7250, 10000),
          orientation: {
            heading: Cesium.Math.toRadians(0), // 正北方向（0°）
                pitch: Cesium.Math.toRadians(-60), // 俯视60°，便于观察地形
            roll: 0
          }
        },
        typical: {
          destination: Cesium.Cartesian3.fromDegrees(107.05, 27.65, 15000),
          orientation: {
            heading: Cesium.Math.toRadians(45), // 正北方向（45°）
                pitch: Cesium.Math.toRadians(-60), // 俯视60°，便于观察地形
            roll: 0
          }
        }
      }

      if (views[type]) {
        this.viewer.camera.flyTo(views[type])
      }
    },

    /**
     * 聚焦到高风险区域
     */
    flyToHighRiskAreas() {
      if (!this.riskDataLoader || !this.riskDataLoader.dataSource) {
        console.warn('风险区数据未加载，无法聚焦高风险区域')
        // 如果没有数据，使用默认位置
        this.viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(106.95, 27.75, 20000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-20),
            roll: 0
          }
        })
        return
      }
      // 从 riskDataLoader 获取所有实体（避免响应式监听）
      const riskEntities = this.riskDataLoader?.entities || []
      console.log('所有风险实体:', riskEntities.length)
      
      // 筛选高风险区域
      // 优先使用 _riskLevel（快速访问属性），如果没有则尝试其他方式
      const highRiskEntities = riskEntities.filter(entity => {
        if (!entity) {
          return false
        }
        
        // 方式1：使用快速访问属性（最可靠）
        if (entity._riskLevel === 'high') {
          return true
        }
        
        // 方式2：从 _riskData 获取
        if (entity._riskData && entity._riskData.riskLevel === 'high') {
          return true
        }
        
        // 方式3：从 properties 获取
        let riskLevel = null
        if (entity.properties) {
          // 如果是 PropertyBag，使用 getValue
          if (entity.properties.getValue && typeof entity.properties.getValue === 'function') {
            try {
              const props = entity.properties.getValue()
              riskLevel = props?.riskLevel
              // 如果没有 riskLevel，尝试从 Risk 计算
              if (!riskLevel && props?.Risk !== undefined) {
                riskLevel = props.Risk === 1 ? 'high' : (props.Risk === 2 ? 'medium' : 'low')
              }
            } catch (e) {
              // 忽略错误
            }
          } else {
            // 普通对象，直接访问
            riskLevel = entity.properties.riskLevel
            if (!riskLevel && entity.properties.Risk !== undefined) {
              riskLevel = entity.properties.Risk === 1 ? 'high' : (entity.properties.Risk === 2 ? 'medium' : 'low')
            }
          }
        }
        
        return riskLevel === 'high'
      })
      
      console.log('筛选结果 - 高风险实体数量:', highRiskEntities.length)
      if (highRiskEntities.length > 0) {
        console.log('第一个高风险实体的属性:', {
          _riskLevel: highRiskEntities[0]._riskLevel,
          _riskData: highRiskEntities[0]._riskData,
          properties: highRiskEntities[0].properties
        })
      }

      if (highRiskEntities.length === 0) {
        console.warn('未找到高风险区域，缩放到所有数据范围')
        // 如果没有高风险区域，缩放到所有数据范围
        try {
          this.viewer.zoomTo(this.riskDataLoader.dataSource);
        } catch (e) {
          console.warn('缩放失败:', e)
        }
        return
      }

      console.log('找到', highRiskEntities.length, '个高风险区域，正在聚焦...')

      // 计算高风险区域的边界球
      const boundingSphere = this.calculateBoundingSphere(highRiskEntities)
      
      if (boundingSphere) {
        // 使用边界球来聚焦
        this.viewer.camera.flyTo({
          destination: boundingSphere.center,
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-60),
            roll: 0
          },
          complete: () => {
            // 飞行完成后，调整相机距离以包含所有高风险区域
            // 计算合适的距离：半径 * 倍数，确保所有区域都在视野内
            const radius = boundingSphere.radius
            const height = radius * 3 // 留出足够的边距
            
            // 将相机移动到合适的高度
            const cartographic = Cesium.Cartographic.fromCartesian(boundingSphere.center)
            const destination = Cesium.Cartesian3.fromRadians(
              cartographic.longitude,
              cartographic.latitude,
              height
            )
            
            this.viewer.zoomTo(this.riskDataLoader.dataSource);
          }
        })
      } else {
        // 如果计算边界失败，使用备用方法：缩放到整个数据源
        console.warn('计算边界失败，使用所有数据范围')
        try {
          this.viewer.zoomTo(this.riskDataLoader.dataSource);
        } catch (e) {
          console.warn('缩放失败:', e)
        }
      }
    },

    /**
     * 计算实体的边界球
     */
    calculateBoundingSphere(entities) {
      if (!entities || entities.length === 0) {
        return null
      }

      try {
        const positions = []
        
        entities.forEach(entity => {
          if (entity.polygon && entity.polygon.hierarchy) {
            const hierarchy = entity.polygon.hierarchy.getValue()
            if (hierarchy.positions && hierarchy.positions.length > 0) {
              hierarchy.positions.forEach(pos => {
                positions.push(pos)
              })
            }
          }
        })

        if (positions.length === 0) {
          return null
        }

        // 使用 Cesium 的 BoundingSphere.fromPoints 计算边界球
        const boundingSphere = Cesium.BoundingSphere.fromPoints(positions)
        return boundingSphere
      } catch (e) {
        console.warn('计算边界球失败:', e)
        return null
      }
    },

    startMeasure(type) {
      // 如果已经在测量，先清除
      if (this.measureMode) {
        this.clearMeasure()
      }

      this.measureMode = type
      this.measureResult = null
      
      // 使用测量工具
      if (type === 'distance') {
        this.measureTool.startDistanceMeasure()
      } else if (type === 'area') {
        this.measureTool.startAreaMeasure()
      } else if (type === 'profile') {
        this.measureTool.startProfileMeasure()
      }
    },

    clearMeasure() {
      if (this.measureTool) {
        const result = this.measureTool.finishMeasure()
        if (result) {
          this.measureResult = result
        }
        this.measureTool.clear()
      }
      this.measureMode = null
      // 延迟清除结果，让用户看到
      setTimeout(() => {
        if (this.$el) {
          this.measureResult = null
        }
      }, 3000)
    },

    showProfileChart(profileData) {
      // 显示剖面图表
      // 这里可以集成图表库（如ECharts）来显示剖面
      console.log('剖面数据:', profileData)
      // 实际实现中可以打开一个模态框显示图表
      this.measureResult = {
        type: 'profile',
        value: `${profileData.length}个采样点`,
        data: profileData
      }
    },

    closeInfoPanel() {
      this.selectedFeature = null
      this.selectedEntities = []
    },

    exportSelectedData() {
      if (this.selectedEntities.length > 0 && this.riskDataLoader) {
        this.riskDataLoader.exportToCSV(this.selectedEntities)
      }
    },

    getRiskClass(level) {
      return `risk-${level}`
    },

    getRiskText(level) {
      const texts = {
        high: '高风险',
        medium: '中风险',
        low: '低风险'
      }
      return texts[level] || '未知'
    },

    togglePlay() {
      this.isPlaying = !this.isPlaying
      // 实现时间轴播放控制
    },

    updateTime() {
      // 更新时间轴
    },

    formatTime(value) {
      // 格式化时间显示
      return `${value}天`
    },

    updatePlaySpeed() {
      // 更新播放速度
    }
  }
}
</script>

<style lang="scss" scoped>
.cesium-container {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;

  #cesiumContainer {
    width: 100%;
    height: 100%;
  }
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  backdrop-filter: blur(2px);
}

.loading-content {
  background: white;
  border-radius: 12px;
  padding: 30px 40px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  min-width: 350px;
  max-width: 500px;
  text-align: center;

  h3 {
    margin: 20px 0 10px 0;
    font-size: 18px;
    color: #2c3e50;
    font-weight: bold;
  }

  .loading-message {
    margin: 10px 0 20px 0;
    font-size: 14px;
    color: #666;
  }

  .progress-bar-container {
    width: 100%;
    height: 8px;
    background: #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
    margin: 15px 0;

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #42b983, #35a372);
      border-radius: 4px;
      transition: width 0.3s ease;
      box-shadow: 0 2px 4px rgba(66, 185, 131, 0.3);
    }
  }

  .progress-text {
    margin: 10px 0 0 0;
    font-size: 12px;
    color: #999;
  }
}

.loading-spinner {
  width: 50px;
  height: 50px;
  margin: 0 auto;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #42b983;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.control-panel {
  position: absolute;
  top: 20px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  max-height: 90vh;
  overflow-y: auto;
  z-index: 1000;
  min-width: 280px;

  &.left-panel {
    left: 20px;
  }

  &.right-panel {
    right: 20px;
  }
}

.panel-header {
  margin-bottom: 20px;
  border-bottom: 2px solid #42b983;
  padding-bottom: 10px;

  h2 {
    margin: 0 0 5px 0;
    font-size: 20px;
    color: #2c3e50;
  }

  h3 {
    margin: 0;
    font-size: 16px;
    color: #2c3e50;
  }

  .subtitle {
    margin: 0;
    font-size: 14px;
    color: #666;
  }

  .close-btn {
    float: right;
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #999;
    padding: 0;
    width: 30px;
    height: 30px;
    line-height: 30px;

    &:hover {
      color: #333;
    }
  }
}

.panel-section {
  margin-bottom: 20px;

  h3 {
    margin: 0 0 10px 0;
    font-size: 14px;
    color: #2c3e50;
    font-weight: bold;
  }
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-primary, .btn-secondary {
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;

  &.btn-primary {
    background: #42b983;
    color: white;

    &:hover {
      background: #35a372;
    }
  }

  &.btn-secondary {
    background: #f0f0f0;
    color: #333;

    &:hover {
      background: #e0e0e0;
    }

    &.btn-active {
      background: #42b983;
      color: white;
    }
  }
}

.layer-control {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 14px;

  input[type="checkbox"] {
    margin-right: 8px;
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  span {
    &.risk-high {
      color: #e74c3c;
      font-weight: bold;
    }

    &.risk-medium {
      color: #f39c12;
      font-weight: bold;
    }

    &.risk-low {
      color: #f1c40f;
      font-weight: bold;
    }
  }
}

.slider {
  width: 100%;
  margin: 10px 0;
}

.slider-value {
  display: block;
  text-align: center;
  font-size: 12px;
  color: #666;
  margin-top: 5px;
}

.info-panel {
  position: absolute;
  top: 20px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  min-width: 300px;
  max-width: 400px;
  max-height: 90vh;
  overflow-y: auto;

  &.right-panel {
    right: 20px;
    left: auto;
  }
}

.info-content {
  .info-item {
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid #eee;

    label {
      display: block;
      font-weight: bold;
      color: #666;
      font-size: 12px;
      margin-bottom: 5px;
    }

    span {
      display: block;
      font-size: 14px;
      color: #2c3e50;

      &.risk-high {
        color: #e74c3c;
        font-weight: bold;
      }

      &.risk-medium {
        color: #f39c12;
        font-weight: bold;
      }

      &.risk-low {
        color: #f1c40f;
        font-weight: bold;
      }
    }
  }
}

.legend {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 1000;

  h4 {
    margin: 0 0 10px 0;
    font-size: 14px;
    color: #2c3e50;
  }

  .legend-item {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
    font-size: 12px;

    .legend-color {
      width: 20px;
      height: 20px;
      border-radius: 3px;
      margin-right: 8px;
      border: 1px solid #ccc;

      &.risk-high {
        background: #e74c3c;
      }

      &.risk-medium {
        background: #f39c12;
      }

      &.risk-low {
        background: #f1c40f;
      }

      &.water {
        background: #3498db;
      }
    }
  }
}

.measure-result {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 1001;

  .result-content {
    h4 {
      margin: 0 0 10px 0;
      font-size: 16px;
    }

    p {
      margin: 10px 0;
      font-size: 14px;
    }
  }
}

.btn-small {
  padding: 5px 10px;
  font-size: 12px;
  background: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
}

.time-control {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.time-display {
  font-size: 12px;
  color: #666;
}

.speed-control {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;

  select {
    padding: 5px;
    border-radius: 4px;
    border: 1px solid #ddd;
  }
}

.info-actions {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.btn-export {
  width: 100%;
  padding: 8px 15px;
  background: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.3s;

  &:hover {
    background: #35a372;
  }
}

.selected-count {
  padding: 8px;
  background: #e8f5e9;
  border-radius: 4px;
  margin-bottom: 10px;
  font-size: 12px;
  color: #2c3e50;
  text-align: center;
}

.risk-code {
  font-size: 11px;
  color: #999;
  font-weight: normal;
  margin-left: 5px;
}

// 移动端适配
@media (max-width: 768px) {
  .control-panel {
    min-width: 240px;
    padding: 15px;
    font-size: 12px;
  }

  .info-panel {
    min-width: 250px;
    max-width: 90%;
  }
}
</style>

