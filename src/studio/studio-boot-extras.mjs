/* KELO-INDEX
 * area: STUDIO / ENTRY EXTRAS
 * owner: Kelo Studio lazy boot extras
 * owns: desktop keyboard/productivity controllers loaded after Studio core
 * does-not-own: kernel, tools, live shell, placement touch, world authority
 * reuse: bootKeloStudio() dynamically imports this after the World-open core graph
 * mobile: kept out of the first Studio request wave so iPhone can keep the launch chrome
 */
export { createStudioNudgeController } from './input/studio-nudge-controller.mjs';
export { createStudioOverlapCycleController } from './input/studio-overlap-cycle-controller.mjs';
export { createStudioAssetKeyboardController } from './input/studio-asset-keyboard-controller.mjs';
export { createStudioPrecisionSnapController } from './input/studio-precision-snap-controller.mjs';
export { createStudioSelectionHistoryController } from './input/studio-selection-history-controller.mjs';
export { createStudioFocusShortcutController } from './input/studio-focus-shortcut-controller.mjs';
export { createStudioQuickActionsController } from './input/studio-quick-actions-controller.mjs';
export { createStudioKeyboardDeleteController } from './input/studio-keyboard-delete-controller.mjs';
export { createStudioKeyboardDuplicateController } from './input/studio-keyboard-duplicate-controller.mjs';
export { createStudioKeyboardHistoryController } from './input/studio-keyboard-history-controller.mjs';
export { createStudioKeyboardClipboardController } from './input/studio-keyboard-clipboard-controller.mjs';
export { createStudioSelectAllController } from './input/studio-select-all-controller.mjs';
export { createStudioExplorerRevealController } from './input/studio-explorer-reveal-controller.mjs';
export { createStudioPropertyCommitController } from './input/studio-property-commit-controller.mjs';
export { createStudioSnapCycleController } from './input/studio-snap-cycle-controller.mjs';
export { createStudioMenuMinimizer } from './ui/studio-menu-minimizer.mjs';
export { createStudioCleanWorkspace } from './ui/studio-clean-workspace.mjs';
export { createStudioContextInspector } from './ui/studio-context-inspector.mjs';
export { createStudioContextSnapChip } from './ui/studio-context-snap-chip.mjs';
export { createStudioAssetFavorites } from './ui/studio-asset-favorites.mjs';
export { createStudioMultiAlign } from './ui/studio-multi-align.mjs';
export { createStudioHistoryHints } from './ui/studio-history-hints.mjs';
export { createStudioTransformPresets } from './ui/studio-transform-presets.mjs';
