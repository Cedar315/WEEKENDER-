"use client";
import { useEffect, useRef, useState } from "react";
import type L from "leaflet";
import { Point } from "@/lib/model";
export type Marker = {
  id: string;
  name: string;
  point: Point;
  label: string;
  origin?: boolean;
};
export default function Map({
  markers,
  selected,
  onSelect,
  paths = [],
}: {
  markers: Marker[];
  selected?: string;
  onSelect: (id: string) => void;
  paths?: Point[][];
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const leaflet = useRef<typeof L | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    let active = true;
    import("leaflet").then(({ default: L }) => {
      if (!active || !el.current) return;
      leaflet.current = L;
      map.current = L.map(el.current, {
        zoomControl: false,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
      }).setView([-33.7, 151], 9);
      L.control.zoom({ position: "bottomright" }).addTo(map.current);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      })
        .on("tileerror", () => setFailed(true))
        .addTo(map.current);
      layer.current = L.layerGroup().addTo(map.current);
      setReady(true);
    });
    return () => {
      active = false;
      map.current?.stop();
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);
  useEffect(() => {
    const L = leaflet.current;
    if (!ready || !map.current || !layer.current || !L) return;
    layer.current.clearLayers();
    markers.forEach((m) => {
      const icon = L.divIcon({
        className: "custom-marker",
        html: `<span class="pin ${m.origin ? "origin" : ""} ${selected === m.id ? "active" : ""}">${m.label}</span>`,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      });
      L.marker([m.point.lat, m.point.lng], { icon })
        .bindTooltip(m.name, { direction: "top" })
        .on("click", () => select.current(m.id))
        .addTo(layer.current!);
    });
    paths
      .filter((p) => p.length > 1)
      .forEach((p) =>
        L.polyline(
          p.map((x) => [x.lat, x.lng]),
          { color: "#217366", weight: 5, opacity: 0.8 },
        ).addTo(layer.current!),
      );
  }, [markers, paths, ready, selected]);
  useEffect(() => {
    const L = leaflet.current;
    if (!ready || !map.current || !L) return;
    if (markers.length)
      map.current
        .stop()
        .fitBounds(
          L.latLngBounds(markers.map((m) => [m.point.lat, m.point.lng])),
          { padding: [70, 70], maxZoom: 13, animate: false },
        );
  }, [markers, ready]);
  useEffect(() => {
    const m = markers.find((m) => m.id === selected);
    if (m && map.current)
      map.current.flyTo(
        [m.point.lat, m.point.lng],
        Math.max(map.current.getZoom(), 10),
        { duration: 0.7 },
      );
  }, [selected, ready]);
  return (
    <div className="map-shell">
      <div ref={el} className="map" />
      {failed && (
        <div className="map-error">
          底图网络异常 · 仍可使用地点列表和地图标记
        </div>
      )}
      <div className="map-caption">
        <span className="dot" /> 真实地点 · 仅绘制已验证道路路径
      </div>
    </div>
  );
}
