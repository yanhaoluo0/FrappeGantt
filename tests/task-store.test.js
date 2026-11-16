import { describe, expect, it } from 'vitest';
import {
    TaskStore,
    addDays,
    calculateTaskStatistics,
    countTasksByStatus,
    formatDateInput,
    toGanttTask,
} from '../src/task-store.js';

describe('task mapping', () => {
    it('maps a database task into the shape expected by Gantt', () => {
        const stored = {
            id: 'task-1',
            name: '整理需求',
            startDate: '2026-11-16',
            endDate: '2026-11-18',
            progress: 35,
            dependencies: ['task-0'],
            notes: '先确认范围',
            sortOrder: 2,
            createdAt: '2026-11-16T08:00:00.000Z',
            updatedAt: '2026-11-16T08:00:00.000Z',
        };

        expect(toGanttTask(stored)).toMatchObject({
            id: 'task-1',
            name: '整理需求',
            start: '2026-11-16',
            end: '2026-11-18',
            progress: 35,
            dependencies: ['task-0'],
            notes: '先确认范围',
        });
    });

    it('defaults tasks without a status to pending', () => {
        const task = toGanttTask({
            id: 'task-2',
            name: '未设置状态',
            startDate: '2026-11-16',
            endDate: '2026-11-17',
            progress: 0,
            dependencies: [],
        });

        expect(task.status).toBe('pending');
        expect(task.custom_class).toBe('task-status-pending');
    });

    it('maps each status to its color class', () => {
        const base = {
            name: '状态任务',
            startDate: '2026-11-16',
            endDate: '2026-11-17',
            progress: 0,
            dependencies: [],
        };

        expect(
            toGanttTask({ ...base, id: '1', status: 'completed' }),
        ).toMatchObject({
            status: 'completed',
            custom_class: 'task-status-completed',
        });
        expect(
            toGanttTask({ ...base, id: '2', status: 'delayed' }),
        ).toMatchObject({
            status: 'delayed',
            custom_class: 'task-status-delayed',
        });
        expect(
            toGanttTask({ ...base, id: '3', status: 'on_hold' }),
        ).toMatchObject({
            status: 'on_hold',
            custom_class: 'task-status-on-hold',
        });
    });

    it('calculates overview statistics for empty task data', () => {
        expect(calculateTaskStatistics([])).toEqual({
            total: 0,
            completed: 0,
            pending: 0,
            delayed: 0,
            onHold: 0,
            completionRate: 0,
            averageProgress: 0,
            attentionCount: 0,
        });
    });

    it('calculates mixed task statistics', () => {
        expect(
            calculateTaskStatistics([
                { status: 'completed', progress: 100 },
                { status: 'pending', progress: 40 },
                { status: 'pending', progress: 20 },
                { status: 'delayed', progress: 10 },
                { status: 'on_hold', progress: 0 },
            ]),
        ).toEqual({
            total: 5,
            completed: 1,
            pending: 2,
            delayed: 1,
            onHold: 1,
            completionRate: 20,
            averageProgress: 34,
            attentionCount: 2,
        });
    });

    it('counts every task status for the chart legend', () => {
        expect(
            countTasksByStatus([
                { status: 'completed' },
                { status: 'pending' },
                { status: 'pending' },
                { status: 'delayed' },
                { status: 'on_hold' },
                { status: 'unknown' },
            ]),
        ).toEqual({
            completed: 1,
            pending: 3,
            delayed: 1,
            on_hold: 1,
        });
    });
});

describe('date helpers', () => {
    it('formats a local date without converting it to UTC', () => {
        expect(formatDateInput(new Date(2026, 10, 16, 23, 30))).toBe(
            '2026-11-16',
        );
    });

    it('adds days to a date-only value', () => {
        expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    });
});

describe('write queue', () => {
    it('runs queued database writes in call order', async () => {
        const calls = [];
        let releaseFirst;
        const firstWrite = new Promise((resolve) => {
            releaseFirst = resolve;
        });

        const invoke = async (command, args) => {
            calls.push(command);
            if (command === 'update_task_progress') {
                await firstWrite;
            }
            return args;
        };

        const store = new TaskStore(invoke);
        const first = store.updateProgress('task-1', 40);
        const second = store.updateDates(
            'task-1',
            '2026-11-16',
            '2026-11-20',
        );

        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(calls).toEqual(['update_task_progress']);

        releaseFirst();
        await Promise.all([first, second]);

        expect(calls).toEqual([
            'update_task_progress',
            'update_task_dates',
        ]);
    });
});
