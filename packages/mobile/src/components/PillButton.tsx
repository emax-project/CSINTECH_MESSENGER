import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/mobbin';

type Variant = 'primary' | 'outline' | 'soft';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  style?: ViewStyle;
};

/** button-primary / button-outline / button-pill-soft — 전부 rounded.full 스타디움 필 */
export default function PillButton({ label, onPress, loading, disabled, variant = 'primary', style }: Props) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      style={[styles.base, variantStyles[variant], isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.ink} />
      ) : (
        <Text style={[styles.label, variant === 'primary' ? styles.labelOnPrimary : styles.labelOnLight]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  label: { ...typography.link },
  labelOnPrimary: { color: colors.onPrimary },
  labelOnLight: { color: colors.ink },
});

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  outline: { backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.hairline },
  soft: { backgroundColor: colors.canvasSoft },
};
