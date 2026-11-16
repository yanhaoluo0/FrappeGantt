function pad(value) {
    return String(value).padStart(2, '0');
}

export function formatDateInput(value) {
    const date = value instanceof Date ? value : new Date(value);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(dateValue, days) {
    const [year, month, day] = dateValue.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);
    return formatDateInput(date);
}

export function toGanttTask(stored) {
    return {
        id: stored.id,
        name: stored.name,
        start: stored.startDate,
        end: stored.endDate,
        progress: Number(stored.progress) || 0,
        dependencies: Array.isArray(stored.dependencies)
            ? stored.dependencies
            : [],
        notes: stored.notes || '',
        sortOrder: Number(stored.sortOrder) || 0,
        createdAt: stored.createdAt,
        updatedAt: stored.updatedAt,
    };
}

export class TaskStore {
    constructor(invoke) {
        this.invoke = invoke;
        this.writeQueue = Promise.resolve();
    }

    list() {
        return this.invoke('list_tasks');
    }

    save(task) {
        return this.enqueue(() => this.invoke('save_task', { task }));
    }

    delete(id) {
        return this.enqueue(() => this.invoke('delete_task', { id }));
    }

    updateDates(id, start, end) {
        return this.enqueue(() =>
            this.invoke('update_task_dates', {
                id,
                startDate: start,
                endDate: end,
            }),
        );
    }

    updateProgress(id, progress) {
        return this.enqueue(() =>
            this.invoke('update_task_progress', { id, progress }),
        );
    }

    flush() {
        return this.writeQueue;
    }

    enqueue(operation) {
        const result = this.writeQueue
            .catch(() => undefined)
            .then(operation);
        this.writeQueue = result.catch(() => undefined);
        return result;
    }
}
