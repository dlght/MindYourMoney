import { Modal, Pressable, Text, View } from "react-native";

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full gap-4 rounded-xl bg-white p-6 dark:bg-slate-800">
          <Text className="text-lg font-semibold text-slate-900 dark:text-white">{title}</Text>
          <Text className="text-slate-600 dark:text-slate-400">{message}</Text>
          <View className="flex-row justify-end gap-4">
            <Pressable onPress={onCancel} accessibilityRole="button">
              <Text className="font-medium text-slate-600 dark:text-slate-400">{cancelLabel}</Text>
            </Pressable>
            <Pressable onPress={onConfirm} accessibilityRole="button">
              <Text className="font-medium text-red-600 dark:text-red-400">{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
