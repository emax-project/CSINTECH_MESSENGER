import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/mobbin';

type Props = TextInputProps & {
  label: string;
  hint?: string;
};

/** text-input / text-input-focused — 평상시 테두리 없는 field 틴트, 포커스 시에만 2px 잉크 링 */
export default function AuthTextInput({ label, hint, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, focused && styles.inputFocused, style]}
        placeholderTextColor={colors.textFaint}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: spacing.md },
  label: { ...typography.label, color: colors.ink, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.field,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.ink,
  },
  inputFocused: {
    borderColor: colors.ink,
  },
  hint: { ...typography.caption, color: colors.textFaint, marginTop: spacing.xs },
});
