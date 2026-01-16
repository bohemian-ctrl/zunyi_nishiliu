/**
 * Cesium测量工具类
 */
import Cesium from '@/utils/cesiumLoader'

export class CesiumMeasure {
  constructor(viewer) {
    this.viewer = viewer
    this.activeEntity = null
    this.measureEntities = []
    this.handler = null
    this.positions = []
    this.type = null // 'distance', 'area', 'profile'
  }

  /**
   * 开始距离测量
   */
  startDistanceMeasure() {
    this.clear()
    this.type = 'distance'
    this.setupHandler()
    
    this.handler.setInputAction((click) => {
      const position = this.viewer.camera.pickEllipsoid(click.position, this.viewer.scene.globe.ellipsoid)
      if (position) {
        this.positions.push(position)
        this.updateDistanceMeasure()
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    this.handler.setInputAction((movement) => {
      if (this.positions.length > 0) {
        const position = this.viewer.camera.pickEllipsoid(movement.endPosition, this.viewer.scene.globe.ellipsoid)
        if (position) {
          this.updateDistancePreview(position)
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    this.handler.setInputAction(() => {
      this.finishMeasure()
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
  }

  /**
   * 开始面积测量
   */
  startAreaMeasure() {
    this.clear()
    this.type = 'area'
    this.setupHandler()
    
    this.handler.setInputAction((click) => {
      const position = this.viewer.camera.pickEllipsoid(click.position, this.viewer.scene.globe.ellipsoid)
      if (position) {
        this.positions.push(position)
        this.updateAreaMeasure()
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    this.handler.setInputAction((movement) => {
      if (this.positions.length > 0) {
        const position = this.viewer.camera.pickEllipsoid(movement.endPosition, this.viewer.scene.globe.ellipsoid)
        if (position) {
          this.updateAreaPreview(position)
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    this.handler.setInputAction(() => {
      this.finishMeasure()
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
  }

  /**
   * 开始剖面分析
   */
  startProfileMeasure() {
    this.clear()
    this.type = 'profile'
    this.setupHandler()
    
    this.handler.setInputAction((click) => {
      const position = this.viewer.camera.pickEllipsoid(click.position, this.viewer.scene.globe.ellipsoid)
      if (position) {
        this.positions.push(position)
        if (this.positions.length === 1) {
          this.createProfileLine()
        } else if (this.positions.length === 2) {
          this.generateProfile()
          this.finishMeasure()
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  }

  setupHandler() {
    if (this.handler) {
      this.handler.destroy()
    }
    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas)
  }

  updateDistanceMeasure() {
    if (this.positions.length < 2) return

    // 移除旧的线
    if (this.activeEntity) {
      this.viewer.entities.remove(this.activeEntity)
    }

    // 创建新的线
    this.activeEntity = this.viewer.entities.add({
      polyline: {
        positions: this.positions,
        width: 3,
        material: Cesium.Color.YELLOW,
        clampToGround: true
      }
    })

    // 计算距离
    let totalDistance = 0
    for (let i = 0; i < this.positions.length - 1; i++) {
      const distance = Cesium.Cartesian3.distance(this.positions[i], this.positions[i + 1])
      totalDistance += distance
    }

    // 添加标签显示距离
    const lastPosition = this.positions[this.positions.length - 1]
    const cartographic = Cesium.Cartographic.fromCartesian(lastPosition)
    const label = this.viewer.entities.add({
      position: lastPosition,
      label: {
        text: `${(totalDistance / 1000).toFixed(2)} km`,
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -20)
      }
    })
    this.measureEntities.push(label)
  }

  updateDistancePreview(position) {
    if (this.positions.length === 0) return

    // 移除预览线
    const previewEntity = this.viewer.entities.getById('measure-preview')
    if (previewEntity) {
      this.viewer.entities.remove(previewEntity)
    }

    // 创建预览线
    this.viewer.entities.add({
      id: 'measure-preview',
      polyline: {
        positions: [this.positions[this.positions.length - 1], position],
        width: 2,
        material: Cesium.Color.YELLOW.withAlpha(0.5),
        clampToGround: true
      }
    })
  }

  updateAreaMeasure() {
    if (this.positions.length < 3) return

    // 移除旧的多边形
    if (this.activeEntity) {
      this.viewer.entities.remove(this.activeEntity)
    }

    // 闭合多边形
    const closedPositions = [...this.positions, this.positions[0]]

    // 创建多边形
    this.activeEntity = this.viewer.entities.add({
      polygon: {
        hierarchy: closedPositions,
        material: Cesium.Color.BLUE.withAlpha(0.3),
        outline: true,
        outlineColor: Cesium.Color.BLUE,
        outlineWidth: 2
      }
    })

    // 计算面积
    const area = this.calculateArea(closedPositions)

    // 添加标签显示面积
    const center = this.calculateCenter(closedPositions)
    const label = this.viewer.entities.getById('area-label')
    if (label) {
      this.viewer.entities.remove(label)
    }
    this.viewer.entities.add({
      id: 'area-label',
      position: center,
      label: {
        text: `${(area / 1000000).toFixed(2)} km²`,
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE
      }
    })
  }

  updateAreaPreview(position) {
    if (this.positions.length === 0) return

    // 移除预览多边形
    const previewEntity = this.viewer.entities.getById('area-preview')
    if (previewEntity) {
      this.viewer.entities.remove(previewEntity)
    }

    // 创建预览多边形
    const previewPositions = [...this.positions, position, this.positions[0]]
    this.viewer.entities.add({
      id: 'area-preview',
      polygon: {
        hierarchy: previewPositions,
        material: Cesium.Color.BLUE.withAlpha(0.2),
        outline: true,
        outlineColor: Cesium.Color.BLUE.withAlpha(0.5),
        outlineWidth: 2
      }
    })
  }

  createProfileLine() {
    if (this.positions.length === 0) return

    this.activeEntity = this.viewer.entities.add({
      polyline: {
        positions: this.positions,
        width: 3,
        material: Cesium.Color.CYAN,
        clampToGround: true
      }
    })
  }

  generateProfile() {
    if (this.positions.length < 2) return

    // 生成剖面数据
    const start = this.positions[0]
    const end = this.positions[1]
    const samples = 100
    const profileData = []

    for (let i = 0; i <= samples; i++) {
      const ratio = i / samples
      const position = Cesium.Cartesian3.lerp(start, end, ratio, new Cesium.Cartesian3())
      const cartographic = Cesium.Cartographic.fromCartesian(position)
      
      // 获取地形高度
      const height = this.viewer.scene.globe.getHeight(cartographic) || 0
      
      profileData.push({
        distance: ratio * Cesium.Cartesian3.distance(start, end),
        height: height,
        position: position
      })
    }

    // 触发剖面数据事件
    if (this.onProfileGenerated) {
      this.onProfileGenerated(profileData)
    }

    return profileData
  }

  calculateArea(positions) {
    if (positions.length < 3) return 0

    let area = 0
    for (let i = 0; i < positions.length - 1; i++) {
      const p1 = Cesium.Cartographic.fromCartesian(positions[i])
      const p2 = Cesium.Cartographic.fromCartesian(positions[i + 1])
      
      area += (p2.longitude - p1.longitude) * (p2.latitude + p1.latitude)
    }

    // 转换为平方米
    const earthRadius = 6378137
    area = Math.abs(area) * earthRadius * earthRadius / 2
    return area
  }

  calculateCenter(positions) {
    let sumX = 0, sumY = 0, sumZ = 0
    
    for (let i = 0; i < positions.length - 1; i++) {
      sumX += positions[i].x
      sumY += positions[i].y
      sumZ += positions[i].z
    }

    const count = positions.length - 1
    return new Cesium.Cartesian3(sumX / count, sumY / count, sumZ / count)
  }

  finishMeasure() {
    if (this.handler) {
      this.handler.destroy()
      this.handler = null
    }

    // 移除预览实体
    const previewEntity = this.viewer.entities.getById('measure-preview')
    if (previewEntity) {
      this.viewer.entities.remove(previewEntity)
    }
    const areaPreview = this.viewer.entities.getById('area-preview')
    if (areaPreview) {
      this.viewer.entities.remove(areaPreview)
    }

    // 返回测量结果
    let result = null
    if (this.type === 'distance' && this.positions.length >= 2) {
      let totalDistance = 0
      for (let i = 0; i < this.positions.length - 1; i++) {
        totalDistance += Cesium.Cartesian3.distance(this.positions[i], this.positions[i + 1])
      }
      result = {
        type: 'distance',
        value: (totalDistance / 1000).toFixed(2),
        unit: 'km'
      }
    } else if (this.type === 'area' && this.positions.length >= 3) {
      const closedPositions = [...this.positions, this.positions[0]]
      const area = this.calculateArea(closedPositions)
      result = {
        type: 'area',
        value: (area / 1000000).toFixed(2),
        unit: 'km²'
      }
    }

    return result
  }

  clear() {
    if (this.handler) {
      this.handler.destroy()
      this.handler = null
    }

    // 移除所有测量实体
    if (this.activeEntity) {
      this.viewer.entities.remove(this.activeEntity)
      this.activeEntity = null
    }

    this.measureEntities.forEach(entity => {
      this.viewer.entities.remove(entity)
    })
    this.measureEntities = []

    // 移除预览实体
    const previewEntity = this.viewer.entities.getById('measure-preview')
    if (previewEntity) {
      this.viewer.entities.remove(previewEntity)
    }
    const areaPreview = this.viewer.entities.getById('area-preview')
    if (areaPreview) {
      this.viewer.entities.remove(areaPreview)
    }
    const areaLabel = this.viewer.entities.getById('area-label')
    if (areaLabel) {
      this.viewer.entities.remove(areaLabel)
    }

    this.positions = []
    this.type = null
  }
}

