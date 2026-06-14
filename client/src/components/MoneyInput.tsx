import { NumberInput, type NumberInputProps } from '@mantine/core'

/**
 * VND money input. Formats as 1.500.000 (dot = thousands, comma = decimal).
 * IMPORTANT: thousandSeparator and decimalSeparator MUST differ, otherwise
 * react-number-format throws and crashes the React tree. VND is integer-only
 * (decimalScale=0), so this is purely cosmetic grouping.
 */
export function MoneyInput(props: NumberInputProps) {
  return (
    <NumberInput
      thousandSeparator="."
      decimalSeparator=","
      decimalScale={0}
      allowNegative={false}
      min={0}
      {...props}
    />
  )
}
