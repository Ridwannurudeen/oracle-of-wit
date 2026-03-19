// Oracle of Wit — ES Module Entry Point
// This file wires up late bindings and boots the app.

import { render, renderLeftWingContent, renderRightWingContent } from './render.js';
import { bindRender, bindLeaveRoom, bindRenderLeftWingContent, bindRenderRightWingContent, bindHandlePhaseChange, bindSyncTimer } from './api.js';
import { bindEffectsRender } from './effects.js';
import { leaveRoom, handlePhaseChange, syncTimer, detectChallenge } from './app.js';

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
render();
