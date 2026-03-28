/**
 * @module main
 * @description ES Module entry point. Wires up late-binding references to break
 * circular dependency chains between render, api, effects, and app modules,
 * then boots the application.
 */

import { render, renderLeftWingContent, renderRightWingContent } from './render.js';
import { bindRender, bindLeaveRoom, bindRenderLeftWingContent, bindRenderRightWingContent, bindHandlePhaseChange, bindSyncTimer } from './api.js';
import { bindEffectsRender } from './effects.js';
import { leaveRoom, handlePhaseChange, syncTimer, detectChallenge, checkTutorial, detectReferral } from './app.js';

// Side-effect import: registers all event listeners
import './events.js';

// Wire up late bindings (breaks circular dependency chains)
bindRender(render);
bindEffectsRender(render);
bindLeaveRoom(leaveRoom);
bindRenderLeftWingContent(renderLeftWingContent);
bindRenderRightWingContent(renderRightWingContent);
bindHandlePhaseChange(handlePhaseChange);
bindSyncTimer(syncTimer);

// Boot
detectChallenge();
detectReferral();
checkTutorial();
render();
