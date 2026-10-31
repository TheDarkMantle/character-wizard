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

/** Add the wizard button to the Actors sidebar header. */
function onRenderActorDirectory(app, html) {
  if ( !canUseWizard() ) return;
  const header = html.querySelector(".directory-header");
  if ( !header || header.querySelector(".charwiz-launch") ) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "charwiz-launch";
  button.innerHTML = `<i class="fa-solid fa-hat-wizard" inert></i> ${game.i18n.localize("CHARWIZ.Launch")}`;
  button.addEventListener("click", () => game.modules.get(MODULE_ID).api.open());
  header.append(button);
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

/** On a level-0 character sheet, show a banner button that starts the wizard. */
function onRenderCharacterSheet(sheet) {
  const actor = sheet.document;
  const content = sheet.element?.querySelector(".window-content");
  content?.querySelector(".charwiz-banner")?.remove();
  if ( !content || !canUseWizard() || !actor?.isOwner || !sheet.isEditable ) return;
  if ( characterLevel(actor) !== 0 ) return;
  const banner = document.createElement("div");
  banner.className = "charwiz-banner";
  banner.innerHTML = `
    <p>${game.i18n.localize("CHARWIZ.Banner.Text")}</p>
    <button type="button"><i class="fa-solid fa-hat-wizard" inert></i> ${game.i18n.localize("CHARWIZ.Banner.Button")}</button>`;
  banner.querySelector("button").addEventListener("click", () => openForActor(actor));
  content.prepend(banner);
}

/** Wire up all hooks. Called during "init". */
export function registerEntryPoints() {
  Hooks.on("renderActorDirectory", onRenderActorDirectory);
  Hooks.on("getHeaderControlsCharacterActorSheet", onGetHeaderControls);
  Hooks.on("renderCharacterActorSheet", onRenderCharacterSheet);
}
