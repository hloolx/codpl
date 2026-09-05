import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SectionCard } from '@/components/layout/section-card';
import { BarLeaderboardChart } from '@/components/charts/bar-leaderboard-chart';
import { CompositeModelTooltip, CompositeProviderTooltip, ModelChartTooltip, ProviderChartTooltip } from '@/components/charts/tooltips';
import { LeaderboardRow } from '@/components/leaderboard/leaderboard-row';
import { MetricInfoHint } from '@/components/leaderboard/metric-info-hint';
import { SegmentedControl } from '@/components/leaderboard/segmented-control';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBenchmarkData } from '@/hooks/use-benchmark-data';
import { useEnrichedResults, useProviderAverages } from '@/hooks/use-derived';
import { formatNumber } from '@/lib/format';
import { clampTtftValue } from '@/lib/metric-axis';
import { TTFT_CHART_MAX } from '@/lib/constants';

type Mode = 'model' | 'provider';

const MODE_OPTIONS = [
  { value: 'model' as const, label: '按模型' },
  { value: 'provider' as const, label: '按厂家' },
];

const leaderboardCardClassName = 'flex h-full min-h-0 flex-col overflow-hidden';
const leaderboardContentClassName = 'flex min-h-0 flex-1 flex-col';
const leaderboardListClassName =
  'flex max-h-[60vh] min-h-0 flex-col gap-2 overflow-y-auto pr-1 scrollbar-thin sm:max-h-[560px] xl:max-h-none xl:flex-1';

function useIsDesktopLeaderboardLayout() {
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(min-width: 1280px)').matches,
  );

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1280px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isDesktop;
}

function useElementHeight<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => setHeight(el.getBoundingClientRect().height);
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, height] as const;
}

export function LeaderboardsRoute() {
  const { latest, loading } = useBenchmarkData();
  const enriched = useEnrichedResults(latest);
  const providerAverages = useProviderAverages(enriched);
  const isDesktopLeaderboardLayout = useIsDesktopLeaderboardLayout();
  const [compositeChartRef, compositeChartHeight] = useElementHeight<HTMLDivElement>();
  const [tpsChartRef, tpsChartHeight] = useElementHeight<HTMLDivElement>();
  const [ttftChartRef, ttftChartHeight] = useElementHeight<HTMLDivElement>();

  const [compositeMode, setCompositeMode] = useState<Mode>('model');
  const [tpsMode, setTpsMode] = useState<Mode>('model');
  const [ttftMode, setTtftMode] = useState<Mode>('model');

  const compositeSorted = useMemo(() => [...enriched].sort((l, r) => r.compositeScore - l.compositeScore), [enriched]);
  const compositeProviderSorted = useMemo(
    () => [...providerAverages].sort((l, r) => r.compositeScore - l.compositeScore),
    [providerAverages],
  );

  const ttftSortedModels = useMemo(
    () => enriched.filter((item) => Number.isFinite(item.avgTtft) && item.avgTtft > 0).sort((l, r) => l.avgTtft - r.avgTtft),
    [enriched],
  );
  const ttftSortedProviders = useMemo(
    () => providerAverages.filter((item) => Number.isFinite(item.averageTtft) && item.averageTtft > 0).sort((l, r) => l.averageTtft - r.averageTtft),
    [providerAverages],
  );

  const tpsChartModels = useMemo(() => [...enriched].sort((l, r) => (r.medianTps || r.avgTps || 0) - (l.medianTps || l.avgTps || 0)), [enriched]);
  const tpsChartProviders = providerAverages;

  const ttftChartModels = useMemo(
    () => ttftSortedModels.map((item) => ({ ...item, avgTtftChart: clampTtftValue(item.avgTtft) })),
    [ttftSortedModels],
  );
  const ttftChartProviders = useMemo(
    () => ttftSortedProviders.map((item) => ({ ...item, averageTtftChart: clampTtftValue(item.averageTtft) })),
    [ttftSortedProviders],
  );

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">排行榜</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">基于最近一轮拨测结果：综合评分、MedianTPS、TTFT 三种口径，模型与厂家视角可切换。</p>
      </div>

      <Tabs defaultValue="composite">
        <TabsList>
          <TabsTrigger value="composite">综合</TabsTrigger>
          <TabsTrigger value="tps">TPS</TabsTrigger>
          <TabsTrigger value="ttft">TTFT</TabsTrigger>
        </TabsList>

        {/* === 综合 === */}
        <TabsContent value="composite" className="mt-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="min-h-0" style={isDesktopLeaderboardLayout && compositeChartHeight ? { height: compositeChartHeight } : undefined}>
              <SectionCard
                title={
                  <>
                    综合排行榜
                    <MetricInfoHint metric="composite" label="查看综合评分算法" />
                  </>
                }
                subtitle="综合评分 = TPS 分 × 0.6 + TTFT 分 × 0.4，兼顾生成速度与首字响应。"
                action={<SegmentedControl options={MODE_OPTIONS} value={compositeMode} onChange={setCompositeMode} />}
                className={leaderboardCardClassName}
                contentClassName={leaderboardContentClassName}
              >
                <div className={leaderboardListClassName}>
                  {loading && !compositeSorted.length ? (
                    <div className="text-sm text-muted-foreground">正在加载…</div>
                  ) : compositeMode === 'provider' ? (
                    compositeProviderSorted.map((item, index) => (
                      <LeaderboardRow
                        key={`composite-provider-${item.provider}`}
                        rank={index + 1}
                        mode="provider"
                        provider={item.provider}
                        model={item.model}
                        modelCount={item.modelCount}
                        hasThinking={item.hasThinking}
                        hasAnomaly={item.hasAnomaly}
                        primary={<>{formatNumber(item.compositeScore)} 分</>}
                        secondary={
                          <>
                            TPS {formatNumber(item.averageMedianTps || item.averageTps)} · TTFT {formatNumber(item.averageTtft, 0)} ms
                          </>
                        }
                      />
                    ))
                  ) : (
                    compositeSorted.map((item, index) => (
                      <LeaderboardRow
                        key={`composite-${item.provider}-${item.model}`}
                        rank={index + 1}
                        mode="model"
                        provider={item.provider}
                        model={item.model}
                        displayName={item.normalizedModelDisplay}
                        hasThinking={item.hasThinking}
                        hasAnomaly={item.abnormalTps}
                        primary={<>{formatNumber(item.compositeScore)} 分</>}
                        secondary={
                          <>
                            TPS {formatNumber(item.medianTps || item.avgTps)} · TTFT {formatNumber(item.avgTtft, 0)} ms
                          </>
                        }
                      />
                    ))
                  )}
                </div>
              </SectionCard>
            </div>

            <div ref={compositeChartRef}>
              <SectionCard
                title="综合评分柱状图"
                subtitle="按厂家平均与模型逐一展示，便于左右对照排行榜。"
              >
                <div className="flex flex-col gap-6">
                  <div>
                    <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">厂家平均</div>
                    <BarLeaderboardChart
                      data={compositeProviderSorted.map((item) => ({ ...item, label: item.provider }))}
                      dataKey="compositeScore"
                      mode="provider"
                      metric="composite"
                      tooltipContent={<CompositeProviderTooltip />}
                    />
                  </div>
                  <div>
                    <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">模型逐一</div>
                    <BarLeaderboardChart
                      data={compositeSorted}
                      dataKey="compositeScore"
                      mode="model"
                      metric="composite"
                      tooltipContent={<CompositeModelTooltip />}
                    />
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        </TabsContent>

        {/* === TPS === */}
        <TabsContent value="tps" className="mt-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="min-h-0" style={isDesktopLeaderboardLayout && tpsChartHeight ? { height: tpsChartHeight } : undefined}>
              <SectionCard
                title={
                  <>
                    TPS 排行榜
                    <MetricInfoHint metric="tps" label="查看 TPS 含义" />
                  </>
                }
                subtitle={tpsMode === 'provider' ? '按厂商聚合，展示多个模型的平均 MedianTPS。' : '最近一次拨测全部模型的 MedianTPS。'}
                action={<SegmentedControl options={MODE_OPTIONS} value={tpsMode} onChange={setTpsMode} />}
                className={leaderboardCardClassName}
                contentClassName={leaderboardContentClassName}
              >
                <div className={leaderboardListClassName}>
                  {loading && !enriched.length ? (
                    <div className="text-sm text-muted-foreground">正在加载…</div>
                  ) : tpsMode === 'provider' ? (
                    providerAverages.map((item, index) => (
                      <LeaderboardRow
                        key={`tps-provider-${item.provider}`}
                        rank={index + 1}
                        mode="provider"
                        provider={item.provider}
                        model={item.model}
                        modelCount={item.modelCount}
                        hasThinking={item.hasThinking}
                        hasAnomaly={item.hasAnomaly}
                        primary={<>{formatNumber(item.averageMedianTps || item.averageTps)} tok/s</>}
                        secondary={<>TTFT {formatNumber(item.averageTtft, 0)} ms</>}
                      />
                    ))
                  ) : (
                    tpsChartModels.map((item, index) => (
                      <LeaderboardRow
                        key={`tps-model-${item.provider}-${item.model}`}
                        rank={index + 1}
                        mode="model"
                        provider={item.provider}
                        model={item.model}
                        displayName={item.normalizedModelDisplay}
                        hasThinking={item.hasThinking}
                        hasAnomaly={item.abnormalTps}
                        primary={<>{formatNumber(item.medianTps || item.avgTps)} tok/s</>}
                        secondary={<>TTFT {formatNumber(item.avgTtft, 0)} ms</>}
                      />
                    ))
                  )}
                </div>
              </SectionCard>
            </div>

            <div ref={tpsChartRef}>
              <SectionCard title="TPS 柱状图" subtitle="同一张图内对照厂家平均与模型平均。">
                <div className="flex flex-col gap-6">
                  <div>
                    <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">厂家平均 MedianTPS</div>
                    <BarLeaderboardChart
                      data={tpsChartProviders.map((item) => ({ ...item, label: item.provider }))}
                      dataKey="averageMedianTps"
                      mode="provider"
                      metric="tps"
                      tooltipContent={<ProviderChartTooltip />}
                    />
                  </div>
                  <div>
                    <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">模型平均 MedianTPS</div>
                    <BarLeaderboardChart
                      data={tpsChartModels}
                      dataKey="medianTps"
                      mode="model"
                      metric="tps"
                      tooltipContent={<ModelChartTooltip />}
                    />
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        </TabsContent>

        {/* === TTFT === */}
        <TabsContent value="ttft" className="mt-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="min-h-0" style={isDesktopLeaderboardLayout && ttftChartHeight ? { height: ttftChartHeight } : undefined}>
              <SectionCard
                title={
                  <>
                    TTFT 排行榜
                    <MetricInfoHint metric="ttft" label="查看 TTFT 含义" />
                  </>
                }
                subtitle={ttftMode === 'provider' ? '按厂商聚合平均 TTFT，越低越靠前。' : '按模型排序平均 TTFT，越低越靠前。'}
                action={<SegmentedControl options={MODE_OPTIONS} value={ttftMode} onChange={setTtftMode} />}
                className={leaderboardCardClassName}
                contentClassName={leaderboardContentClassName}
              >
                <div className={leaderboardListClassName}>
                  {loading && !enriched.length ? (
                    <div className="text-sm text-muted-foreground">正在加载…</div>
                  ) : ttftMode === 'provider' ? (
                    ttftSortedProviders.map((item, index) => (
                      <LeaderboardRow
                        key={`ttft-provider-${item.provider}`}
                        rank={index + 1}
                        mode="provider"
                        provider={item.provider}
                        model={item.model}
                        modelCount={item.modelCount}
                        hasThinking={item.hasThinking}
                        hasAnomaly={item.hasAnomaly}
                        primary={<>{formatNumber(item.averageTtft, 0)} ms</>}
                        secondary={<>{formatNumber(item.averageMedianTps || item.averageTps)} tok/s</>}
                      />
                    ))
                  ) : (
                    ttftSortedModels.map((item, index) => (
                      <LeaderboardRow
                        key={`ttft-model-${item.provider}-${item.model}`}
                        rank={index + 1}
                        mode="model"
                        provider={item.provider}
                        model={item.model}
                        displayName={item.normalizedModelDisplay}
                        hasThinking={item.hasThinking}
                        hasAnomaly={item.abnormalTps}
                        primary={<>{formatNumber(item.avgTtft, 0)} ms</>}
                        secondary={<>{formatNumber(item.medianTps || item.avgTps)} tok/s</>}
                      />
                    ))
                  )}
                </div>
              </SectionCard>
            </div>

            <div ref={ttftChartRef}>
              <SectionCard
                title="TTFT 柱状图"
                subtitle={`按厂家与模型分别展示平均 TTFT；柱状图最高显示 ${TTFT_CHART_MAX} ms。`}
              >
                <div className="flex flex-col gap-6">
                  <div>
                    <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">厂家平均 TTFT</div>
                    <BarLeaderboardChart
                      data={ttftChartProviders.map((item) => ({ ...item, label: item.provider }))}
                      dataKey="averageTtftChart"
                      mode="provider"
                      metric="ttft"
                      tooltipContent={<ProviderChartTooltip metric="ttft" />}
                    />
                  </div>
                  <div>
                    <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">模型平均 TTFT</div>
                    <BarLeaderboardChart
                      data={ttftChartModels}
                      dataKey="avgTtftChart"
                      mode="model"
                      metric="ttft"
                      tooltipContent={<ModelChartTooltip metric="ttft" />}
                    />
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
