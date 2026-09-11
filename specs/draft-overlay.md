# Draft Overlay

## User outcome

During the local player's hero-selection phase, an optional desktop overlay mirrors the Dota hero grid. Category buttons highlight suitable heroes and dim the rest so the player can locate and manually select a hero in Dota.

## Safety boundary

- Capture only the Dota window automatically matched from Windows process metadata, or a window/display explicitly selected by the user.
- Read the `dota2.exe` process id and main-window handle only. Read pixels from that window; do not open game memory, inject code, hook graphics APIs, or connect to Dota, Steam, or Valve.
- Never inject code, synthesize input, or click a hero on the player's behalf.
- The visual layer is transparent and mouse-through. A separate toolbar owns all interaction.
- Recognition may mark a hero only as visually unavailable; it must not invent hidden picks or bans.

## First usable slice

1. Expose hero roles and primary attributes from the bundled catalog.
2. Provide built-in role categories and deterministic multi-category recommendations.
3. Render a stable four-attribute draft grid with highlighted, dimmed, and unavailable states.
4. Prefer the visible window owned by `dota2.exe`, expose the binding state, and retain manual window/display selection as a fallback.
5. Open the grid as an opt-in transparent overlay plus an interactive category toolbar.
6. Capture the selected source on demand, save a clean visual baseline in memory, and detect changed hero cells from later frames.
7. Keep manual unavailable-state correction and layout calibration available when recognition is uncertain.

## Layout contract

The 7.41 default layout is four vertical attribute groups ordered Strength, Agility, Intelligence, and Universal, with four portrait columns per group and a versioned hero position manifest. Position and scale are user-adjustable because Dota resolution, display scaling, language, and UI updates can change the screen geometry.

## Automatic Dota window acceptance

- When a visible `dota2.exe` main window matches an Electron capture source, it is selected first and labeled as automatically bound.
- A running game with no visible main window and a missing game process are distinct, visible states.
- Failure to inspect Windows process metadata fails visibly; it never silently selects an unrelated window.
- Automatic binding does not claim that a changed portrait is specifically a ban or a team pick. That classification remains outside this increment.
