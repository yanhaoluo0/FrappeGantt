import { describe, expect, it } from 'vitest';
import {
    TaskStore,
    addDays,
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
