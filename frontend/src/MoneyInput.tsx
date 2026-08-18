import type { InputHTMLAttributes } from "react";

type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "value" | "onChange"
> & {
  value: string | number;
  onValueChange: (digits: string) => void;
};

const onlyDigits = (value: string) =>
  value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");

const withThousandsSeparator = (value: string | number) => {
  const digits = onlyDigits(String(value));
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export default function MoneyInput({
  value,
  onValueChange,
  ...props
}: MoneyInputProps) {
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      pattern="[0-9,]*"
      value={withThousandsSeparator(value)}
      onChange={(event) => onValueChange(onlyDigits(event.target.value))}
    />
  );
}
