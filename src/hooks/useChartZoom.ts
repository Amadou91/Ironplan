'use client'

import { useState, useCallback } from 'react'

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
    let actualLeft = refAreaLeft
    let actualRight = refAreaRight

    if (actualLeft === actualRight || actualRight === null || actualLeft === null) {
      setRefAreaLeft(null)
      setRefAreaRight(null)
      return
    }

    // Ensure left is always earlier in the data array than right
    // This is crucial for Recharts categorical X-Axis domain
    const leftIndex = data.findIndex(item => item[dataKey] === actualLeft)
    const rightIndex = data.findIndex(item => item[dataKey] === actualRight)

    if (leftIndex > rightIndex) {
      ;[actualLeft, actualRight] = [actualRight, actualLeft]
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

  return {
    left,
    right,
    refAreaLeft,
    refAreaRight,
    setRefAreaLeft,
    setRefAreaRight,
    zoom,
    zoomOut,
    isZoomed: left !== null || right !== null
  }
}
