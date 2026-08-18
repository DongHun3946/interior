import type { InputHTMLAttributes } from "react";

type IntegerInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "value" | "onChange"
> & {
  value: string | number;
  onValueChange: (digits: string) => void;
};

const onlyDigits = (value: string) =>
  value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");

const integerValue = (value: string | number) => {
  const text = String(value);
  if (text.includes(".") && Number.isFinite(Number(text)))
    return String(Math.round(Number(text)));
  return onlyDigits(text);
};

export default function IntegerInput({
  value,
  onValueChange,
  ...props
}: IntegerInputProps) {
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={integerValue(value)}
      onChange={(event) => onValueChange(onlyDigits(event.target.value))}
    />
  );
}
