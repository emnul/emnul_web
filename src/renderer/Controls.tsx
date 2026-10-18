// One Control per Parameter (ADR 0011), on native inputs styled like the site: a slider for a
// `number`, radio buttons for a `choice`. It holds no state: the caller passes each Parameter's
// current value and hears about every change.
import { useId } from "react";
// Types only: the contract's schemas use Zod, which mustn't ship to the browser.
import type { Parameter } from "../shader-core/contract";
import type { ParameterValues } from "./renderer";

interface Props {
  /** The Shader's Parameters, in frontmatter order. */
  parameters: readonly Parameter[];
  /** Each Parameter's current value. */
  values: ParameterValues;
  /** Called with a Parameter's new value as the visitor changes it, including mid-drag. */
  onChange: (name: string, value: number) => void;
  className?: string;
}

export default function Controls({
  parameters,
  values,
  onChange,
  className,
}: Props) {
  return (
    <div className={`grid gap-x-8 gap-y-4 sm:grid-cols-2 ${className ?? ""}`}>
      {parameters.map((parameter) => (
        <Control
          key={parameter.name}
          parameter={parameter}
          value={values[parameter.name] ?? parameter.default}
          onChange={(value) => onChange(parameter.name, value)}
        />
      ))}
    </div>
  );
}

interface ControlProps<P extends Parameter> {
  parameter: P;
  value: number;
  onChange: (value: number) => void;
}

/** The Control for one Parameter, by its type; a new type gets a new case. */
function Control({ parameter, ...props }: ControlProps<Parameter>) {
  switch (parameter.type) {
    case "number":
      return <Slider parameter={parameter} {...props} />;
    case "choice":
      return <RadioButtons parameter={parameter} {...props} />;
    default:
      return parameter satisfies never;
  }
}

function Slider({
  parameter: { label, min, max, step },
  value,
  onChange,
}: ControlProps<Extract<Parameter, { type: "number" }>>) {
  const id = useId();
  // As many decimals as the step has, so the readout doesn't jitter in width while dragging.
  const decimals = String(step).split(".")[1]?.length ?? 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <label htmlFor={id} className="font-medium text-gray-900">
          {label}
        </label>
        <output htmlFor={id} className="text-gray-500 tabular-nums">
          {value.toFixed(decimals)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
        className="w-full accent-gray-900"
      />
    </div>
  );
}

function RadioButtons({
  parameter: { label, options },
  value,
  onChange,
}: ControlProps<Extract<Parameter, { type: "choice" }>>) {
  // Names the group, so its radios exclude each other and no other Shader's on the page.
  const name = useId();
  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className="mb-1 text-sm font-medium text-gray-900">
        {label}
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {options.map((option, index) => (
          // Options are fixed and may repeat, so their index is the key.
          <label key={index} className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name={name}
              checked={value === index}
              onChange={() => onChange(index)}
              className="accent-gray-900"
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
