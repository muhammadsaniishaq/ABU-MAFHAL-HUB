/**
 * Global tracker for active system file pickers, cameras, and document pickers.
 * Prevents the app from prematurely locking with PIN when the OS switches AppState
 * to inactive/background during media selection.
 */

let isPickerActive = false;
let pickerStartedAt = 0;

export const setSystemPickerActive = (active: boolean) => {
    isPickerActive = active;
    pickerStartedAt = active ? Date.now() : 0;
};

export const isSystemPickerActive = (): boolean => {
    // Safety auto-expire after 5 minutes in case the picker activity was closed abruptly
    if (isPickerActive && Date.now() - pickerStartedAt > 5 * 60 * 1000) {
        isPickerActive = false;
        pickerStartedAt = 0;
    }
    return isPickerActive;
};

export const safeLaunchPicker = async <T>(pickerAction: () => Promise<T>): Promise<T> => {
    setSystemPickerActive(true);
    try {
        return await pickerAction();
    } finally {
        // Keep active for an extra 1.5 seconds so returning to foreground won't race with AppState
        setTimeout(() => {
            setSystemPickerActive(false);
        }, 1500);
    }
};
