import { describe, expect, it } from 'vitest';
import {
    CHART_VIEW_MODES,
    buildChartOptions,
    getChartContainerHeight,
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
});
