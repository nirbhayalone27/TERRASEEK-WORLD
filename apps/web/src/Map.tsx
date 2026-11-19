import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Place } from "./lib/api";
export default function MapView({
  place,
  onPick,
}: {
  place: Place;
  onPick: (lat: number, lon: number) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const ref = useRef<L.Map | null>(null);
  useEffect(() => {
    const map = L.map(el.current!, { zoomControl: false }).setView(
      [place.lat, place.lon],
      11,
    );
    ref.current = map;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.on("click", (e) => onPick(e.latlng.lat, e.latlng.lng));
    return () => {
      map.remove();
    };
  }, []);
  useEffect(() => {
    const map = ref.current!;
    map.setView([place.lat, place.lon], 12);
    const dy = 1.28 / 111.32,
      dx = dy / Math.cos((place.lat * Math.PI) / 180);
    const box = L.rectangle(
      [
        [place.lat - dy, place.lon - dx],
        [place.lat + dy, place.lon + dx],
      ],
      { color: "#315e48", weight: 2, fillOpacity: 0.08 },
    ).addTo(map);
    const marker = L.circleMarker([place.lat, place.lon], {
      radius: 5,
      color: "#315e48",
      fillOpacity: 1,
    }).addTo(map);
    return () => {
      box.remove();
      marker.remove();
    };
  }, [place]);
  return <div ref={el} className="map" />;
}
