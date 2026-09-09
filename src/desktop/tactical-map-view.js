import { presentTacticalMap } from "../tactical-map.js";

const battlefield = document.querySelector("#battlefield-map");
const heroLayer = document.querySelector("#map-heroes");
const buildingLayer = document.querySelector("#map-buildings");
const fog = document.querySelector("#map-fog");
const mapSignal = document.querySelector("#map-signal");
const heroMarkers = new Map();
const buildingMarkers = new Map();

function createHeroMarker() {
  const marker = document.createElement("div");
  marker.className = "map-hero";
  const icon = document.createElement("i");
  icon.setAttribute("aria-hidden", "true");
  const deathMark = document.createElement("span");
  deathMark.className = "map-death-mark";
  deathMark.textContent = "×";
  marker.append(icon, deathMark);
  return marker;
}

function updateHeroMarker(marker, hero) {
  marker.className = `map-hero team-${hero.team}${hero.dead ? " dead" : ""}`;
  marker.style.left = `${hero.left}%`;
  marker.style.top = `${hero.top}%`;
  marker.setAttribute("aria-label", `${hero.name}，${hero.team === 2 ? "天辉" : "夜魇"}${hero.dead ? "，阵亡" : ""}`);
  marker.title = hero.name;
  marker.querySelector(":scope > i").className = `d2mh hero-${hero.heroId}`;
}

function syncHeroes(heroes) {
  const currentKeys = new Set(heroes.map(({ key }) => key));
  for (const [key, marker] of heroMarkers) {
    if (!currentKeys.has(key)) {
      marker.remove();
      heroMarkers.delete(key);
    }
  }
  for (const hero of heroes) {
    let marker = heroMarkers.get(hero.key);
    if (!marker) {
      marker = createHeroMarker();
      heroMarkers.set(hero.key, marker);
      heroLayer.append(marker);
    }
    updateHeroMarker(marker, hero);
  }
}

function syncBuildings(buildings) {
  const currentKeys = new Set(buildings.map(({ key }) => key));
  for (const [key, marker] of buildingMarkers) {
    if (!currentKeys.has(key)) {
      marker.remove();
      buildingMarkers.delete(key);
    }
  }
  for (const building of buildings) {
    let marker = buildingMarkers.get(building.key);
    if (!marker) {
      marker = document.createElement("span");
      marker.className = `map-building team-${building.team}`;
      marker.setAttribute("aria-hidden", "true");
      buildingMarkers.set(building.key, marker);
      buildingLayer.append(marker);
    }
    marker.style.left = `${building.left}%`;
    marker.style.top = `${building.top}%`;
  }
}

export function renderTacticalMap(match, { fast = false } = {}) {
  const map = presentTacticalMap(match);
  battlefield.classList.toggle("fast-travel", fast);
  battlefield.classList.toggle("map-available", map.available);
  fog.hidden = map.available;
  syncHeroes(map.heroes);
  syncBuildings(map.buildings);
  mapSignal.textContent = map.available
    ? `${map.heroes.length} 名英雄 · ${map.buildings.length} 座可见建筑`
    : "坐标未公开 · 战争迷雾封锁";
  battlefield.setAttribute("aria-label", map.available
    ? `战术小地图，显示 ${map.heroes.length} 名英雄的 Valve 实时坐标`
    : "战术小地图，Valve 尚未公开英雄坐标");
}
