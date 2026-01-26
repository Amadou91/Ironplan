'use client'

import { useState, useCallback, useEffect } from 'react'

interface UseChartZoomProps<T> {
  data: T[]
  dataKey: keyof T
}

export function useChartZoom<T>({ data, dataKey }: UseChartZoomProps<T>) {
  const [left, setLeft] = useState<string | number | null>(null)
  const [right, setRight] = useState<string | number | null>(null)
  const [refAreaLeft, setRefAreaLeft] = useState<string | number | null>(null)
  const [refAreaRight, setRefAreaRight] = useState<string | number | null>(null)

  const zoom = useCallback(() => {
    if (refAreaLeft === refAreaRight || refAreaRight === null || refAreaLeft === null) {
      setRefAreaLeft(null)
      setRefAreaRight(null)
      return
    }

    let actualLeft = refAreaLeft
    let actualRight = refAreaRight

    // Ensure correct domain order
    if (typeof actualLeft === 'number' && typeof actualRight === 'number') {
      if (actualLeft > actualRight) {
        ;[actualLeft, actualRight] = [actualRight, actualLeft]
      }
    } else {
      // Find indices to ensure correct domain order for categorical data
      const leftIndex = data.findIndex(item => item[dataKey] === actualLeft)
      const rightIndex = data.findIndex(item => item[dataKey] === actualRight)

      if (leftIndex !== -1 && rightIndex !== -1 && leftIndex > rightIndex) {
        ;[actualLeft, actualRight] = [actualRight, actualLeft]
      }
    }

    setLeft(actualLeft)
    setRight(actualRight)
    setRefAreaLeft(null)
    setRefAreaRight(null)
  }, [refAreaLeft, refAreaRight, data, dataKey])

  const zoomOut = useCallback(() => {
    setLeft(null)
    setRight(null)
    setRefAreaLeft(null)
    setRefAreaRight(null)
  }, [])

  // Handle mouse up anywhere on the screen if dragging started
  useEffect(() => {
    if (refAreaLeft !== null) {
      const handleGlobalMouseUp = () => {
        zoom()
      }
      window.addEventListener('mouseup', handleGlobalMouseUp)
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [refAreaLeft, zoom])

  return {
    left,
    right,
    refAreaLeft,
    refAreaRight,
    setRefAreaLeft,
    setRefAreaRight,
    zoom,
    zoomOut,
    isZoomed: left !== null && right !== null
  }
}
