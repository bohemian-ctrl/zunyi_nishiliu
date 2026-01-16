/**
 * 风险数据加载工具
 */
import Cesium from '@/utils/cesiumLoader'

export class RiskDataLoader {
  constructor(viewer) {
    this.viewer = viewer
    this.dataSource = null
    this.entities = []
  }

  /**
   * 从GeoJSON文件加载风险区数据
   * @param {string|Object} geojson - GeoJSON数据或文件路径
   * @param {Function} onLoad - 加载完成回调
   * @param {Function} onProgress - 进度回调，参数为 { progress: 0-100, message: string, total: number, loaded: number }
   */
  async loadFromGeoJSON(geojson, onLoad, onProgress) {
    try {
      let data
      
      // 如果是字符串路径，则加载文件
      if (typeof geojson === 'string') {
        console.log('正在从文件加载:', geojson)
        if (onProgress) {
          onProgress({ progress: 10, message: '正在下载数据文件...', total: 0, loaded: 0 })
        }
        
        const response = await fetch(geojson)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        if (onProgress) {
          onProgress({ progress: 30, message: '正在解析数据...', total: 0, loaded: 0 })
        }
        
        data = await response.json()
        console.log('文件加载成功，特征数量:', data.features?.length || 0)
      } else {
        data = geojson
      }

      if (!data || !data.features || data.features.length === 0) {
        throw new Error('GeoJSON数据为空或格式不正确')
      }

      // 创建数据源
      this.dataSource = new Cesium.GeoJsonDataSource('riskZones')
      
      // 加载数据，设置贴地选项
      if (onProgress) {
        onProgress({ progress: 50, message: '正在加载到场景...', total: 0, loaded: 0 })
      }
      
      await this.dataSource.load(data, {
        clampToGround: true // 在加载时就设置贴地
      })
      this.viewer.dataSources.add(this.dataSource)
      
      console.log('数据源已添加到Viewer，实体数量:', this.dataSource.entities.values.length)

      // 处理实体样式 - 分批处理以避免阻塞UI
      const entities = this.dataSource.entities.values
      this.entities = [] // 清空之前的实体
      
      // 如果数据量很大，分批处理
      const batchSize = 50 // 减小批次大小，提高进度反馈频率
      const progressUpdateInterval = 10 // 每处理10个实体更新一次进度
      const totalEntities = entities.length
      console.log('开始处理', totalEntities, '个实体，分批大小:', batchSize)
      
      if (onProgress) {
        onProgress({ progress: 60, message: `正在处理 ${totalEntities} 个区域...`, total: totalEntities, loaded: 0 })
      }
      
      // 临时禁用渲染以提高性能
      const originalRequestRenderMode = this.viewer.scene.requestRenderMode
      const originalMaximumRenderTimeChange = this.viewer.scene.maximumRenderTimeChange
      this.viewer.scene.requestRenderMode = true
      this.viewer.scene.maximumRenderTimeChange = Infinity
      
      // 大数据量分批处理
      const processBatch = (startIndex) => {
        // 检查数据源是否还存在（防止组件销毁后继续处理）
        if (!this.dataSource || !this.viewer) {
          console.warn('数据源已销毁，停止处理')
          return
        }
        
        const endIndex = Math.min(startIndex + batchSize, totalEntities)
        let lastProgressUpdate = startIndex
        
        // 处理当前批次
        for (let i = startIndex; i < endIndex; i++) {
          const entity = entities[i]
          if (entity && entity.polygon) {
            this.styleRiskEntity(entity, data.features[i])
            this.entities.push(entity)
          }
          
          // 每处理一定数量的实体就更新一次进度，让用户看到实时进度
          if (onProgress && (i - lastProgressUpdate >= progressUpdateInterval || i === endIndex - 1)) {
            const progress = 60 + Math.floor((i + 1) / totalEntities * 35)
            // 直接调用，不使用 requestAnimationFrame，确保进度及时更新
            onProgress({ 
              progress: progress, 
              message: `正在处理区域 ${i + 1} / ${totalEntities}...`, 
              total: totalEntities, 
              loaded: i + 1 
            })
            lastProgressUpdate = i
          }
        }
        
        // 如果还有更多数据，继续处理下一批
        if (endIndex < totalEntities) {
          // 使用 setTimeout 给UI更多时间更新和渲染
          // 使用很短的延迟，确保进度更新能被 Vue 响应式系统捕获
          processBatch(endIndex)
        } else {
          // 处理完成，恢复渲染设置
          this.viewer.scene.requestRenderMode = originalRequestRenderMode
          this.viewer.scene.maximumRenderTimeChange = originalMaximumRenderTimeChange
          
          // 强制渲染一次
          this.viewer.scene.requestRender()
          
          console.log('已样式化的实体数量:', this.entities.length, '处理完成')
          if (onProgress) {
            onProgress({ progress: 100, message: '处理完成！', total: totalEntities, loaded: totalEntities })
          }
          if (onLoad && this.dataSource) {
            onLoad(this.entities)
          }
        }
      }
      
      // 开始处理第一批
      processBatch(0)

      return this.entities
    } catch (error) {
      console.error('加载风险区数据失败:', error)
      console.error('错误详情:', error.stack)
      throw error
    }
  }

  /**
   * 样式化风险实体
   */
  styleRiskEntity(entity, feature) {
    const props = feature.properties || {}
    // 优先使用 Risk 字段（1=高风险, 2=中风险, 3=低风险）
    // 如果没有 Risk 字段，则使用 riskLevel 或计算
    let riskLevel = 'low'
    
    // 处理 Risk 字段，确保转换为数字进行比较
    if (props.Risk !== undefined && props.Risk !== null) {
      // 将 Risk 转换为数字（可能是字符串 "1", "2", "3"）
      const riskValue = Number(props.Risk)
      
      // Risk: 1=高风险, 2=中风险, 3=低风险
      if (riskValue === 1) {
        riskLevel = 'high'
      } else if (riskValue === 2) {
        riskLevel = 'medium'
      } else if (riskValue === 3) {
        riskLevel = 'low'
      } else {
        // 如果 Risk 值不在预期范围内，使用默认值
        console.warn('未知的 Risk 值:', props.Risk, '使用默认值 low')
        riskLevel = 'low'
      }
    } else if (props.riskLevel) {
      // 如果已经有 riskLevel 字段，直接使用
      riskLevel = props.riskLevel.toLowerCase() // 确保小写
    } else {
      // 否则根据其他属性计算风险等级
      riskLevel = this.calculateRiskLevel(props)
    }
    
    // 调试日志：输出前几个实体的风险等级（避免日志过多）
    if (this.entities.length < 5) {
      console.log('实体风险等级判断:', {
        Risk: props.Risk,
        riskLevel: riskLevel,
        props: props
      })
    }

    // 设置多边形样式 - 确保实体可见并贴地
    entity.polygon.material = this.getRiskColor(riskLevel, 0.6)
    entity.polygon.height = 0
    entity.polygon.extrudedHeight = undefined // 不设置高度，确保贴地
    entity.polygon.outline = true
    entity.polygon.outlineColor = Cesium.Color.WHITE.withAlpha(0.8)
    entity.polygon.outlineWidth = 2
    entity.polygon.clampToGround = true // 确保贴地显示
    // 设置分类类型，确保多边形贴到地形上
    entity.polygon.classificationType = Cesium.ClassificationType.TERRAIN
    entity.show = true // 确保实体可见

    // 保存属性 - 确保属性可以被正确访问
    // Cesium 的 entity.properties 可能是 PropertyBag，我们需要确保属性可访问
    if (!entity.properties) {
      entity.properties = {}
    }
    
    // 如果 properties 是 PropertyBag，使用 setValue
    if (entity.properties.setValue && typeof entity.properties.setValue === 'function') {
      const currentProps = entity.properties.getValue ? entity.properties.getValue() : {}
      entity.properties.setValue({
        ...currentProps,
        riskLevel: riskLevel,
        risk: props.Risk || 0,
        slope: props.slope || 0,
        ndvi: props.ndvi || 0,
        precipitation: props.precipitation || 0,
        township: props.township || props.乡镇 || '',
        area: props.area || this.calculateArea(feature.geometry),
        count: props.count || 0
      })
    } else {
      // 普通对象，直接赋值
      entity.properties = {
        ...entity.properties,
        riskLevel: riskLevel,
        risk: props.Risk || 0, // 保存原始 Risk 值
        slope: props.slope || 0,
        ndvi: props.ndvi || 0,
        precipitation: props.precipitation || 0,
        township: props.township || props.乡镇 || '',
        area: props.area || this.calculateArea(feature.geometry),
        count: props.count || 0 // 保存 count 字段
      }
    }
    
    // 同时在实体上保存一个直接访问的属性（用于快速访问）
    entity._riskLevel = riskLevel
    entity._riskData = {
      riskLevel: riskLevel,
      risk: props.Risk || 0,
      slope: props.slope || 0,
      ndvi: props.ndvi || 0,
      precipitation: props.precipitation || 0,
      township: props.township || props.乡镇 || '',
      area: props.area || this.calculateArea(feature.geometry),
      count: props.count || 0
    }

    // 添加3D标注（高风险区）- 限制数量以避免性能问题
    // 只对前50个高风险区添加标注，避免标注过多导致性能问题
    // if (riskLevel === 'high' && this.entities.length < 50) {
    //   this.addWarningLabel(entity, props)
    // }
  }

  /**
   * 计算风险等级
   */
  calculateRiskLevel(props) {
    const slope = props.slope || 0
    const ndvi = props.ndvi || 0
    const precipitation = props.precipitation || 0

    // 高风险：坡度 > 30°、NDVI < 0.2、降水 > 800mm
    if (slope > 30 && ndvi < 0.2 && precipitation > 800) {
      return 'high'
    }
    // 中风险：坡度 > 20° 或 NDVI < 0.3 或 降水 > 600mm
    else if (slope > 20 || ndvi < 0.3 || precipitation > 600) {
      return 'medium'
    }
    // 低风险
    else {
      return 'low'
    }
  }

  /**
   * 获取风险颜色
   */
  getRiskColor(riskLevel, opacity = 0.6) {
    // 确保 opacity 是数字类型
    const numOpacity = typeof opacity === 'string' ? parseFloat(opacity) : Number(opacity)
    
    // 验证并限制范围
    if (isNaN(numOpacity)) {
      console.warn('无效的透明度值:', opacity, '使用默认值 0.6')
      return this.getRiskColor(riskLevel, 0.6)
    }
    
    const clampedOpacity = Math.max(0, Math.min(1, numOpacity))
    
    // 确保 riskLevel 是小写字符串，统一处理
    const normalizedLevel = String(riskLevel).toLowerCase().trim()
    
    const colors = {
      high: Cesium.Color.RED.withAlpha(clampedOpacity),
      medium: Cesium.Color.ORANGE.withAlpha(clampedOpacity),
      low: Cesium.Color.YELLOW.withAlpha(clampedOpacity)
    }
    
    // 检查颜色是否存在
    const color = colors[normalizedLevel]
    if (!color) {
      console.warn('未知的风险等级:', riskLevel, '原始值:', riskLevel, '标准化后:', normalizedLevel, '使用默认颜色 (low/yellow)')
      return colors.low
    }
    
    return color
  }

  /**
   * 添加预警标注
   */
  addWarningLabel(entity, props) {
    const position = this.getEntityCenter(entity)
    if (!position) return

    const label = this.viewer.entities.add({
      position: position,
      billboard: {
        image: this.createWarningIcon('high'),
        scale: 1.0,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM
      },
      label: {
        text: '高风险区',
        font: '12px sans-serif',
        fillColor: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -30)
      }
    })

    entity.warningLabel = label
  }

  /**
   * 创建预警图标（使用Canvas）
   */
  createWarningIcon(level) {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')

    const colors = {
      high: '#e74c3c',
      medium: '#f39c12',
      low: '#f1c40f'
    }

    // 绘制圆形
    ctx.fillStyle = colors[level] || colors.high
    ctx.beginPath()
    ctx.arc(16, 16, 14, 0, Math.PI * 2)
    ctx.fill()

    // 绘制感叹号
    ctx.fillStyle = 'white'
    ctx.font = 'bold 20px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('!', 16, 16)

    return canvas.toDataURL()
  }

  /**
   * 获取实体中心点
   */
  getEntityCenter(entity) {
    if (entity.polygon && entity.polygon.hierarchy) {
      const hierarchy = entity.polygon.hierarchy.getValue()
      if (hierarchy.positions && hierarchy.positions.length > 0) {
        const positions = hierarchy.positions
        let sumX = 0, sumY = 0, sumZ = 0
        positions.forEach(pos => {
          sumX += pos.x
          sumY += pos.y
          sumZ += pos.z
        })
        return new Cesium.Cartesian3(
          sumX / positions.length,
          sumY / positions.length,
          sumZ / positions.length
        )
      }
    }
    return null
  }

  /**
   * 计算面积（简化版）
   */
  calculateArea(geometry) {
    // 这里应该使用更精确的面积计算方法
    // 简化处理，返回0
    return 0
  }

  /**
   * 更新透明度
   * @param {number} opacity - 透明度值 (0-1)
   * @param {Function} onProgress - 进度回调，参数为 { progress: 0-100, message: string }
   */
  updateOpacity(opacity, onProgress) {
    // 确保 opacity 是数字类型
    const numOpacity = typeof opacity === 'string' ? parseFloat(opacity) : Number(opacity)
    
    // 验证值是否有效
    if (isNaN(numOpacity) || numOpacity < 0 || numOpacity > 1) {
      console.warn('无效的透明度值:', opacity)
      return
    }
    
    // 确保值在 0-1 范围内
    const clampedOpacity = Math.max(0, Math.min(1, numOpacity))
    
    console.log('更新透明度:', clampedOpacity, '类型:', typeof clampedOpacity, '实体数量:', this.entities.length)
    
    const totalEntities = this.entities.length
    const updateInterval = Math.max(1, Math.floor(totalEntities / 100)) // 每1%更新一次进度
    
    this.entities.forEach((entity, index) => {
      if (!entity || !entity.polygon) {
        return
      }
      
      // 优先使用快速访问属性获取风险等级
      let riskLevel = entity._riskLevel
      
      // 如果没有，尝试从 _riskData 获取
      if (!riskLevel && entity._riskData) {
        riskLevel = entity._riskData.riskLevel
      }
      
      // 如果还没有，尝试从 properties 获取
      if (!riskLevel && entity.properties) {
        if (entity.properties.getValue && typeof entity.properties.getValue === 'function') {
          try {
            const props = entity.properties.getValue()
            riskLevel = props?.riskLevel
            if (!riskLevel && props?.Risk !== undefined) {
              riskLevel = props.Risk === 1 ? 'high' : (props.Risk === 2 ? 'medium' : 'low')
            }
          } catch (e) {
            // 忽略错误
          }
        } else {
          riskLevel = entity.properties.riskLevel
          if (!riskLevel && entity.properties.Risk !== undefined) {
            riskLevel = entity.properties.Risk === 1 ? 'high' : (entity.properties.Risk === 2 ? 'medium' : 'low')
          }
        }
      }
      
      // 默认值
      if (!riskLevel) {
        riskLevel = 'low'
      }
      
      // 更新材质
      try {
        const newColor = this.getRiskColor(riskLevel, clampedOpacity)
        entity.polygon.material = newColor
      } catch (e) {
        console.warn(`更新实体 ${index} 透明度失败:`, e)
      }
      
      // 更新进度（每处理一定数量的实体更新一次）
      if (onProgress && (index % updateInterval === 0 || index === totalEntities - 1)) {
        const progress = Math.floor((index + 1) / totalEntities * 100)
        onProgress({
          progress: progress,
          message: `正在更新 ${index + 1} / ${totalEntities} 个区域...`
        })
      }
    })
    
    // 批量更新完成后，统一触发一次渲染（避免每个实体都触发渲染）
    if (this.viewer && this.viewer.scene) {
      this.viewer.scene.requestRender()
    }
    
    // 通知完成
    if (onProgress) {
      onProgress({
        progress: 100,
        message: '更新完成！'
      })
    }
    
    console.log('透明度更新完成')
  }

  /**
   * 更新风险等级显示
   */
  updateRiskLevels(levels) {
    this.entities.forEach(entity => {
      if (!entity) {
        return
      }
      
      // 优先使用快速访问属性获取风险等级（最可靠）
      let riskLevel = entity._riskLevel
      
      // 如果没有，尝试从 _riskData 获取
      if (!riskLevel && entity._riskData) {
        riskLevel = entity._riskData.riskLevel
      }
      
      // 如果还没有，尝试从 properties 获取（处理 PropertyBag）
      if (!riskLevel && entity.properties) {
        if (entity.properties.getValue && typeof entity.properties.getValue === 'function') {
          // 如果是 PropertyBag，使用 getValue
          try {
            const props = entity.properties.getValue()
            riskLevel = props?.riskLevel
            // 如果没有 riskLevel，尝试从 Risk 计算
            if (!riskLevel && props?.Risk !== undefined) {
              const riskValue = Number(props.Risk)
              riskLevel = riskValue === 1 ? 'high' : (riskValue === 2 ? 'medium' : 'low')
            }
          } catch (e) {
            console.warn('获取实体属性失败:', e)
          }
        } else {
          // 普通对象，直接访问
          riskLevel = entity.properties.riskLevel
          if (!riskLevel && entity.properties.Risk !== undefined) {
            const riskValue = Number(entity.properties.Risk)
            riskLevel = riskValue === 1 ? 'high' : (riskValue === 2 ? 'medium' : 'low')
          }
        }
      }
      
      // 默认值
      if (!riskLevel) {
        riskLevel = 'low'
      }
      
      const shouldShow = 
        (riskLevel === 'high' && levels.high) ||
        (riskLevel === 'medium' && levels.medium) ||
        (riskLevel === 'low' && levels.low)
      
      // 只有在数据源显示时才控制单个实体
      if (this.dataSource && this.dataSource.show !== false) {
        entity.show = shouldShow
        if (entity.warningLabel) {
          entity.warningLabel.show = shouldShow && riskLevel === 'high'
        }
      }
    })
  }
  
  /**
   * 设置数据源显示/隐藏
   */
  setVisible(visible) {
    if (this.dataSource) {
      this.dataSource.show = visible
    }
    this.entities.forEach(entity => {
      if (!entity) {
        return
      }
      
      entity.show = visible
      if (entity.warningLabel) {
        // 获取风险等级
        const riskLevel = entity._riskLevel || (entity._riskData && entity._riskData.riskLevel) || 'low'
        entity.warningLabel.show = visible && riskLevel === 'high'
      }
    })
  }

  /**
   * 导出选中区域属性
   */
  exportToCSV(entities) {
    if (!entities || entities.length === 0) {
      return null
    }

    const headers = ['风险等级', '坡度(°)', 'NDVI', '年降水量(mm)', '所属乡镇', '面积(km²)']
    const rows = entities.map(entity => {
      // 优先使用快速访问属性
      let riskLevel = entity._riskLevel
      let slope = 0
      let ndvi = 0
      let precipitation = 0
      let township = ''
      let area = 0
      
      if (entity._riskData) {
        riskLevel = riskLevel || entity._riskData.riskLevel
        slope = entity._riskData.slope || 0
        ndvi = entity._riskData.ndvi || 0
        precipitation = entity._riskData.precipitation || 0
        township = entity._riskData.township || ''
        area = entity._riskData.area || 0
      }
      
      // 如果还没有，尝试从 properties 获取
      if (!riskLevel && entity.properties) {
        let props = {}
        if (entity.properties.getValue && typeof entity.properties.getValue === 'function') {
          try {
            props = entity.properties.getValue() || {}
          } catch (e) {
            // 忽略错误
          }
        } else {
          props = entity.properties || {}
        }
        
        riskLevel = riskLevel || props.riskLevel
        if (!riskLevel && props.Risk !== undefined) {
          const riskValue = Number(props.Risk)
          riskLevel = riskValue === 1 ? 'high' : (riskValue === 2 ? 'medium' : 'low')
        }
        slope = slope || props.slope || 0
        ndvi = ndvi || props.ndvi || 0
        precipitation = precipitation || props.precipitation || 0
        township = township || props.township || ''
        area = area || props.area || 0
      }
      
      return [
        riskLevel || 'low',
        slope,
        ndvi,
        precipitation,
        township,
        area
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    // 创建下载链接
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `风险区数据_${new Date().getTime()}.csv`
    link.click()
    URL.revokeObjectURL(url)

    return csvContent
  }

  /**
   * 清除所有数据
   */
  clear() {
    // 清理标注
    this.entities.forEach(entity => {
      if (entity.warningLabel) {
        try {
          this.viewer.entities.remove(entity.warningLabel)
        } catch (e) {
          console.warn('清理标注失败:', e)
        }
        entity.warningLabel = null
      }
    })
    
    // 清理数据源
    if (this.dataSource) {
      try {
        this.viewer.dataSources.remove(this.dataSource)
      } catch (e) {
        console.warn('清理数据源失败:', e)
      }
      this.dataSource = null
    }
    
    // 清空实体数组
    this.entities = []
  }
}

