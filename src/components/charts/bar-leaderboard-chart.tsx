import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { palette } from '@/lib/palette';
import { ProviderGlyph, ModelGlyph } from '@/components/provider/glyph';
import { getMetricAxisProps } from '@/lib/metric-axis';
import { cn } from '@/lib/cn';

type Mode = 'model' | 'provider';
type Metric = 'tps' | 'ttft' | 'composite';
type LayoutMode = 'auto' | 'fit' | 'scroll';

export interface BarLeaderboardDatumBase {
  provider: string;
  model?: string;
  normalizedModelDisplay?: string;
}

interface BarLeaderboardProps<T extends BarLeaderboardDatumBase> {
  data: T[];
  dataKey: string;
  mode: Mode;
  metric: Metric;
  tooltipContent: ReactNode;
  height?: number;
}

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

// 每根柱子（含图标+文字）所需要的最小横向空间。
// 低于这个阈值就一定重叠，所以进入 scroll 模式。
const MIN_SLOT_MOBILE = 48;
const MIN_SLOT_DESKTOP = 64;

// 鼠标按下 → 实际开始拖拽的距离阈值（px）。小于它的移动仍然当成点击/hover
// 交给 Recharts 去处理 tooltip。
const DRAG_THRESHOLD = 4;

export function BarLeaderboardChart<T extends BarLeaderboardDatumBase>({
  data,
  dataKey,
  mode,
  metric,
  tooltipContent,
  height,
}: BarLeaderboardProps<T>) {
  const isMobile = useIsMobile();
  const effectiveHeight = height ?? (isMobile ? 220 : 300);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [wrapperWidth, setWrapperWidth] = useState(0);
  const [manualMode, setManualMode] = useState<LayoutMode>('auto');
  const [scrollState, setScrollState] = useState({ left: 0, max: 0 });

  // 监听外层容器宽度以判断是否需要滚动
  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    setWrapperWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWrapperWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const minSlot = isMobile ? MIN_SLOT_MOBILE : MIN_SLOT_DESKTOP;
  const requiredWidth = data.length * minSlot + 80; // 80 ≈ 给 Y 轴留出空间
  const autoScroll = wrapperWidth > 0 && requiredWidth > wrapperWidth;
  const effectiveMode: 'fit' | 'scroll' =
    manualMode === 'auto' ? (autoScroll ? 'scroll' : 'fit') : manualMode;

  const innerWidth =
    effectiveMode === 'scroll' ? Math.max(wrapperWidth || requiredWidth, requiredWidth) : wrapperWidth;

  // 拖拽 / 滚轮 横向平移
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || effectiveMode !== 'scroll') return;

    const updateScrollState = () => {
      setScrollState({ left: el.scrollLeft, max: el.scrollWidth - el.clientWidth });
    };
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });

    // 鼠标滚轮纵向 → 横向。只有在确实可滚动时劫持，避免挡住页面的自然滚动。
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      // 用户已经在做横向滚动（deltaX 非 0），不干预
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      // 到达边界后不再劫持，让外层页面可以继续纵向滚动
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1 && e.deltaY > 0;
      if (atStart || atEnd) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('scroll', updateScrollState);
      el.removeEventListener('wheel', onWheel as EventListener);
    };
  }, [effectiveMode]);

  // 鼠标拖拽横向平移：用 pointer capture 阻止 Recharts 在拖拽中接收 mousemove。
  // 只有移动距离超过阈值才真正开始拖拽，否则让 Recharts 的 tooltip 正常响应。
  const dragState = useRef({
    armed: false,
    pointerId: -1,
    startX: 0,
    startScrollLeft: 0,
  });
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (effectiveMode !== 'scroll') return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const el = scrollRef.current;
      if (!el) return;
      dragState.current = {
        armed: true,
        pointerId: event.pointerId,
        startX: event.clientX,
        startScrollLeft: el.scrollLeft,
      };
    },
    [effectiveMode],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = dragState.current;
      if (!state.armed || state.pointerId !== event.pointerId) return;
      const el = scrollRef.current;
      if (!el) return;
      const dx = event.clientX - state.startX;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        setDragging(true);
        try {
          el.setPointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
      }
      el.scrollLeft = state.startScrollLeft - dx;
    },
    [dragging],
  );

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = dragState.current;
      if (state.pointerId !== event.pointerId) return;
      const el = scrollRef.current;
      if (el && dragging) {
        try {
          el.releasePointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
      }
      dragState.current = { armed: false, pointerId: -1, startX: 0, startScrollLeft: 0 };
      setDragging(false);
    },
    [dragging],
  );

  const scrollBy = useCallback((delta: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }, []);

  const axisKey = mode === 'provider' ? 'provider' : 'normalizedModelDisplay';
  const metricAxis =
    metric === 'ttft'
      ? getMetricAxisProps('ttft')
      : metric === 'composite'
        ? {
            domain: [0, 100] as [number, number],
            tickFormatter: (v: number) => v.toFixed(0),
            allowDataOverflow: false,
          }
        : getMetricAxisProps('tps');

  const showLabelText = data.length <= (isMobile ? 6 : 12);
  const xAxisHeight = showLabelText ? (isMobile ? 40 : 52) : (isMobile ? 24 : 30);
  const hasOverflow = effectiveMode === 'scroll' && innerWidth > wrapperWidth;
  const showLeftFade = hasOverflow && scrollState.left > 4;
  const showRightFade = hasOverflow && scrollState.left < scrollState.max - 4;

  const chart = useMemo(
    () => (
      <BarChart
        data={data}
        width={effectiveMode === 'scroll' ? innerWidth : undefined}
        height={effectiveMode === 'scroll' ? effectiveHeight : undefined}
        margin={{ top: 8, right: 8, left: isMobile ? 4 : 16, bottom: isMobile ? 18 : 24 }}
      >
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" vertical={false} opacity={0.6} />
        <XAxis
          dataKey={axisKey}
          interval={effectiveMode === 'scroll' ? 0 : isMobile ? 'preserveStartEnd' : 0}
          tickLine={false}
          axisLine={false}
          tick={<BarXAxisTick mode={mode} data={data} isMobile={isMobile} showText={showLabelText} axisHeight={xAxisHeight} />}
          height={xAxisHeight}
        />
        <YAxis
          {...metricAxis}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isMobile ? 10 : 11 }}
          width={isMobile ? 32 : 44}
        />
        <Tooltip content={tooltipContent as any} cursor={{ fill: 'hsl(var(--primary) / 0.06)' }} />
        <Bar dataKey={dataKey} radius={[6, 6, 0, 0]} maxBarSize={isMobile ? 28 : 40}>
          {data.map((item, index) => (
            <Cell key={`${String(item[axisKey])}-${index}`} fill={palette[index % palette.length]} />
          ))}
        </Bar>
      </BarChart>
    ),
    [data, dataKey, axisKey, mode, metric, tooltipContent, isMobile, effectiveMode, innerWidth, effectiveHeight, showLabelText, metricAxis],
  );

  if (!data.length) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground sm:h-[240px]">
        暂无数据
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <ChartModeToggle
        mode={manualMode}
        auto={autoScroll ? 'scroll' : 'fit'}
        onChange={setManualMode}
      />

      <div
        ref={scrollRef}
        className={cn(
          'relative overflow-y-hidden scrollbar-thin',
          effectiveMode === 'scroll' ? 'overflow-x-auto' : 'overflow-x-hidden',
          effectiveMode === 'scroll' && 'cursor-grab touch-pan-x select-none',
          dragging && 'cursor-grabbing',
        )}
        style={{ height: effectiveHeight }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {effectiveMode === 'scroll' ? (
          <div style={{ width: innerWidth, height: effectiveHeight }}>{chart}</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chart}
          </ResponsiveContainer>
        )}
      </div>

      {/* 左右渐隐提示 + 快捷翻页按钮 */}
      {showLeftFade ? (
        <button
          type="button"
          onClick={() => scrollBy(-Math.max(wrapperWidth * 0.7, 240))}
          aria-label="向左浏览"
          className="pointer-events-auto absolute left-0 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background/90 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      ) : null}
      {showRightFade ? (
        <button
          type="button"
          onClick={() => scrollBy(Math.max(wrapperWidth * 0.7, 240))}
          aria-label="向右浏览"
          className="pointer-events-auto absolute right-0 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background/90 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : null}
      {showLeftFade ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent" aria-hidden="true" />
      ) : null}
      {showRightFade ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent" aria-hidden="true" />
      ) : null}

      {effectiveMode === 'scroll' ? (
        <div className="pointer-events-none absolute bottom-0 right-0 bg-background/70 px-1 text-right text-[10px] text-muted-foreground/80 backdrop-blur-sm">
          可横向拖动 / 滚轮 / 滑动浏览全部 {data.length} 项
        </div>
      ) : null}
    </div>
  );
}

interface ChartModeToggleProps {
  mode: LayoutMode;
  auto: 'fit' | 'scroll';
  onChange: (mode: LayoutMode) => void;
}

function ChartModeToggle({ mode, auto, onChange }: ChartModeToggleProps) {
  const resolved: 'fit' | 'scroll' = mode === 'auto' ? auto : mode;
  const next: LayoutMode = resolved === 'scroll' ? 'fit' : 'scroll';
  const label = resolved === 'scroll' ? '切到紧凑视图' : '展开全部横向浏览';
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      aria-label={label}
      title={label}
      className="absolute right-0 top-0 z-10 inline-flex h-6 items-center gap-1 rounded-md border border-border/60 bg-background/80 px-1.5 text-[10px] font-medium text-muted-foreground backdrop-blur hover:text-foreground"
    >
      {resolved === 'scroll' ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
      {resolved === 'scroll' ? '紧凑' : '展开'}
    </button>
  );
}

interface BarXAxisTickProps {
  x?: number;
  y?: number;
  payload?: { value: unknown };
  mode: Mode;
  data: BarLeaderboardDatumBase[];
  isMobile: boolean;
  showText: boolean;
  axisHeight: number;
}

function BarXAxisTick({ x = 0, y = 0, payload, mode, data, isMobile, showText, axisHeight }: BarXAxisTickProps) {
  if (!payload) return null;
  const value = String(payload.value ?? '');
  const record = data.find((d) => {
    if (mode === 'provider') return d.provider === value;
    return d.normalizedModelDisplay === value;
  });
  const provider = record?.provider || '';
  const model = record?.model || '';
  const maxLen = isMobile ? 6 : 10;
  const label = value.length > maxLen ? `${value.slice(0, maxLen)}…` : value;
  const glyphSize = isMobile ? 14 : 18;
  const glyphContainerHeight = glyphSize + 4;
  const glyphY = showText ? 2 : Math.max(0, (axisHeight - glyphContainerHeight) / 2);
  const textY = isMobile ? 26 : 34;
  return (
    <g transform={`translate(${x}, ${y + 2})`}>
      <foreignObject
        x={-(glyphSize + 6)}
        y={glyphY}
        width={(glyphSize + 6) * 2}
        height={glyphContainerHeight}
        style={{ overflow: 'visible' }}
      >
        <div className="flex items-center justify-center">
          {mode === 'provider' ? (
            <ProviderGlyph provider={provider} model={model} size={glyphSize} />
          ) : (
            <ModelGlyph provider={provider} model={model} size={glyphSize} />
          )}
        </div>
      </foreignObject>
      {showText ? (
        <text
          x={0}
          y={textY}
          textAnchor="middle"
          fill="hsl(var(--muted-foreground))"
          fontSize={isMobile ? 9 : 10}
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}
