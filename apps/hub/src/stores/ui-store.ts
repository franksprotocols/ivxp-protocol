import { create } from "zustand";

interface UiStoreState {
  readonly inspectorOpen: boolean;
}

interface UiStoreActions {
  readonly toggleInspector: () => void;
  readonly setInspectorOpen: (open: boolean) => void;
}

type UiStore = UiStoreState & UiStoreActions;

export const useUiStore = create<UiStore>((set) => ({
  inspectorOpen: false,

  toggleInspector: () => {
    set((state) => ({ inspectorOpen: !state.inspectorOpen }));
  },

  setInspectorOpen: (open: boolean) => {
    set({ inspectorOpen: open });
  },
}));
