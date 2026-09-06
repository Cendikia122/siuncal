"use client"

import { createElementObject, createPathComponent, extendContext } from "@react-leaflet/core"
import type { LeafletContextInterface } from "@react-leaflet/core"
import L from "leaflet"
import "leaflet.markercluster"
import type { PropsWithChildren } from "react"

const splitPropsAndEvents = (props: Record<string, unknown>) => {
  const clusterProps: Record<string, unknown> = {}
  const clusterEvents: Record<string, unknown> = {}

  Object.entries(props).forEach(([propName, propValue]) => {
    if (propName.startsWith("on") && typeof propValue === "function") {
      clusterEvents[propName] = propValue
      return
    }
    if (propName === "children") return
    clusterProps[propName] = propValue
  })

  return { clusterProps, clusterEvents }
}

type MarkerClusterGroupProps = PropsWithChildren<L.MarkerClusterGroupOptions & Record<string, unknown>>

const createMarkerClusterGroup = (props: MarkerClusterGroupProps, context: LeafletContextInterface) => {
  const { clusterProps, clusterEvents } = splitPropsAndEvents(props)
  const markerClusterGroup = new L.MarkerClusterGroup(clusterProps as L.MarkerClusterGroupOptions)

  Object.entries(clusterEvents).forEach(([eventName, handler]) => {
    const clusterEvent = `cluster${eventName.substring(2).toLowerCase()}`
    markerClusterGroup.on(clusterEvent, handler as L.LeafletEventHandlerFn)
  })

  return createElementObject(markerClusterGroup, extendContext(context, { layerContainer: markerClusterGroup }))
}

const updateMarkerClusterGroup = () => {}

const MarkerClusterGroup = createPathComponent<L.MarkerClusterGroup, MarkerClusterGroupProps>(
  createMarkerClusterGroup,
  updateMarkerClusterGroup
)

export default MarkerClusterGroup
