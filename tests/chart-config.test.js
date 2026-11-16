import { describe, expect, it } from 'vitest';
import {
    CHART_VIEW_MODES,
    buildChartOptions,
    getChartContainerHeight,
    getAdjacentViewMode,
    getScrollCenterDate,
} from '../src/chart-config.js';

describe('chart layout', () => {
    it('fills the available panel height instead of sizing only to task rows', () => {
        expect(getChartContainerHeight(640)).toBe(640);
        expect(buildChartOptions(640).container_height).toBe(640);
    });

    it('keeps a usable minimum height in a very short window', () => {
        expect(getChartContainerHeight(120)).toBe(320);
    });
});

describe('chart localization', () => {
    it('uses Chinese labels for every built-in view mode', () => {
        expect(CHART_VIEW_MODES.map((mode) => mode.name)).toEqual([
            '小时',
            '6小时',
            '12小时',
            '日',
            '周',
            '月',
            '年',
        ]);
    });

    it('sets the Gantt locale to Simplified Chinese', () => {
        expect(buildChartOptions(640).language).toBe('zh-CN');
    });

    it('allows scrolling into dates before and after the task range', () => {
        expect(buildChartOptions(640).infinite_padding).toBe(true);
    });

    it('disables unused holiday rendering to avoid SVG node explosion', () => {
        expect(buildChartOptions(640).holidays).toEqual({});
    });

    it('moves one view mode at a time without wrapping', () => {
        expect(getAdjacentViewMode('日', -1)).toBe('12小时');
        expect(getAdjacentViewMode('日', 1)).toBe('周');
        expect(getAdjacentViewMode('小时', -1)).toBeNull();
        expect(getAdjacentViewMode('年', 1)).toBeNull();
    });
});

describe('zoom position', () => {
    it('keeps the date at the horizontal center of the chart', () => {
        const chart = {
            $container: { scrollLeft: 400, clientWidth: 200 },
            dates: new Array(10),
            config: { column_width: 100 },
            gantt_start: new Date(2026, 0, 1),
            gantt_end: new Date(2026, 0, 11),
        };

        expect(getScrollCenterDate(chart)).toEqual(new Date(2026, 0, 6));
    });
});
