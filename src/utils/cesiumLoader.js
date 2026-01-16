/**
 * Cesium 统一导入文件
 * 避免多个文件重复导入 Cesium，减少打包体积
 */
import * as Cesium from 'cesium'

// 导出 Cesium 实例，供其他模块使用
export default Cesium

// 也可以导出常用的类，方便使用
export const {
  Viewer,
  Cartesian3,
  Color,
  GeoJsonDataSource,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Math: CesiumMath,
  HeadingPitchRange,
  BoundingSphere,
  EllipsoidTerrainProvider,
  UrlTemplateImageryProvider,
  createWorldTerrain,
  createOsmBuildings
} = Cesium

