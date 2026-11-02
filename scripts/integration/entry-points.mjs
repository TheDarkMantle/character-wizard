import { MODULE_ID } from "../constants.mjs";
import { getSetting } from "../settings.mjs";

/** Can the current user use the wizard at all? */
function canUseWizard() {
  return game.user.isGM || getSetting("allowPlayers");
}

/** Character level of an actor (0 for a fresh, class-less character). */
export function characterLevel(actor) {
  return Number(actor?.system?.details?.level ?? 0) || 0;
}

/**
 * Open the right flow for an actor: creation when it's level 0.
 * Level-up from the sheet is planned for a later version.
 * @param {Actor} actor
 */
export function openForActor(actor) {
  if ( characterLevel(actor) === 0 ) return game.modules.get(MODULE_ID).api.open({ actor });
  ui.notifications.info("CHARWIZ.Notify.LevelUpLater", { localize: true });
}

/**
 * Add the wizard button to the Actors sidebar header.
 * Matches core's own header buttons (icon + <span> label inside .header-actions) so it picks up their styling.
 */
function onRenderActorDirectory(app, html) {
  if ( !canUseWizard() ) return;
  const header = html.querySelector(".directory-header");
  if ( !header || header.querySelector(".charwiz-launch") ) return;
  const label = game.i18n.localize("CHARWIZ.Launch");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "charwiz-launch";
  button.dataset.tooltip = label;
  button.setAttribute("aria-label", label);
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-hat-wizard";
  icon.setAttribute("inert", "");
  const span = document.createElement("span");
  span.textContent = label;
  button.append(icon, span);
  button.addEventListener("click", () => game.modules.get(MODULE_ID).api.open());
  const actions = header.querySelector(".header-actions");
  if ( actions ) actions.append(button);
  else header.prepend(button);
}

/** Add a "Character Wizard" entry to the character sheet's header controls menu. */
function onGetHeaderControls(sheet, controls) {
  const actor = sheet.document;
  if ( !canUseWizard() || !actor?.isOwner ) return;
  controls.push({
    icon: "fa-solid fa-hat-wizard",
    label: "CHARWIZ.Launch",
    action: "charwizOpen",
    onClick: () => openForActor(actor)
  });
}

/**
 * On an unlocked level-0 character sheet, add a small wizard hat button beside the lock toggle in the window
 * header. It lives in the header, outside the sheet content, because dnd5e disables clicks on anything in the
 * content that it didn't add itself.
 */
function onRenderCharacterSheet(sheet) {
  const actor = sheet.document;
  const header = sheet.element?.querySelector(".window-header");
  header?.querySelector(".charwiz-header-button")?.remove();
  if ( !header || !canUseWizard() || !actor?.isOwner || !sheet.isEditable || !sheet.isEditMode ) return;
  if ( characterLevel(actor) !== 0 ) return;
  const label = game.i18n.localize("CHARWIZ.Launch");
  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("header-control", "charwiz-header-button", "icon", "fa-solid", "fa-hat-wizard");
  button.dataset.tooltip = label;
  button.dataset.tooltipDirection = "DOWN";
  button.setAttribute("aria-label", label);
  // Like the lock toggle, keep the header from treating the press as the start of a window drag.
  button.addEventListener("pointerdown", event => event.stopPropagation());
  button.addEventListener("click", event => {
    event.preventDefault();
    openForActor(actor);
  });
  const toggle = header.querySelector(".mode-slider");
  if ( toggle ) toggle.after(button);
  else header.prepend(button);
}

/** Wire up all hooks. Called during "init". */
export function registerEntryPoints() {
  Hooks.on("renderActorDirectory", onRenderActorDirectory);
  Hooks.on("getHeaderControlsCharacterActorSheet", onGetHeaderControls);
  Hooks.on("renderCharacterActorSheet", onRenderCharacterSheet);
}
