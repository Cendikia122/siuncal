export type LatLng = { latitude: number; longitude: number };

export type RouteStop = {
  name: string;
  coordinate: LatLng;
};

export type RouteData = {
  id: string;
  name: string;
  destination: string;
  color: string;
  hours: string;
  headway: string;
  stops: RouteStop[];
};

export const routes: RouteData[] = [
  {
    id: "01",
    name: "Baranangsiang",
    destination: "Terminal Bubulak",
    color: "#C0392B",
    hours: "04:30 - 20:20 WIB",
    headway: "8-12 menit",
    stops: [
      { name: "Baranangsiang", coordinate: { latitude: -6.5955, longitude: 106.8015 } },
      { name: "Tugu Kujang", coordinate: { latitude: -6.5931, longitude: 106.7943 } },
      { name: "Merdeka", coordinate: { latitude: -6.5876, longitude: 106.7947 } },
      { name: "Sukasari", coordinate: { latitude: -6.5803, longitude: 106.7910 } },
      { name: "Terminal Bubulak", coordinate: { latitude: -6.5681, longitude: 106.7634 } },
    ],
  },
  {
    id: "02",
    name: "Ciawi",
    destination: "Terminal Bubulak",
    color: "#7D3C98",
    hours: "04:30 - 20:20 WIB",
    headway: "10-15 menit",
    stops: [
      { name: "Ciawi", coordinate: { latitude: -6.6498, longitude: 106.8543 } },
      { name: "Sukasari", coordinate: { latitude: -6.6100, longitude: 106.8300 } },
      { name: "Batu Tulis", coordinate: { latitude: -6.5990, longitude: 106.8120 } },
      { name: "Merdeka", coordinate: { latitude: -6.5876, longitude: 106.7947 } },
      { name: "Terminal Bubulak", coordinate: { latitude: -6.5681, longitude: 106.7634 } },
    ],
  },
  {
    id: "03",
    name: "Cilebut",
    destination: "Stasiun Bogor",
    color: "#27AE60",
    hours: "04:30 - 20:20 WIB",
    headway: "7-10 menit",
    stops: [
      { name: "Cilebut", coordinate: { latitude: -6.5093, longitude: 106.8221 } },
      { name: "Kebon Pedes", coordinate: { latitude: -6.5393, longitude: 106.8062 } },
      { name: "Merdeka", coordinate: { latitude: -6.5876, longitude: 106.7947 } },
      { name: "Stasiun Bogor", coordinate: { latitude: -6.5951, longitude: 106.7980 } },
    ],
  },
  {
    id: "05",
    name: "Stasiun KA Bogor",
    destination: "Terminal Ciparigi",
    color: "#E67E22",
    hours: "04:30 - 20:20 WIB",
    headway: "12-18 menit",
    stops: [
      { name: "Stasiun Bogor", coordinate: { latitude: -6.5951, longitude: 106.7980 } },
      { name: "Pajajaran", coordinate: { latitude: -6.5818, longitude: 106.7965 } },
      { name: "Warung Jambu", coordinate: { latitude: -6.5490, longitude: 106.7882 } },
      { name: "Terminal Ciparigi", coordinate: { latitude: -6.5239, longitude: 106.7840 } },
    ],
  },
  {
    id: "06",
    name: "Stasiun KA Bogor",
    destination: "Parung Banteng",
    color: "#2980B9",
    hours: "04:30 - 20:20 WIB",
    headway: "12-18 menit",
    stops: [
      { name: "Stasiun Bogor", coordinate: { latitude: -6.5951, longitude: 106.7980 } },
      { name: "Suryakencana", coordinate: { latitude: -6.5993, longitude: 106.8022 } },
      { name: "Katulampa", coordinate: { latitude: -6.5980, longitude: 106.8412 } },
      { name: "Parung Banteng", coordinate: { latitude: -6.6133, longitude: 106.8893 } },
    ],
  },
];

export const findRouteForVehicle = (routeName?: string | null) => {
  const normalized = routeName?.toLowerCase() ?? "";
  return routes.find((route) => normalized.includes(route.id) || normalized.includes(route.name.toLowerCase()));
};

export const BOGOR_CENTER: LatLng = { latitude: -6.5951, longitude: 106.7980 };
