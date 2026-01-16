# 遵义市泥石流风险可视化系统

基于 Cesium 的 3D 地理可视化系统，用于展示和分析遵义市泥石流风险区域。

## 功能特性

### 一、核心可视化效果

1. **遵义市高精度 3D 地形基底**
   - 支持加载本地 DEM 数据，还原真实地形起伏
   - 叠加卫星影像底图
   - 支持地形高度拉伸、光照角度调整
   - 可叠加 Cesium OSM Buildings 实现城市建筑与山区地形的融合显示

2. **泥石流高风险区分级渲染**
   - 高风险区（红色）：坡度 > 30°、NDVI < 0.2、降水 > 800mm
   - 中风险区（橙色）：坡度 > 20° 或 NDVI < 0.3 或 降水 > 600mm
   - 低风险区（黄色）：其他区域
   - 支持透明度调节和边缘高亮

3. **多源数据叠加对比**
   - 坡度栅格图层
   - NDVI 植被覆盖度图层
   - 年降水量分布图层
   - 支持图层切换和对比

### 二、核心交互方式

1. **场景漫游与视角控制**
   - 鼠标拖拽旋转、滚轮缩放、双击聚焦
   - 预设视角：全市概览、高风险区聚焦、典型泥石流沟谷

2. **风险区属性查询**
   - 点击风险区显示详细信息（坡度、NDVI、降水量、所属乡镇、风险等级）
   - 支持多选和批量导出 CSV

3. **图层管理与交互控制**
   - 图层开关、透明度调节
   - 风险等级筛选显示

4. **测量工具**
   - 距离测量
   - 面积测量
   - 剖面分析

5. **时间维度动态更新（扩展功能）**
   - 时间轴播放控制
   - 动态展示风险区变化

### 三、进阶交互效果

1. **三维标注与预警提示**
   - 高风险区自动添加预警标注
   - 点击查看详细预警信息

2. **移动端适配**
   - 支持触屏操作
   - 响应式布局

## 安装和运行

### 前置要求

- Node.js >= 12.x
- yarn 或 npm

### 安装依赖

```bash
yarn install
# 或
npm install
```

### 配置 Cesium Ion Token（可选）

如果需要使用 Cesium Ion 的高级功能（如 OSM Buildings），需要：

1. 访问 https://cesium.com/ion/
2. 注册账号并获取 Access Token
3. 在 `src/components/CesiumViewer.vue` 中替换 token：

```javascript
Cesium.Ion.defaultAccessToken = 'your-token-here'
```

### 运行开发服务器

```bash
yarn serve
# 或
npm run serve
```

访问 http://localhost:8080

### 构建生产版本

```bash
yarn build
# 或
npm run build
```

## 数据准备

### 1. 风险区 GeoJSON 数据

将 GEE 导出的风险区数据保存为 GeoJSON 格式，放置在 `public/data/` 目录下。

GeoJSON 格式要求：
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[...]]
      },
      "properties": {
        "riskLevel": "high|medium|low",
        "slope": 35,
        "ndvi": 0.15,
        "precipitation": 950,
        "township": "汇川区",
        "area": 12.5
      }
    }
  ]
}
```

### 2. DEM 地形数据

如果有本地 DEM 数据，需要转换为 Cesium Terrain 格式，或使用在线地形服务。

### 3. 栅格图层数据

坡度、NDVI、降水量图层需要转换为瓦片服务（TMS/WMS），或使用在线服务。

## 使用说明

### 加载风险区数据

在 `src/components/CesiumViewer.vue` 的 `loadRiskZones()` 方法中：

```javascript
// 从文件加载
await this.riskDataLoader.loadFromGeoJSON('/data/risk-zones.geojson')

// 或直接使用数据对象
await this.riskDataLoader.loadFromGeoJSON(geojsonData)
```

### 测量工具使用

1. **距离测量**：点击"测距"按钮，在地图上点击多个点，右键完成测量
2. **面积测量**：点击"测面积"按钮，在地图上点击多个点形成多边形，右键完成测量
3. **剖面分析**：点击"剖面分析"按钮，在地图上点击起点和终点，自动生成剖面

### 导出数据

选中风险区后，点击信息面板中的"导出选中数据(CSV)"按钮，即可下载 CSV 文件。

## 项目结构

```
src/
├── components/
│   └── CesiumViewer.vue    # 主组件
├── utils/
│   ├── cesiumMeasure.js    # 测量工具类
│   └── riskDataLoader.js   # 风险数据加载工具
├── views/
│   └── HomeView.vue        # 主页面
└── ...
```

## 技术栈

- Vue 2.x
- Cesium
- Vue Router
- Vuex

## 注意事项

1. **Cesium Ion Token**：某些功能需要有效的 Cesium Ion Token，否则可能无法使用 OSM Buildings 等功能
2. **数据格式**：确保 GeoJSON 数据格式正确，包含必要的属性字段
3. **性能优化**：大量数据时建议使用数据分片或 LOD（细节层次）优化
4. **浏览器兼容性**：建议使用现代浏览器（Chrome、Firefox、Edge）

## 扩展开发

### 添加新的图层

在 `CesiumViewer.vue` 中添加图层控制：

```javascript
layers: {
  // ... 现有图层
  newLayer: false
}
```

实现加载方法：

```javascript
loadNewLayer() {
  if (this.layers.newLayer) {
    // 加载图层逻辑
  }
}
```

### 自定义风险等级计算

在 `riskDataLoader.js` 的 `calculateRiskLevel()` 方法中修改计算逻辑。

### 添加新的测量工具

在 `cesiumMeasure.js` 中添加新的测量方法，并在 `CesiumViewer.vue` 中调用。

## 许可证

MIT License

## 联系方式

如有问题或建议，请联系开发团队。

