import { ActionSheetIOS } from 'react-native';

export interface SheetAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

// iOS shows a list of choices in an action sheet, not a stacked alert — alerts
// are for confirmations. Cancel is appended automatically and placed last,
// matching the platform convention, so callers list only real actions.
export function showActionSheet(title: string | undefined, actions: SheetAction[]): void {
  const options = [...actions.map((action) => action.label), 'Cancel'];
  const cancelButtonIndex = options.length - 1;
  const destructiveButtonIndex = actions.findIndex((action) => action.destructive);
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title,
      options,
      cancelButtonIndex,
      ...(destructiveButtonIndex >= 0 ? { destructiveButtonIndex } : {}),
    },
    (index) => {
      if (index === cancelButtonIndex || index === undefined) return;
      actions[index]?.onPress();
    },
  );
}
