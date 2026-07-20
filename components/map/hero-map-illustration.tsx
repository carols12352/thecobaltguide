/**
 * Static hero map mirroring MapLibre Liberty: light basemap, #2563eb pins.
 */
const PINS = [
  { x: 14, y: 18 },
  { x: 22, y: 26 },
  { x: 31, y: 16 },
  { x: 39, y: 24 },
  { x: 48, y: 14 },
  { x: 56, y: 22 },
  { x: 67, y: 18 },
  { x: 18, y: 38 },
  { x: 29, y: 44 },
  { x: 43, y: 36 },
  { x: 54, y: 42 },
  { x: 66, y: 38 },
  { x: 76, y: 30 },
  { x: 24, y: 56 },
  { x: 36, y: 62 },
  { x: 49, y: 54 },
  { x: 61, y: 58 },
  { x: 73, y: 52 },
  { x: 82, y: 44 },
  { x: 33, y: 74 },
  { x: 47, y: 70 },
  { x: 58, y: 76 },
] as const;

const CLUSTERS = [
  { x: 26, y: 32, r: 3.6, count: "12" },
  { x: 52, y: 28, r: 4.2, count: "28" },
  { x: 44, y: 48, r: 3.4, count: "9" },
  { x: 68, y: 64, r: 3.8, count: "16" },
] as const;

export function HeroMapIllustration() {
  return (
    <div
      data-testid="hero-map-illustration"
      aria-hidden="true"
      className="relative h-full min-h-[22rem] overflow-hidden bg-[#f4f1ea] lg:min-h-[36rem]"
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <rect width="100" height="100" fill="#f4f1ea" />

        <rect x="58" y="6" width="26" height="18" rx="0.5" fill="#cde5c4" />
        <rect x="4" y="52" width="20" height="16" rx="0.5" fill="#d3e8cb" />
        <rect x="78" y="40" width="14" height="12" rx="0.5" fill="#d7ebcf" />
        <path
          d="M34 8c7-2 12 2 18 1 5-1 9-5 14-3 2 5 1 12-2 16-7 3-13 1-19 3-5 2-10 7-15 5 0-7 2-14 4-22Z"
          fill="#d7ebcf"
        />

        <path d="M64 100C72 80 84 70 100 62V100H64Z" fill="#a9d0de" />
        <path d="M66 100C74 82 86 72 100 65" stroke="#8eb8c8" strokeWidth="0.3" opacity="0.55" />

        <g stroke="#e4ddd2" strokeWidth="0.16">
          <path d="M0 16H100M0 32H100M0 48H100M0 64H100M0 80H100" />
          <path d="M16 0V100M32 0V100M48 0V100M64 0V100M80 0V100" />
        </g>

        <g stroke="#d5cfc4" strokeLinecap="round" fill="none">
          <path d="M-5 14C16 28 28 6 46 16S76 4 105 14" strokeWidth="2.2" />
          <path d="M-5 42C14 36 30 54 48 46S76 32 105 42" strokeWidth="2" />
          <path d="M-5 70C18 62 36 78 54 70S82 56 105 66" strokeWidth="1.7" />
          <path d="M26 -5C32 16 20 36 28 56S42 80 34 105" strokeWidth="1.8" />
          <path d="M58 -5C52 18 66 38 58 58S46 80 54 105" strokeWidth="1.6" />
          <path d="M84 -5C78 22 90 42 82 62S70 84 78 105" strokeWidth="1.4" />
        </g>

        <g stroke="#ffffff" strokeLinecap="round" fill="none">
          <path d="M-5 14C16 28 28 6 46 16S76 4 105 14" strokeWidth="1.2" />
          <path d="M-5 42C14 36 30 54 48 46S76 32 105 42" strokeWidth="1.1" />
          <path d="M-5 70C18 62 36 78 54 70S82 56 105 66" strokeWidth="0.95" />
          <path d="M26 -5C32 16 20 36 28 56S42 80 34 105" strokeWidth="1" />
          <path d="M58 -5C52 18 66 38 58 58S46 80 54 105" strokeWidth="0.9" />
        </g>

        <g fill="#e8e2d8" opacity="0.9">
          <rect x="10" y="20" width="5" height="3.2" rx="0.2" />
          <rect x="17" y="21" width="6" height="2.8" rx="0.2" />
          <rect x="40" y="24" width="7" height="3.6" rx="0.2" />
          <rect x="62" y="34" width="5" height="3" rx="0.2" />
          <rect x="30" y="58" width="6" height="3.4" rx="0.2" />
          <rect x="70" y="48" width="5.5" height="2.8" rx="0.2" />
        </g>

        {PINS.map((pin) => (
          <circle
            key={`${pin.x}-${pin.y}`}
            cx={pin.x}
            cy={pin.y}
            r="1.7"
            fill="#2563eb"
            stroke="#ffffff"
            strokeWidth="0.4"
          />
        ))}

        {CLUSTERS.map((cluster) => (
          <g key={cluster.count}>
            <circle
              cx={cluster.x}
              cy={cluster.y}
              r={cluster.r}
              fill="#2563eb"
              stroke="#ffffff"
              strokeWidth="0.45"
            />
            <text
              x={cluster.x}
              y={cluster.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#ffffff"
              style={{
                fontSize: 2.6,
                fontWeight: 700,
                fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
              }}
            >
              {cluster.count}
            </text>
          </g>
        ))}
      </svg>

      <div className="absolute right-3 top-3 overflow-hidden rounded-md border border-black/10 bg-white shadow-sm">
        <div className="flex h-7 w-7 items-center justify-center border-b border-zinc-200 text-base leading-none text-zinc-700">
          +
        </div>
        <div className="flex h-7 w-7 items-center justify-center text-base leading-none text-zinc-700">
          −
        </div>
      </div>

      <div className="absolute bottom-[18%] left-[10%] w-[13.5rem] rounded-2xl border border-black/5 bg-white p-3 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08),0_12px_28px_-4px_rgba(0,0,0,0.12)]">
        <p className="text-sm font-semibold leading-snug text-zinc-950">Nearby merchant</p>
        <p className="mt-1 text-xs leading-5 text-zinc-500">Toronto, ON</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[0.6875rem] font-medium text-blue-800">
            5×
          </span>
          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[0.6875rem] font-medium text-emerald-800">
            High confidence
          </span>
        </div>
      </div>
    </div>
  );
}
