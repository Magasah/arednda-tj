"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

// Карта выбора точки. Грузится через next/dynamic (ssr: false): Leaflet обращается к window,
// а ~150 КБ библиотеки не нужны никому, кроме шага «Место»

export const CITY_CENTERS: Record<string, [number, number]> = {
  Душанбе: [38.5598, 68.787],
  Худжанд: [40.2826, 69.6222],
  Бохтар: [37.8364, 68.7803],
  Куляб: [37.9146, 69.7845],
  // Прежнее название Бохтара — многие ищут по нему
  Кургантюбе: [37.8364, 68.7803],
};

// Своя иконка-булавка (divIcon): стандартная иконка Leaflet ссылается на PNG, которых нет в бандле
const pin = L.divIcon({
  className: "",
  html: '<span style="display:block;width:28px;height:28px;border-radius:50% 50% 50% 0;background:#E67E22;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);transform:rotate(-45deg)"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

interface LocationMapProps {
  city: string;
  lat: number | null;
  lng: number | null;
  onPick(lat: number, lng: number): void;
  label: string;
}

function ClickHandler({ onPick }: { onPick: LocationMapProps["onPick"] }) {
  useMapEvents({
    click(event) {
      onPick(Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6)));
    },
  });
  return null;
}

/** Сменили город — переносим карту к его центру (если точку ещё не ставили) */
function Recenter({ center, hasPoint }: { center: [number, number]; hasPoint: boolean }) {
  const map = useMap();
  const [centerLat, centerLng] = center;
  useEffect(() => {
    if (!hasPoint) map.setView([centerLat, centerLng], 12);
  }, [centerLat, centerLng, hasPoint, map]);
  return null;
}

export default function LocationMap({ city, lat, lng, onPick, label }: LocationMapProps) {
  const center = CITY_CENTERS[city] ?? CITY_CENTERS["Душанбе"];
  const point: [number, number] | null = lat != null && lng != null ? [lat, lng] : null;

  return (
    <div role="application" aria-label={label} className="h-72 overflow-hidden rounded-card border border-border sm:h-80">
      <MapContainer center={point ?? center} zoom={point ? 15 : 12} scrollWheelZoom={false} className="size-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={onPick} />
        <Recenter center={center} hasPoint={Boolean(point)} />
        {point && <Marker position={point} icon={pin} />}
      </MapContainer>
    </div>
  );
}
