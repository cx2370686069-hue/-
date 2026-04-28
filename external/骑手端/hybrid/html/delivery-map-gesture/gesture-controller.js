(function (global) {
  var PAN_SENSITIVITY = 5.0

  function pushDebugState(patch) {
    if (!global.__merchantGestureDebugState) {
      global.__merchantGestureDebugState = {
        gestureLoaded: false,
        touchstartCount: 0,
        touchmoveCount: 0,
        lastDx: 0,
        lastDy: 0,
        setCenterCalled: false,
        centerChanged: false
      }
    }
    if (patch && typeof patch === 'object') {
      for (var key in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
          global.__merchantGestureDebugState[key] = patch[key]
        }
      }
    }
    if (typeof global.updateMerchantGestureDebugPanel === 'function') {
      try {
        global.updateMerchantGestureDebugPanel(global.__merchantGestureDebugState)
      } catch (e) {}
    }
  }

  try {
    var loadedScript = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : ''
    pushDebugState({ gestureLoaded: true })
    console.log('[merchant-new-gesture-v1] loaded', loadedScript || 'inline-or-unknown')
  } catch (e) {}

  function readAxis(point, axis) {
    if (!point) return null
    var getter = axis === 'x' ? 'getX' : 'getY'
    if (typeof point[getter] === 'function') {
      return Number(point[getter]())
    }
    return point[axis] !== undefined ? Number(point[axis]) : null
  }

  function createPoint(x, y) {
    if (global.T && typeof global.T.Point === 'function') {
      return new global.T.Point(x, y)
    }
    return { x: x, y: y }
  }

  function getTouchById(touches, id) {
    if (!touches || id === null || id === undefined) return null
    for (var i = 0; i < touches.length; i++) {
      if (touches[i] && touches[i].identifier === id) {
        return touches[i]
      }
    }
    return null
  }

  function getTouchDistance(a, b) {
    var dx = b.clientX - a.clientX
    var dy = b.clientY - a.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  function readCenter(map) {
    if (!map || typeof map.getCenter !== 'function') return null
    var center = map.getCenter()
    if (!center) return null
    var lng = typeof center.getLng === 'function' ? Number(center.getLng()) : Number(center.lng)
    var lat = typeof center.getLat === 'function' ? Number(center.getLat()) : Number(center.lat)
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
    return { lng: lng, lat: lat }
  }

  function readZoom(map) {
    if (!map || typeof map.getZoom !== 'function') return null
    var zoom = Number(map.getZoom())
    return Number.isFinite(zoom) ? zoom : null
  }

  function clampZoom(map, zoom) {
    if (!Number.isFinite(zoom)) return null
    var next = zoom
    if (typeof map.getMinZoom === 'function') {
      var minZoom = Number(map.getMinZoom())
      if (Number.isFinite(minZoom)) {
        next = Math.max(minZoom, next)
      }
    }
    if (typeof map.getMaxZoom === 'function') {
      var maxZoom = Number(map.getMaxZoom())
      if (Number.isFinite(maxZoom)) {
        next = Math.min(maxZoom, next)
      }
    }
    return next
  }

  function getViewportSize(map, fallbackElement) {
    var size = map && typeof map.getSize === 'function' ? map.getSize() : null
    var width = readAxis(size, 'x')
    var height = readAxis(size, 'y')
    if (Number.isFinite(width) && Number.isFinite(height)) {
      return { width: width, height: height }
    }
    if (!fallbackElement) return null
    width = fallbackElement.clientWidth
    height = fallbackElement.clientHeight
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null
    return { width: width, height: height }
  }

  function toMapDelta(dx, dy, rotation) {
    var angle = -(Number(rotation) || 0) * Math.PI / 180
    return {
      x: dx * Math.cos(angle) - dy * Math.sin(angle),
      y: dx * Math.sin(angle) + dy * Math.cos(angle)
    }
  }

  function updateCenterByDelta(map, container, rotation, dx, dy) {
    var hasMap = !!map
    var localDelta = hasMap ? toMapDelta(dx, dy, rotation) : { x: 0, y: 0 }
    var viewport = hasMap ? getViewportSize(map, container) : null
    var setCenterType = hasMap ? typeof map.setCenter : 'undefined'
    var panToType = hasMap ? typeof map.panTo : 'undefined'
    var centerAndZoomType = hasMap ? typeof map.centerAndZoom : 'undefined'
    var getZoomType = hasMap ? typeof map.getZoom : 'undefined'
    pushDebugState({
      mapExists: hasMap,
      viewportWidth: viewport && Number.isFinite(viewport.width) ? viewport.width : 0,
      viewportHeight: viewport && Number.isFinite(viewport.height) ? viewport.height : 0,
      localDeltaX: Number.isFinite(localDelta.x) ? localDelta.x : 0,
      localDeltaY: Number.isFinite(localDelta.y) ? localDelta.y : 0,
      nextCenterExists: false,
      setCenterType: setCenterType,
      panToType: panToType,
      centerAndZoomType: centerAndZoomType,
      getZoomType: getZoomType,
      panMethodUsed: 'none',
      setCenterCalled: false,
      centerChanged: false
    })
    if (!map || (!dx && !dy)) return null
    var beforeCenter = readCenter(map)
    if (viewport && typeof map.containerPointToLngLat === 'function') {
      try {
        var nextCenter = map.containerPointToLngLat(createPoint(
          Math.round(viewport.width / 2 - localDelta.x),
          Math.round(viewport.height / 2 - localDelta.y)
        ))
        pushDebugState({
          nextCenterExists: !!nextCenter
        })
        if (nextCenter && typeof map.setCenter === 'function') {
          pushDebugState({ setCenterCalled: true, panMethodUsed: 'setCenter' })
          map.setCenter(nextCenter)
          var afterProjectedCenter = readCenter(map)
          pushDebugState({
            centerChanged: !!(beforeCenter && afterProjectedCenter &&
              (beforeCenter.lng !== afterProjectedCenter.lng || beforeCenter.lat !== afterProjectedCenter.lat))
          })
          return nextCenter
        }
        if (nextCenter && typeof map.panTo === 'function') {
          pushDebugState({ setCenterCalled: true, panMethodUsed: 'panTo' })
          map.panTo(nextCenter)
          var afterPanToCenter = readCenter(map)
          pushDebugState({
            centerChanged: !!(beforeCenter && afterPanToCenter &&
              (beforeCenter.lng !== afterPanToCenter.lng || beforeCenter.lat !== afterPanToCenter.lat))
          })
          return nextCenter
        }
        if (nextCenter && typeof map.centerAndZoom === 'function' && typeof map.getZoom === 'function') {
          var currentZoom = map.getZoom()
          pushDebugState({ setCenterCalled: true, panMethodUsed: 'centerAndZoom' })
          map.centerAndZoom(nextCenter, currentZoom)
          var afterCenterAndZoomCenter = readCenter(map)
          pushDebugState({
            centerChanged: !!(beforeCenter && afterCenterAndZoomCenter &&
              (beforeCenter.lng !== afterCenterAndZoomCenter.lng || beforeCenter.lat !== afterCenterAndZoomCenter.lat))
          })
          return nextCenter
        }
      } catch (e) {}
    }

    var center = beforeCenter || readCenter(map)
    var zoom = readZoom(map)
    if (!center || zoom === null || !global.T || typeof global.T.LngLat !== 'function') {
      return null
    }
    var degreesPerPixel = 360 / (256 * Math.pow(2, zoom))
    var fallbackCenter = new global.T.LngLat(
      center.lng - localDelta.x * degreesPerPixel,
      center.lat + localDelta.y * degreesPerPixel
    )
    try {
      if (typeof map.setCenter === 'function') {
        pushDebugState({ setCenterCalled: true, panMethodUsed: 'setCenter' })
        map.setCenter(fallbackCenter)
        var afterFallbackCenter = readCenter(map)
        pushDebugState({
          centerChanged: !!(beforeCenter && afterFallbackCenter &&
            (beforeCenter.lng !== afterFallbackCenter.lng || beforeCenter.lat !== afterFallbackCenter.lat))
        })
        return fallbackCenter
      }
      if (typeof map.panTo === 'function') {
        pushDebugState({ setCenterCalled: true, panMethodUsed: 'panTo' })
        map.panTo(fallbackCenter)
        var afterFallbackPanTo = readCenter(map)
        pushDebugState({
          centerChanged: !!(beforeCenter && afterFallbackPanTo &&
            (beforeCenter.lng !== afterFallbackPanTo.lng || beforeCenter.lat !== afterFallbackPanTo.lat))
        })
        return fallbackCenter
      }
      if (typeof map.centerAndZoom === 'function' && typeof map.getZoom === 'function') {
        pushDebugState({ setCenterCalled: true, panMethodUsed: 'centerAndZoom' })
        map.centerAndZoom(fallbackCenter, map.getZoom())
        var afterFallbackCenterAndZoom = readCenter(map)
        pushDebugState({
          centerChanged: !!(beforeCenter && afterFallbackCenterAndZoom &&
            (beforeCenter.lng !== afterFallbackCenterAndZoom.lng || beforeCenter.lat !== afterFallbackCenterAndZoom.lat))
        })
        return fallbackCenter
      }
    } catch (e) {}
    return null
  }

  function applyZoom(map, targetZoom) {
    if (!map) return null
    var currentZoom = readZoom(map)
    if (currentZoom === null) return null
    var nextZoom = clampZoom(map, targetZoom)
    if (nextZoom === null) return null
    var roundedCurrent = Math.round(currentZoom)
    var roundedNext = Math.round(nextZoom)
    if (roundedCurrent === roundedNext) {
      return roundedCurrent
    }
    var center = readCenter(map)
    try {
      if (center && global.T && typeof global.T.LngLat === 'function' && typeof map.centerAndZoom === 'function') {
        map.centerAndZoom(new global.T.LngLat(center.lng, center.lat), roundedNext)
        return roundedNext
      }
      if (typeof map.setZoom === 'function') {
        map.setZoom(roundedNext)
        return roundedNext
      }
    } catch (e) {}
    return null
  }

  function createDeliveryMapGestureController(options) {
    var opts = options || {}
    var wrapper = opts.wrapper
    var overlay = opts.overlay
    var eventTarget = opts.eventTarget || wrapper || overlay
    var state = {
      mode: null,
      active: false,
      singleTouchId: null,
      lastTouchPoint: null,
      pinchIds: null,
      pinchBaseDistance: 0,
      pinchBaseZoom: null,
      pinchAppliedZoom: null,
      mouseDragging: false,
      lastMousePoint: null
    }

    if (!wrapper || !overlay || !eventTarget) {
      return {
        destroy: function () {}
      }
    }

    function logGesture(type, extra) {
      var payload = extra || {}
      var text = '[delivery-gesture] ' + type + ' ' + JSON.stringify(payload)
      if (!global.__deliveryMapGestureLogs) {
        global.__deliveryMapGestureLogs = []
      }
      global.__deliveryMapGestureLogs.push(text)
      if (global.__deliveryMapGestureLogs.length > 60) {
        global.__deliveryMapGestureLogs.shift()
      }
      try {
        console.log(text)
      } catch (e) {}
    }

    function isInteractiveTarget(target) {
      if (!target || typeof target.closest !== 'function') return false
      return !!target.closest('button,input,textarea,select,a')
    }

    function getMap() {
      return typeof opts.getMap === 'function' ? opts.getMap() : null
    }

    function getRotation() {
      return typeof opts.getRotation === 'function' ? Number(opts.getRotation()) || 0 : 0
    }

    function beginInteraction(nextMode) {
      if (!state.active) {
        state.active = true
        if (typeof opts.onInteractionStart === 'function') {
          opts.onInteractionStart(nextMode)
        }
      }
      state.mode = nextMode
      if (typeof opts.onFreeView === 'function') {
        opts.onFreeView(nextMode)
      }
    }

    function endInteraction() {
      if (state.active && typeof opts.onInteractionEnd === 'function') {
        opts.onInteractionEnd(state.mode)
      }
      state.active = false
      state.mode = null
    }

    function resetSingleTouch() {
      state.singleTouchId = null
      state.lastTouchPoint = null
    }

    function resetPinch() {
      state.pinchIds = null
      state.pinchBaseDistance = 0
      state.pinchBaseZoom = null
      state.pinchAppliedZoom = null
    }

    function notifyCenter(nextCenter) {
      if (nextCenter && typeof opts.onCenterChange === 'function') {
        opts.onCenterChange(nextCenter)
      }
    }

    function notifyZoom(nextZoom) {
      if (Number.isFinite(nextZoom) && typeof opts.onZoomChange === 'function') {
        opts.onZoomChange(nextZoom)
      }
    }

    function startSingleTouch(touch) {
      resetPinch()
      state.singleTouchId = touch.identifier
      state.lastTouchPoint = { x: touch.clientX, y: touch.clientY }
    }

    function startPinch(a, b) {
      var map = getMap()
      resetSingleTouch()
      state.pinchIds = [a.identifier, b.identifier]
      state.pinchBaseDistance = getTouchDistance(a, b)
      state.pinchBaseZoom = readZoom(map)
      state.pinchAppliedZoom = state.pinchBaseZoom
    }

    function handleTouchStart(event) {
      if (!event.touches || !event.touches.length) return
      pushDebugState({
        touchstartCount: Number((global.__merchantGestureDebugState && global.__merchantGestureDebugState.touchstartCount) || 0) + 1
      })
      logGesture('touchstart', {
        touches: event.touches.length,
        target: event.target && event.target.id ? event.target.id : (event.target && event.target.tagName) || 'unknown'
      })
      if (isInteractiveTarget(event.target)) {
        return
      }
      if (event.touches.length === 1) {
        event.preventDefault()
        event.stopPropagation()
        startSingleTouch(event.touches[0])
        return
      }
      if (event.touches.length >= 2) {
        event.preventDefault()
        event.stopPropagation()
        beginInteraction('zoom')
        startPinch(event.touches[0], event.touches[1])
      }
    }

    function handleTouchMove(event) {
      if (!event.touches || !event.touches.length) return
      if (event.touches.length === 1 && state.singleTouchId !== null) {
        var touch = getTouchById(event.touches, state.singleTouchId) || event.touches[0]
        if (!touch || !state.lastTouchPoint) return
        var dx = touch.clientX - state.lastTouchPoint.x
        var dy = touch.clientY - state.lastTouchPoint.y
        var adjustedDx = dx * PAN_SENSITIVITY
        var adjustedDy = dy * PAN_SENSITIVITY
        pushDebugState({
          touchmoveCount: Number((global.__merchantGestureDebugState && global.__merchantGestureDebugState.touchmoveCount) || 0) + 1,
          lastDx: dx,
          lastDy: dy
        })
        logGesture('touchmove', { dx: dx, dy: dy, touches: 1 })
        state.lastTouchPoint = { x: touch.clientX, y: touch.clientY }
        if (!dx && !dy) return
        event.preventDefault()
        event.stopPropagation()
        beginInteraction('pan')
        notifyCenter(updateCenterByDelta(getMap(), wrapper, getRotation(), adjustedDx, adjustedDy))
        return
      }

      if (event.touches.length >= 2 && state.pinchIds) {
        var a = getTouchById(event.touches, state.pinchIds[0]) || event.touches[0]
        var b = getTouchById(event.touches, state.pinchIds[1]) || event.touches[1]
        if (!a || !b || !state.pinchBaseDistance || state.pinchBaseZoom === null) return
        var distance = getTouchDistance(a, b)
        if (!distance) return
        logGesture('touchmove-pinch', { distance: distance, touches: event.touches.length })
        event.preventDefault()
        event.stopPropagation()
        beginInteraction('zoom')
        var zoomDelta = Math.log(distance / state.pinchBaseDistance) / Math.LN2
        var nextZoom = applyZoom(getMap(), state.pinchBaseZoom + zoomDelta)
        if (nextZoom !== null && nextZoom !== state.pinchAppliedZoom) {
          state.pinchAppliedZoom = nextZoom
          notifyZoom(nextZoom)
        }
      }
    }

    function handleTouchEnd(event) {
      if (event.touches && event.touches.length >= 2) {
        startPinch(event.touches[0], event.touches[1])
        return
      }
      if (event.touches && event.touches.length === 1) {
        startSingleTouch(event.touches[0])
        endInteraction()
        return
      }
      resetSingleTouch()
      resetPinch()
      endInteraction()
    }

    function handleTouchCancel() {
      resetSingleTouch()
      resetPinch()
      endInteraction()
    }

    function handlePointerDown(event) {
      if (!event || event.pointerType === 'mouse') return
      logGesture('pointerdown', {
        pointerType: event.pointerType,
        target: event.target && event.target.id ? event.target.id : (event.target && event.target.tagName) || 'unknown'
      })
    }

    function handlePointerMove(event) {
      if (!event || event.pointerType === 'mouse') return
      logGesture('pointermove', {
        pointerType: event.pointerType,
        x: event.clientX,
        y: event.clientY
      })
    }

    function handlePointerEnd(event) {
      if (!event || event.pointerType === 'mouse') return
      logGesture('pointerend', {
        pointerType: event.pointerType
      })
    }

    function handleMouseDown(event) {
      if (event.button !== 0) return
      if (isInteractiveTarget(event.target)) {
        return
      }
      event.preventDefault()
      state.mouseDragging = true
      state.lastMousePoint = { x: event.clientX, y: event.clientY }
    }

    function handleMouseMove(event) {
      if (!state.mouseDragging || !state.lastMousePoint) return
      var dx = event.clientX - state.lastMousePoint.x
      var dy = event.clientY - state.lastMousePoint.y
      state.lastMousePoint = { x: event.clientX, y: event.clientY }
      if (!dx && !dy) return
      beginInteraction('pan')
      notifyCenter(updateCenterByDelta(getMap(), wrapper, getRotation(), dx, dy))
    }

    function handleMouseUp() {
      if (!state.mouseDragging) return
      state.mouseDragging = false
      state.lastMousePoint = null
      endInteraction()
    }

    function handleWheel(event) {
      event.preventDefault()
      beginInteraction('zoom')
      var map = getMap()
      var currentZoom = readZoom(map)
      if (currentZoom === null) {
        endInteraction()
        return
      }
      var nextZoom = applyZoom(map, currentZoom + (event.deltaY < 0 ? 1 : -1))
      notifyZoom(nextZoom)
      endInteraction()
    }

    eventTarget.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true })
    eventTarget.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true })
    eventTarget.addEventListener('touchend', handleTouchEnd, { capture: true })
    eventTarget.addEventListener('touchcancel', handleTouchCancel, { capture: true })
    eventTarget.addEventListener('pointerdown', handlePointerDown, { passive: false })
    eventTarget.addEventListener('pointermove', handlePointerMove, { passive: false })
    eventTarget.addEventListener('pointerup', handlePointerEnd)
    eventTarget.addEventListener('pointercancel', handlePointerEnd)
    eventTarget.addEventListener('mousedown', handleMouseDown)
    eventTarget.addEventListener('wheel', handleWheel, { passive: false })
    global.addEventListener('mousemove', handleMouseMove)
    global.addEventListener('mouseup', handleMouseUp)

    return {
      destroy: function () {
        eventTarget.removeEventListener('touchstart', handleTouchStart, { passive: false, capture: true })
        eventTarget.removeEventListener('touchmove', handleTouchMove, { passive: false, capture: true })
        eventTarget.removeEventListener('touchend', handleTouchEnd, { capture: true })
        eventTarget.removeEventListener('touchcancel', handleTouchCancel, { capture: true })
        eventTarget.removeEventListener('pointerdown', handlePointerDown, { passive: false })
        eventTarget.removeEventListener('pointermove', handlePointerMove, { passive: false })
        eventTarget.removeEventListener('pointerup', handlePointerEnd)
        eventTarget.removeEventListener('pointercancel', handlePointerEnd)
        eventTarget.removeEventListener('mousedown', handleMouseDown)
        eventTarget.removeEventListener('wheel', handleWheel, { passive: false })
        global.removeEventListener('mousemove', handleMouseMove)
        global.removeEventListener('mouseup', handleMouseUp)
        handleTouchCancel()
      }
    }
  }

  global.createDeliveryMapGestureController = createDeliveryMapGestureController
})(window)
