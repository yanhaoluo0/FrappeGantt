import { invoke } from '@tauri-apps/api/core';
import '@fontsource/exo/latin-400.css';
import '@fontsource/exo/latin-500.css';
import '@fontsource/exo/latin-600.css';
import '@fontsource/exo/latin-700.css';
import '@fontsource/roboto-mono/latin-400.css';
import '@fontsource/roboto-mono/latin-500.css';
import Gantt from '../../gantt/src/index.js';
import {
    TaskStore,
    addDays,
    calculateTaskStatistics,
    countTasksByStatus,
    formatDateInput,
    normalizeTaskStatus,
    toGanttTask,
} from './task-store.js';
import {
    buildChartOptions,
    getAdjacentViewMode,
    getChartContainerHeight,
    getScrollCenterDate,
} from './chart-config.js';
import './styles.css';

const taskStore = new TaskStore(invoke);
const timelinePanel = document.querySelector('.timeline-stage');
const ganttHost = document.querySelector('#gantt');
const emptyState = document.querySelector('#empty-state');
const saveStatus = document.querySelector('#save-status');
const taskCount = document.querySelector('#task-count');
const statsTrigger = document.querySelector('#stats-trigger');
const statsDialog = document.querySelector('#stats-dialog');
const statsClose = document.querySelector('#stats-close');
const statsCloseIcon = document.querySelector('#stats-close-icon');
const statsTotal = document.querySelector('#stats-total');
const statsCompletion = document.querySelector('#stats-completion');
const statsAverage = document.querySelector('#stats-average');
const statsAttention = document.querySelector('#stats-attention');
const statsDistributionCaption = document.querySelector(
    '#stats-distribution-caption',
);
const statsInsight = document.querySelector('#stats-insight-text');
const statsElements = {
    completed: {
        count: document.querySelector('#stats-count-completed'),
        share: document.querySelector('#stats-share-completed'),
        bar: document.querySelector('#stats-bar-completed'),
    },
    pending: {
        count: document.querySelector('#stats-count-pending'),
        share: document.querySelector('#stats-share-pending'),
        bar: document.querySelector('#stats-bar-pending'),
    },
    delayed: {
        count: document.querySelector('#stats-count-delayed'),
        share: document.querySelector('#stats-share-delayed'),
        bar: document.querySelector('#stats-bar-delayed'),
    },
    on_hold: {
        count: document.querySelector('#stats-count-on-hold'),
        share: document.querySelector('#stats-share-on-hold'),
        bar: document.querySelector('#stats-bar-on-hold'),
    },
};
const statusCounts = {
    completed: document.querySelector('#count-completed'),
    pending: document.querySelector('#count-pending'),
    delayed: document.querySelector('#count-delayed'),
    on_hold: document.querySelector('#count-on-hold'),
};
const newTaskButton = document.querySelector('#new-task-button');
const emptyCreateButton = document.querySelector('#empty-create-button');
const taskDialog = document.querySelector('#task-dialog');
const taskForm = document.querySelector('#task-form');
const dialogTitle = document.querySelector('#dialog-title');
const nameInput = document.querySelector('#task-name');
const startInput = document.querySelector('#task-start');
const endInput = document.querySelector('#task-end');
const statusInputs = document.querySelectorAll('input[name="status"]');
const progressInput = document.querySelector('#task-progress');
const progressOutput = document.querySelector('#progress-output');
const dependenciesInput = document.querySelector('#task-dependencies');
const notesInput = document.querySelector('#task-notes');
const formError = document.querySelector('#form-error');
const deleteButton = document.querySelector('#delete-task-button');
const saveButton = document.querySelector('#save-task-button');
const cancelButton = document.querySelector('#dialog-cancel');
const cancelIconButton = document.querySelector('#dialog-cancel-icon');

let chart = null;
let tasks = [];
let editingTaskId = null;
let activeWrites = 0;
let resizeTimer = null;
let zoomLocked = false;

const STATUS_LABELS = {
    completed: '完成',
    pending: '未完成',
    delayed: '延期',
    on_hold: '搁置',
};

function setSaveStatus(message, state = 'idle') {
    saveStatus.textContent = message;
    saveStatus.dataset.state = state;
}

function updateTaskSummary() {
    const counts = countTasksByStatus(tasks);
    taskCount.textContent = `${tasks.length} 项任务`;
    Object.entries(counts).forEach(([status, count]) => {
        statusCounts[status].textContent = String(count);
    });
}

function updateStatistics() {
    const statistics = calculateTaskStatistics(tasks);
    statsTotal.textContent = String(statistics.total);
    statsCompletion.textContent = String(statistics.completionRate);
    statsAverage.textContent = String(statistics.averageProgress);
    statsAttention.textContent = String(statistics.attentionCount);
    statsDistributionCaption.textContent = `${statistics.total} 项任务`;

    const counts = {
        completed: statistics.completed,
        pending: statistics.pending,
        delayed: statistics.delayed,
        on_hold: statistics.onHold,
    };

    Object.entries(counts).forEach(([status, count]) => {
        const percentage = statistics.total
            ? Math.round((count / statistics.total) * 100)
            : 0;
        const elements = statsElements[status];
        elements.count.textContent = String(count);
        elements.share.textContent = `${percentage}%`;
        elements.bar.style.width = `${percentage}%`;
        elements.bar.parentElement.setAttribute(
            'aria-valuenow',
            String(percentage),
        );
    });

    if (statistics.total === 0) {
        statsInsight.textContent = '当前暂无任务数据。';
    } else if (statistics.delayed > 0) {
        statsInsight.textContent = `有 ${statistics.delayed} 项任务处于延期状态，建议优先检查计划。`;
    } else if (statistics.onHold > 0) {
        statsInsight.textContent = `有 ${statistics.onHold} 项任务处于搁置状态。`;
    } else if (statistics.completionRate === 100) {
        statsInsight.textContent = '全部任务已完成，当前计划进展良好。';
    } else {
        statsInsight.textContent = `当前完成率为 ${statistics.completionRate}%，平均进度为 ${statistics.averageProgress}%。`;
    }
}

function openStatistics() {
    updateStatistics();
    statsDialog.showModal();
}

function closeStatistics() {
    statsDialog.close();
}

function trackWrite(operation) {
    activeWrites += 1;
    setSaveStatus('正在保存…', 'saving');

    return operation
        .then(() => {
            activeWrites -= 1;
            if (activeWrites === 0) {
                setSaveStatus('已保存到本机', 'saved');
            }
        })
        .catch((error) => {
            activeWrites = Math.max(0, activeWrites - 1);
            console.error(error);
            setSaveStatus('保存失败，请重试', 'error');
        });
}

function taskEndDate(task) {
    if (task._end instanceof Date) {
        return formatDateInput(new Date(task._end.getTime() - 1000));
    }
    return formatDateInput(task.end);
}

function formatChineseDate(date) {
    return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(date);
}

function showChinesePopup(context) {
    context.set_title(context.task.name);
    context.set_subtitle(context.task.notes || '');

    const endDate = new Date(context.task._end.getTime() - 1000);
    const duration = Math.max(
        1,
        Math.round(Number(context.task.actual_duration) || 1),
    );
    const progress = Math.round(Number(context.task.progress) || 0);
    const status = STATUS_LABELS[context.task.status] || STATUS_LABELS.pending;

    context.set_details(
        `开始：${formatChineseDate(context.task._start)}<br>` +
            `结束：${formatChineseDate(endDate)}<br>` +
            `工期：${duration} 天<br>` +
            `进度：${progress}%<br>` +
            `状态：${status}`,
    );
}

function localizeGanttControls() {
    const todayButton = ganttHost.querySelector('.today-button');
    if (todayButton) todayButton.textContent = '今天';

    const viewSelect = ganttHost.querySelector('.side-header select');
    const placeholder = viewSelect?.querySelector('option[disabled]');
    if (placeholder) placeholder.textContent = '时间范围';
}

function resizeChart() {
    if (!chart) return;
    const height = getChartContainerHeight(timelinePanel.clientHeight);
    if (height === chart.options.container_height) return;

    chart.options.container_height = height;
    chart.change_view_mode(undefined, true);
    localizeGanttControls();
}

function changeChartScale(direction) {
    if (!chart) return;
    const centerDate = getScrollCenterDate(chart);
    const nextMode = getAdjacentViewMode(
        chart.config.view_mode.name,
        direction,
    );
    if (!nextMode) return;

    chart.change_view_mode(nextMode);
    chart.set_scroll_position(centerDate);
    chart.$container.scrollLeft = Math.max(
        0,
        chart.$container.scrollLeft - chart.$container.clientWidth / 2,
    );
    localizeGanttControls();
}

function renderChart() {
    const ganttTasks = tasks;
    updateTaskSummary();
    emptyState.hidden = ganttTasks.length !== 0;
    ganttHost.classList.toggle('is-empty', ganttTasks.length === 0);

    if (!chart) {
        chart = new Gantt(
            '#gantt',
            ganttTasks,
            buildChartOptions(timelinePanel.clientHeight, {
                onDateChange(task, start, end) {
                    void trackWrite(
                        taskStore.updateDates(
                            task.id,
                            formatDateInput(start),
                            formatDateInput(end),
                        ),
                    );
                },
                onProgressChange(task, progress) {
                    void trackWrite(
                        taskStore.updateProgress(task.id, Number(progress)),
                    );
                },
                onDoubleClick(task) {
                    openTaskDialog(task);
                },
            }),
        );
        if (chart.options.view_mode.name !== '日') {
            chart.change_view_mode('日');
        }
        chart.options.popup = showChinesePopup;
        localizeGanttControls();
        return;
    }

    chart.refresh(ganttTasks);
    localizeGanttControls();
}

new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resizeChart, 120);
}).observe(timelinePanel);

ganttHost.addEventListener(
    'wheel',
    (event) => {
        if (!event.ctrlKey || !chart) return;
        event.preventDefault();
        event.stopPropagation();
        if (zoomLocked || event.deltaY === 0) return;

        zoomLocked = true;
        changeChartScale(event.deltaY < 0 ? -1 : 1);
        window.setTimeout(() => {
            zoomLocked = false;
        }, 180);
    },
    { passive: false, capture: true },
);

async function reloadTasks() {
    try {
        const storedTasks = await taskStore.list();
        tasks = storedTasks.map(toGanttTask);
        renderChart();
    } catch (error) {
        console.error(error);
        setSaveStatus('无法读取本机数据库', 'error');
        emptyState.hidden = false;
        emptyState.querySelector('h2').textContent = '数据库暂时无法读取';
        emptyState.querySelector('p').textContent =
            '请关闭应用后重新打开，或将错误信息反馈给开发者。';
        emptyCreateButton.hidden = true;
    }
}

function populateDependencies(task) {
    dependenciesInput.replaceChildren();
    const selected = new Set(task?.dependencies || []);

    for (const candidate of tasks) {
        if (candidate.id === task?.id) continue;
        const option = document.createElement('option');
        option.value = candidate.id;
        option.textContent = candidate.name;
        option.selected = selected.has(candidate.id);
        dependenciesInput.append(option);
    }

    if (dependenciesInput.options.length === 0) {
        const option = document.createElement('option');
        option.textContent = '暂无其他任务可作为前置任务';
        option.disabled = true;
        dependenciesInput.append(option);
    }
}

function openTaskDialog(task = null) {
    const today = formatDateInput(new Date());
    editingTaskId = task?.id || null;
    taskForm.reset();
    formError.textContent = '';
    dialogTitle.textContent = task ? '编辑任务' : '新建任务';
    deleteButton.hidden = !task;

    nameInput.value = task?.name || '';
    startInput.value = task
        ? formatDateInput(task._start || task.start)
        : today;
    endInput.value = task ? taskEndDate(task) : addDays(today, 2);
    const selectedStatus = normalizeTaskStatus(task?.status);
    statusInputs.forEach((input) => {
        input.checked = input.value === selectedStatus;
    });
    progressInput.value = String(Math.round(Number(task?.progress) || 0));
    progressOutput.value = `${progressInput.value}%`;
    notesInput.value = task?.notes || '';
    populateDependencies(task);

    taskDialog.showModal();
    requestAnimationFrame(() => {
        nameInput.focus();
        nameInput.select();
    });
}

function closeTaskDialog() {
    taskDialog.close();
    editingTaskId = null;
}

function formFailure(message) {
    formError.textContent = message;
    formError.scrollIntoView({ block: 'nearest' });
}

async function saveFormTask(event) {
    event.preventDefault();
    formError.textContent = '';

    const name = nameInput.value.trim();
    const startDate = startInput.value;
    const endDate = endInput.value;

    if (!name) {
        formFailure('请输入任务名称。');
        nameInput.focus();
        return;
    }
    if (!startDate || !endDate) {
        formFailure('请选择开始日期和结束日期。');
        return;
    }
    if (endDate < startDate) {
        formFailure('结束日期不能早于开始日期。');
        endInput.focus();
        return;
    }

    const existing = tasks.find((task) => task.id === editingTaskId);
    const selectedStatus = Array.from(statusInputs).find(
        (input) => input.checked,
    );
    const now = new Date().toISOString();
    const task = {
        id: editingTaskId || crypto.randomUUID(),
        name,
        status: normalizeTaskStatus(selectedStatus?.value),
        startDate,
        endDate,
        progress: Number(progressInput.value),
        dependencies: Array.from(dependenciesInput.selectedOptions)
            .filter((option) => !option.disabled)
            .map((option) => option.value),
        notes: notesInput.value.trim(),
        sortOrder: existing?.sortOrder ?? tasks.length,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
    };

    saveButton.disabled = true;
    deleteButton.disabled = true;
    await trackWrite(taskStore.save(task));
    saveButton.disabled = false;
    deleteButton.disabled = false;

    if (saveStatus.dataset.state === 'error') {
        formFailure('保存失败，当前填写内容仍保留在弹窗中。');
        return;
    }

    closeTaskDialog();
    await reloadTasks();
}

async function deleteCurrentTask() {
    if (!editingTaskId) return;
    const task = tasks.find((item) => item.id === editingTaskId);
    const confirmed = window.confirm(
        `删除“${task?.name || '这项任务'}”？这会同时移除其他任务对它的依赖。`,
    );
    if (!confirmed) return;

    saveButton.disabled = true;
    deleteButton.disabled = true;
    await trackWrite(taskStore.delete(editingTaskId));
    saveButton.disabled = false;
    deleteButton.disabled = false;

    if (saveStatus.dataset.state !== 'error') {
        closeTaskDialog();
        await reloadTasks();
    }
}

newTaskButton.addEventListener('click', () => openTaskDialog());
statsTrigger.addEventListener('click', openStatistics);
statsClose.addEventListener('click', closeStatistics);
statsCloseIcon.addEventListener('click', closeStatistics);
emptyCreateButton.addEventListener('click', () => openTaskDialog());
taskForm.addEventListener('submit', saveFormTask);
deleteButton.addEventListener('click', deleteCurrentTask);
cancelButton.addEventListener('click', closeTaskDialog);
cancelIconButton.addEventListener('click', closeTaskDialog);
progressInput.addEventListener('input', () => {
    progressOutput.value = `${progressInput.value}%`;
});
taskDialog.addEventListener('cancel', () => {
    editingTaskId = null;
});

const appStartedAt = performance.now();
const minimumBootDuration = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
).matches
    ? 0
    : 650;

void reloadTasks().finally(() => {
    const remaining = Math.max(
        0,
        minimumBootDuration - (performance.now() - appStartedAt),
    );
    window.setTimeout(() => {
        document.body.classList.add('is-ready');
    }, remaining);
});
