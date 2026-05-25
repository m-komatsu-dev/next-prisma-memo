import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { colors, radius, typography } from "../../theme";

type TextFieldProps = TextInputProps & {
  inputStyle?: StyleProp<TextStyle>;
  label?: string;
};

export function TextField({ inputStyle, label, style, ...props }: TextFieldProps) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor="#a0a8b5"
        style={[styles.input, style, inputStyle]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  label: {
    ...typography.label,
  },
});
