import { DEFAULT_VIEW_MODES } from '../../gantt/src/defaults.js';

const VIEW_MODE_NAMES = {
    Hour: '小时',
    'Quarter Day': '6小时',
    'Half Day': '12小时',
    Day: '日',
    Week: '周',
    Month: '月',
    Year: '年',
};

export const CHART_VIEW_MODES = DEFAULT_VIEW_MODES.map((mode) => ({
    ...mode,
    name: VIEW_MODE_NAMES[mode.name] || mode.name,
}));

export function getChartContainerHeight(panelHeight) {
    return Math.max(320, Math.floor(Number(panelHeight) || 0));
}

export function buildChartOptions(panelHeight, handlers = {}) {
    return {
        language: 'zh-CN',
        view_mode: CHART_VIEW_MODES.find((mode) => mode.name === '日'),
        view_modes: CHART_VIEW_MODES,
        view_mode_select: true,
        scroll_to: 'today',
        infinite_padding: false,
        container_height: getChartContainerHeight(panelHeight),
        today_button: true,
        show_expected_progress: true,
        bar_height: 34,
        padding: 20,
        column_width: 48,
        readonly: false,
        readonly_progress: false,
        readonly_dates: false,
        on_date_change: handlers.onDateChange,
        on_progress_change: handlers.onProgressChange,
        on_double_click: handlers.onDoubleClick,
    };
}
