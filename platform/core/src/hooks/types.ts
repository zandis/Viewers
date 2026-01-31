export interface ToolbarButtonActions {
  // Lock/Unlock actions
  lockItem: (itemId: string, viewportId?: string) => void;
  unlockItem: (itemId: string, viewportId?: string) => void;
  toggleLock: (itemId: string, viewportId?: string) => void;
  isItemLocked: (itemId: string, viewportId?: string) => boolean;

  // Visibility actions
  showItem: (itemId: string, viewportId?: string) => void;
  hideItem: (itemId: string, viewportId?: string) => void;
  toggleVisibility: (itemId: string, viewportId?: string) => void;
  isItemVisible: (itemId: string, viewportId?: string) => boolean;

  // Open/Close actions (for menus)
  openItem: (itemId: string, viewportId?: string) => void;
  closeItem: (itemId: string, viewportId?: string) => void;
  closeAllItems: (viewportId?: string) => void;
  isItemOpen: (itemId: string, viewportId?: string) => boolean;

  // Evaluation
  evaluateButtonForViewport: (itemId: string, viewportId?: string) => Record<string, unknown> | null;
}

/** Represents a toolbar button configuration for display */
export interface ToolbarButtonDisplay {
  id: string;
  label?: string;
  icon?: string;
  type?: string;
  props?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Arguments passed to toolbar interaction handlers */
export interface ToolbarInteractionArgs {
  itemId: string;
  interactionType?: string;
  commands?: unknown[];
  [key: string]: unknown;
}

export interface ToolbarHookReturn extends ToolbarButtonActions {
  toolbarButtons: ToolbarButtonDisplay[];
  onInteraction: (args: ToolbarInteractionArgs) => void;
}
