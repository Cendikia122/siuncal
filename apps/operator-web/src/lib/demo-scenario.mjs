export const DEMO_ROUTE_FLEET = Object.freeze([
  { routeId: "01", routeName: "Trayek 01", platePrefix: "19", plateSuffix: "AK", baseSpeed: 28, battery: 0.86 },
  { routeId: "02", routeName: "Trayek 02", platePrefix: "20", plateSuffix: "SB", baseSpeed: 26, battery: 0.82 },
  { routeId: "03", routeName: "Trayek 03", platePrefix: "30", plateSuffix: "BB", baseSpeed: 30, battery: 0.9 }
])

const padFleetNo = (value) => String(value).padStart(2, "0")
const padVehicleCodeNo = (value) => String(value).padStart(3, "0")

const routeFleetById = new Map(DEMO_ROUTE_FLEET.map((route) => [route.routeId, route]))

const routeFleetFor = (routeId) => {
  const route = routeFleetById.get(String(routeId))
  if (!route) throw new Error(`Unknown demo route: ${routeId}`)
  return route
}

export const demoPlateNo = (routeId, fleetNo) => {
  const route = routeFleetFor(routeId)
  return `F ${route.platePrefix}${padFleetNo(fleetNo)} ${route.plateSuffix}`
}

export const demoVehicleCode = (routeId, fleetNo) => `${routeId}-DEMO-${padVehicleCodeNo(fleetNo)}`

export const demoImeiOrSerial = (routeId, fleetNo) => `8675309${routeId}${padFleetNo(fleetNo)}`

export const buildDemoFleetVehicles = ({ routesById, vehiclesPerRoute = 15 } = {}) => {
  return DEMO_ROUTE_FLEET.flatMap((route) => (
    Array.from({ length: vehiclesPerRoute }, (_, index) => {
      const fleetNo = index + 1
      const routePoints = routesById?.[route.routeId] || []
      const routeLength = routePoints.length || 1
      const routeOffset = (index * 0.61) % routeLength
      const firstPoint = routePoints[Math.floor(routeOffset)] || {
        lat: -6.595038,
        lon: 106.816635,
        heading: 0
      }

      return {
        vehicle_id: null,
        plate_no: demoPlateNo(route.routeId, fleetNo),
        route_id: route.routeId,
        route_name: route.routeName,
        vehicle_code: demoVehicleCode(route.routeId, fleetNo),
        route_offset: routeOffset,
        move_step: 0.16 + ((fleetNo % 5) * 0.025),
        start_lat: firstPoint.lat,
        start_lon: firstPoint.lon,
        speed_kmh: route.baseSpeed + (fleetNo % 5),
        heading: firstPoint.heading,
        status: "IN_SERVICE",
        device_id: null,
        imei_or_serial: demoImeiOrSerial(route.routeId, fleetNo),
        battery: Math.max(0.5, route.battery - (fleetNo * 0.006)),
        signal_dbm: -72 - (fleetNo % 12)
      }
    })
  ))
}
