import { ARMORY_POOLS, ensureArmoryPools, moveHeroToPool, setPersonalMatchup } from "../assistant/armory-profile.js";

function option(value, label) {
  const element = document.createElement("option");
  element.value = String(value);
  element.textContent = label;
  return element;
}

function planId() {
  return `plan-${Date.now().toString(36)}`;
}

export function createArmoryView({ api, onBack }) {
  const poolsElement = document.querySelector("#armory-pools");
  const rosterElement = document.querySelector("#armory-hero-roster");
  const searchElement = document.querySelector("#armory-hero-search");
  const messageElement = document.querySelector("#armory-message");
  const heroSelect = document.querySelector("#armory-matchup-hero");
  const againstSelect = document.querySelector("#armory-matchup-against");
  let catalog;
  let profile;
  let heroesById = new Map();
  let selectedHeroId;

  function setMessage(text, tone = "") {
    messageElement.textContent = text;
    messageElement.dataset.tone = tone;
  }

  async function save(next, success) {
    profile = await api.saveDraftProfile(next);
    render();
    setMessage(success, "success");
  }

  function portrait(hero, removable = false, poolId = "") {
    const card = document.createElement(removable ? "button" : "article");
    if (removable) card.type = "button";
    card.className = "armory-hero";
    card.draggable = true;
    card.dataset.heroId = String(hero.id);
    card.title = removable ? `${hero.name}（点击移出）` : `${hero.name}（拖到上方分组）`;
    const image = document.createElement("img");
    image.src = hero.imageUrl ?? "";
    image.alt = "";
    image.referrerPolicy = "no-referrer";
    const name = document.createElement("span");
    name.textContent = hero.name;
    card.append(image, name);
    card.addEventListener("dragstart", (event) => event.dataTransfer.setData("text/plain", String(hero.id)));
    if (removable) {
      card.addEventListener("click", async () => {
        const category = profile.categories.find(({ id }) => id === poolId);
        const categories = profile.categories.map((entry) => entry.id === poolId
          ? { ...entry, heroIds: entry.heroIds.filter((id) => id !== hero.id) }
          : entry);
        const proficiency = { ...profile.proficiency };
        if (ARMORY_POOLS.some(({ id }) => id === category.id)) delete proficiency[hero.id];
        await save({ ...profile, categories, proficiency }, `${hero.name}已移出${category.name}。`);
      });
    } else {
      card.tabIndex = 0;
      card.classList.toggle("selected", selectedHeroId === hero.id);
      card.addEventListener("click", () => {
        selectedHeroId = selectedHeroId === hero.id ? undefined : hero.id;
        renderRoster();
      });
    }
    return card;
  }

  async function putHeroInPool(heroId, poolId) {
    const hero = heroesById.get(heroId);
    const pool = profile.categories.find(({ id }) => id === poolId);
    if (!hero || !pool) return;
    const fixed = ARMORY_POOLS.some(({ id }) => id === poolId);
    const next = fixed ? moveHeroToPool(profile, heroId, poolId) : {
      ...profile,
      categories: profile.categories.map((category) => category.id === poolId
        ? { ...category, heroIds: [...new Set([...category.heroIds, heroId])] }
        : category),
    };
    selectedHeroId = undefined;
    await save(next, `${hero.name}已加入${pool.name}。`);
  }

  function poolSection(category) {
    const fixed = ARMORY_POOLS.find(({ id }) => id === category.id);
    const section = document.createElement("section");
    section.className = "armory-pool";
    section.dataset.poolId = category.id;
    const heading = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = category.name;
    const hint = document.createElement("small");
    hint.textContent = fixed ? ({ 5: "最熟练，推荐权重最高", 3: "有过稳定获胜经验", 1: "了解基本操作" })[fixed.proficiency] : "自定义方案";
    heading.append(title, hint);
    const heroes = document.createElement("div");
    heroes.className = "armory-pool-heroes";
    heroes.append(...category.heroIds.flatMap((id) => heroesById.has(id) ? [portrait(heroesById.get(id), true, category.id)] : []));
    if (!category.heroIds.length) {
      const empty = document.createElement("p");
      empty.textContent = "拖入英雄";
      heroes.append(empty);
    }
    section.append(heading, heroes);
    section.addEventListener("dragover", (event) => event.preventDefault());
    section.addEventListener("drop", (event) => {
      event.preventDefault();
      void putHeroInPool(Number(event.dataTransfer.getData("text/plain")), category.id);
    });
    section.addEventListener("click", (event) => {
      if (selectedHeroId && event.target.closest(".armory-hero") === null) void putHeroInPool(selectedHeroId, category.id);
    });
    return section;
  }

  function renderPools() {
    const ordered = [
      ...ARMORY_POOLS.flatMap(({ id }) => profile.categories.filter((category) => category.id === id)),
      ...profile.categories.filter(({ id }) => !ARMORY_POOLS.some((pool) => pool.id === id)),
    ];
    poolsElement.replaceChildren(...ordered.map(poolSection));
  }

  function renderRoster() {
    const query = searchElement.value.trim().toLocaleLowerCase();
    rosterElement.replaceChildren(...catalog.heroes
      .filter((hero) => !query || hero.name.toLocaleLowerCase().includes(query))
      .map((hero) => portrait(hero)));
  }

  function renderMatchups() {
    const rows = profile.relationships.map((relation) => {
      const row = document.createElement("article");
      const text = document.createElement("span");
      text.textContent = `${heroesById.get(relation.heroId)?.name ?? relation.heroId} ${relation.score > 0 ? "克制" : "怕"} ${heroesById.get(relation.againstHeroId)?.name ?? relation.againstHeroId} · ${Math.abs(relation.score)}级${relation.note ? ` · ${relation.note}` : ""}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "secondary";
      remove.textContent = "删除";
      remove.addEventListener("click", () => save({
        ...profile,
        relationships: profile.relationships.filter((entry) => entry !== relation),
      }, "这条个人对局经验已删除。"));
      row.append(text, remove);
      return row;
    });
    document.querySelector("#armory-matchup-list").replaceChildren(...rows);
  }

  function render() {
    renderPools();
    renderRoster();
    renderMatchups();
  }

  searchElement.addEventListener("input", renderRoster);
  document.querySelector("#armory-plan-create").addEventListener("click", async () => {
    try {
      const input = document.querySelector("#armory-plan-name");
      const name = input.value.trim();
      if (!name) throw new RangeError("请输入方案名称");
      await save({ ...profile, categories: [...profile.categories, { id: planId(), name, heroIds: [] }] }, `方案“${name}”已创建。`);
      input.value = "";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "方案创建失败", "error");
    }
  });
  document.querySelector("#armory-matchup-save").addEventListener("click", async () => {
    try {
      await save(setPersonalMatchup(profile, {
        heroId: Number(heroSelect.value),
        againstHeroId: Number(againstSelect.value),
        direction: document.querySelector("#armory-matchup-direction").value,
        intensity: Number(document.querySelector("#armory-matchup-intensity").value),
        note: document.querySelector("#armory-matchup-note").value,
      }), "个人对局经验已保存，并会影响战术台推荐。" );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "关系保存失败", "error");
    }
  });
  document.querySelector("#armory-back").addEventListener("click", onBack);

  return Object.freeze({
    async open() {
      if (!catalog) {
        catalog = await api.getCatalog();
        heroesById = new Map(catalog.heroes.map((hero) => [hero.id, hero]));
        const choices = catalog.heroes.map((hero) => option(hero.id, hero.name));
        heroSelect.replaceChildren(...choices.map((entry) => entry.cloneNode(true)));
        againstSelect.replaceChildren(...choices);
      }
      const loaded = await api.getDraftProfile();
      profile = ensureArmoryPools(loaded);
      if (profile.categories.length !== loaded.categories.length) profile = await api.saveDraftProfile(profile);
      render();
      setMessage("拖动英雄头像即可保存。", "");
    },
  });
}
