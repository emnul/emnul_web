// What the detector read from the Moiré magnifier's last settled renders, beside what the
// Parameters set, so a visitor can judge it: scale error, rotation and whether the image sinks
// or floats, the spectrum it measured with the peak marked, and pass or fail.
import { useEffect, useId, useRef } from "react";
import type { Detection, Sign, Spectrum } from "./detector";

export interface Reading {
  /**
   * What the Parameters set: the scale error against the design, rotation in degrees, and
   * whether the image sinks or floats, which it does neither of at a scale ratio of exactly 1.
   */
  truth: { scaleError: number; rotation: number; sign?: Sign };
  detection: Detection;
  /** Time taken to render the views, read them back and detect. */
  milliseconds: number;
}

interface Props {
  /** Undefined until the first reading. */
  reading?: Reading;
  /** The largest scale error that passes, as a fraction. */
  tolerance: number;
}

/** Shown on screen at this many CSS pixels per spectrum bin. */
const BIN_SIZE = 2.5;

export default function DetectorPanel({ reading, tolerance }: Props) {
  const headingId = useId();
  const detection = reading?.detection;
  const estimate = detection?.status === "ok" ? detection : undefined;
  const pending = reading ? "—" : "Measuring…";

  return (
    <section
      aria-labelledby={headingId}
      className="not-prose mt-8 rounded-lg border border-gray-200 p-4 sm:p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id={headingId} className="text-base font-semibold text-gray-900">
          Detector
        </h2>
        {detection && <Verdict pass={detection.pass} />}
      </div>
      <p className="mt-1 text-sm text-gray-600">
        Measured from the rendered pixels alone, without knowing which icon is
        drawn, each time you let go of a control. A second render a small tilt
        away tells sinking from floating. Passes within ±
        {formatPercent(tolerance, 1, false)} scale error.
      </p>

      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
        {detection && (
          <SpectrumView spectrum={detection.spectrum} peak={estimate?.peak} />
        )}
        <div className="min-w-0 flex-1">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th scope="col" className="pb-2 font-normal">
                  <span className="sr-only">Quantity</span>
                </th>
                <th scope="col" className="pb-2 text-right font-normal">
                  True
                </th>
                <th scope="col" className="pb-2 text-right font-normal">
                  Estimated
                </th>
              </tr>
            </thead>
            <tbody className="text-gray-900">
              <tr className="border-b border-gray-100">
                <th scope="row" className="py-2 text-left font-medium">
                  Scale error
                </th>
                <td className="py-2 text-right">
                  {reading ? formatPercent(reading.truth.scaleError, 2) : "—"}
                </td>
                <td className="py-2 text-right">
                  {estimate ? formatPercent(estimate.scaleError, 2) : pending}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <th scope="row" className="py-2 text-left font-medium">
                  Rotation
                </th>
                <td className="py-2 text-right">
                  {reading ? formatDegrees(reading.truth.rotation) : "—"}
                </td>
                <td className="py-2 text-right">
                  {estimate ? formatDegrees(estimate.rotation) : pending}
                </td>
              </tr>
              <tr>
                <th scope="row" className="py-2 text-left font-medium">
                  Image
                </th>
                <td className="py-2 text-right">
                  {reading?.truth.sign ? signLabels[reading.truth.sign] : "—"}
                </td>
                <td className="py-2 text-right">
                  {estimate ? signLabels[estimate.sign] : pending}
                </td>
              </tr>
            </tbody>
          </table>
          {detection?.status === "out-of-range" && (
            <p className="mt-3 text-sm text-gray-600">
              Too few moiré periods fit in the frame to measure: the scale ratio
              is too near 1.
            </p>
          )}
          {reading && (
            <p className="mt-3 text-xs text-gray-500">
              Rendered twice, read back and measured in{" "}
              {Math.round(reading.milliseconds)} ms.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Verdict({ pass }: { pass: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${
        pass ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
      }`}
    >
      {pass ? "Pass" : "Fail"}
    </span>
  );
}

/**
 * The spectrum near zero frequency as a heat map, frequency increasing up and to the right,
 * with the measured peak and its mirror through zero ringed.
 */
function SpectrumView({
  spectrum,
  peak,
}: {
  spectrum: Spectrum;
  peak?: { u: number; v: number };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { radius } = spectrum;
  const side = 2 * radius + 1;

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const { magnitudes } = spectrum;
    // From the median, most bins' level, to the strongest, so the peaks stand out of the floor.
    const sorted = magnitudes.toSorted();
    const floor = sorted[Math.floor(sorted.length / 2)];
    const range = sorted[sorted.length - 1] - floor || 1;
    const image = context.createImageData(side, side);
    for (let row = 0; row < side; row++) {
      // The spectrum's rows count up from v = −radius; the canvas's count down.
      const from = (side - 1 - row) * side;
      for (let column = 0; column < side; column++) {
        const level = Math.round(
          255 * Math.max(0, (magnitudes[from + column] - floor) / range),
        );
        const i = (row * side + column) * 4;
        image.data[i] = level;
        image.data[i + 1] = level;
        image.data[i + 2] = level;
        image.data[i + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
  }, [spectrum, side]);

  const label = peak
    ? `Magnitude spectrum near zero frequency, with the moiré peak measured at ${peak.u.toFixed(2)} cycles across and ${peak.v.toFixed(2)} up the frame`
    : "Magnitude spectrum near zero frequency, with no moiré peak to measure";

  return (
    <figure className="shrink-0">
      <div
        className="relative overflow-hidden rounded bg-black"
        style={{ width: side * BIN_SIZE, height: side * BIN_SIZE }}
      >
        <canvas
          ref={canvasRef}
          width={side}
          height={side}
          role="img"
          aria-label={label}
          className="block size-full [image-rendering:pixelated]"
        />
        {peak && (
          // Bin centres sit on whole numbers; y runs down, so a frequency's v is negated.
          <svg
            viewBox={`${-radius - 0.5} ${-radius - 0.5} ${side} ${side}`}
            aria-hidden="true"
            className="absolute inset-0 size-full"
          >
            {[1, -1].map((sign) => (
              <circle
                key={sign}
                cx={sign * peak.u}
                cy={-sign * peak.v}
                r={2.5}
                fill="none"
                stroke="#fbbf24"
                strokeWidth={0.5}
              />
            ))}
          </svg>
        )}
      </div>
      <figcaption
        className="mt-2 text-xs text-gray-500"
        style={{ maxWidth: side * BIN_SIZE }}
      >
        Spectrum near zero frequency.{" "}
        {peak
          ? "Rings mark the moiré peak measured."
          : "No moiré peak to ring."}
      </figcaption>
    </figure>
  );
}

const signLabels: Record<Sign, string> = { sinks: "Sinks", floats: "Floats" };

/** A fraction as a signed percentage, such as "+0.20%"; zero after rounding is unsigned. */
function formatPercent(fraction: number, decimals: number, signed = true) {
  return `${formatSigned(fraction * 100, decimals, signed)}%`;
}

/** Degrees, signed, to the hundredth the rotation slider steps by. */
function formatDegrees(degrees: number) {
  return `${formatSigned(degrees, 2, true)}°`;
}

function formatSigned(value: number, decimals: number, signed: boolean) {
  const rounded = Math.abs(value).toFixed(decimals);
  if (!signed || Number(rounded) === 0) return rounded;
  // A true minus sign, the width of the plus.
  return `${value < 0 ? "−" : "+"}${rounded}`;
}
