import { useState, type ComponentProps } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { Parameter } from "../shader-core/contract";
import Controls from "./Controls";

const roots: Root[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  document.body.replaceChildren();
});

type Props = ComponentProps<typeof Controls>;

/** Holds the values the Controls show, as a page does, so each change shows. */
function StatefulControls({ values: initial, onChange, ...props }: Props) {
  const [values, setValues] = useState(initial);
  return (
    <Controls
      {...props}
      values={values}
      onChange={(name, value) => {
        setValues((current) => ({ ...current, [name]: value }));
        onChange(name, value);
      }}
    />
  );
}

/** Renders the Controls into the page, reporting each change to the returned mock. */
function render(props: Omit<Props, "onChange">) {
  const onChange = vi.fn<(name: string, value: number) => void>();
  const root = createRoot(
    document.body.appendChild(document.createElement("div")),
  );
  roots.push(root);
  flushSync(() =>
    root.render(<StatefulControls {...props} onChange={onChange} />),
  );
  return onChange;
}

const speed = {
  type: "number",
  name: "speed",
  label: "Speed",
  default: 1,
  min: 0,
  max: 2,
  step: 0.1,
} satisfies Parameter;

test("a number Parameter gets a labelled slider within its range and step", async () => {
  render({ parameters: [speed], values: { speed: 1.5 } });

  const slider = page.getByRole("slider", { name: "Speed" });
  await expect.element(slider).toHaveAttribute("min", "0");
  await expect.element(slider).toHaveAttribute("max", "2");
  await expect.element(slider).toHaveAttribute("step", "0.1");
  await expect.element(slider).toHaveValue("1.5");
});

test("moving a slider reports the Parameter's new value", async () => {
  const onChange = render({ parameters: [speed], values: { speed: 1.5 } });

  // Focused rather than clicked: a click would also move the thumb to where it lands.
  page.getByRole("slider", { name: "Speed" }).element().focus();
  await userEvent.keyboard("{ArrowRight}");

  expect(onChange).toHaveBeenLastCalledWith("speed", 1.6);
});

const shape = {
  type: "choice",
  name: "shape",
  label: "Shape",
  options: ["Circle", "Square", "Star"],
  default: 0,
} satisfies Parameter;

test("a key press on a slider is a finished change, reported after its new value", async () => {
  const onSettle = vi.fn<() => void>();
  const onChange = render({
    parameters: [speed],
    values: { speed: 1.5 },
    onSettle,
  });

  page.getByRole("slider", { name: "Speed" }).element().focus();
  await userEvent.keyboard("{ArrowRight}");

  expect(onSettle).toHaveBeenCalledOnce();
  expect(onChange.mock.invocationCallOrder[0]).toBeLessThan(
    onSettle.mock.invocationCallOrder[0],
  );
});

test("a choice Parameter gets a labelled radio group with one radio per option", async () => {
  render({ parameters: [shape], values: { shape: 1 } });

  const group = page.getByRole("group", { name: "Shape" });
  await expect
    .element(group.getByRole("radio", { name: "Circle" }))
    .not.toBeChecked();
  await expect
    .element(group.getByRole("radio", { name: "Square" }))
    .toBeChecked();
  await expect
    .element(group.getByRole("radio", { name: "Star" }))
    .not.toBeChecked();
});

test("picking an option reports its index", async () => {
  const onChange = render({ parameters: [shape], values: { shape: 1 } });

  await userEvent.click(page.getByRole("radio", { name: "Star" }));

  expect(onChange).toHaveBeenLastCalledWith("shape", 2);
});

test("picking an option is a finished change", async () => {
  const onSettle = vi.fn<() => void>();
  render({ parameters: [shape], values: { shape: 1 }, onSettle });

  await userEvent.click(page.getByRole("radio", { name: "Star" }));

  expect(onSettle).toHaveBeenCalledOnce();
});
