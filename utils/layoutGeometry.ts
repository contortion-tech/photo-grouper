import type { SlotPosition } from './templates';

export interface LayoutDivider {
    id: string;
    axis: 'x' | 'y';
    position: number;
    start: number;
    end: number;
    beforeIds: string[];
    afterIds: string[];
    min: number;
    max: number;
}
const EPSILON = 0.02;
const near = (a: number, b: number) => Math.abs(a - b) < EPSILON;
const extent = (slot: SlotPosition, axis: 'x' | 'y') => axis === 'x' ? slot.width : slot.height;
const cross = (axis: 'x' | 'y') => axis === 'x' ? 'y' : 'x';

/** Finds safe shared edges, including local dividers at T junctions. Coordinates are percentages. */
export function getLayoutDividers(slots: SlotPosition[], minimumSize = 10): LayoutDivider[] {
    const result: LayoutDivider[] = [];
    for (const axis of ['x', 'y'] as const) {
        const perpendicular = cross(axis);
        const positions: number[] = [];
        for (const slot of slots) {
            const position = slot[axis] + extent(slot, axis);
            if (position > EPSILON && position < 100 - EPSILON && !positions.some((value) => near(value, position))) positions.push(position);
        }
        for (const position of positions) {
            const before = slots.filter((slot) => near(slot[axis] + extent(slot, axis), position));
            const after = slots.filter((slot) => near(slot[axis], position));
            const candidates = [...before, ...after].sort((a, b) => a[perpendicular] - b[perpendicular]);
            const groups: SlotPosition[][] = [];
            let end = -Infinity;
            for (const slot of candidates) {
                if (slot[perpendicular] > end + EPSILON) groups.push([]);
                groups[groups.length - 1].push(slot);
                end = Math.max(end, slot[perpendicular] + extent(slot, perpendicular));
            }
            for (const group of groups) {
                const left = before.filter((slot) => group.includes(slot));
                const right = after.filter((slot) => group.includes(slot));
                if (!left.length || !right.length) continue;
                const start = Math.min(...group.map((slot) => slot[perpendicular]));
                const finish = Math.max(...group.map((slot) => slot[perpendicular] + extent(slot, perpendicular)));
                const covers = (items: SlotPosition[]) => {
                    let cursor = start;
                    for (const item of [...items].sort((a, b) => a[perpendicular] - b[perpendicular])) {
                        if (!near(item[perpendicular], cursor)) return false;
                        cursor = item[perpendicular] + extent(item, perpendicular);
                    }
                    return near(cursor, finish);
                };
                if (!covers(left) || !covers(right)) continue;
                const min = Math.max(...left.map((slot) => slot[axis] + minimumSize));
                const max = Math.min(...right.map((slot) => slot[axis] + extent(slot, axis) - minimumSize));
                if (min > max || position < min - EPSILON || position > max + EPSILON) continue;
                const beforeIds = left.map((slot) => slot.id).sort();
                const afterIds = right.map((slot) => slot.id).sort();
                result.push({ id: `${axis}:${beforeIds.join(',')}:${afterIds.join(',')}`, axis, position, start, end: finish, beforeIds, afterIds, min, max });
            }
        }
    }
    return result;
}

/** Returns new slot rectangles. Stale or invalid dividers leave the layout unchanged. */
export function moveLayoutDivider(slots: SlotPosition[], divider: LayoutDivider, requestedPosition: number): SlotPosition[] {
    if (!Number.isFinite(requestedPosition)) return slots;
    const current = getLayoutDividers(slots).find((candidate) => candidate.id === divider.id);
    if (!current) return slots;
    const position = Math.max(current.min, Math.min(current.max, requestedPosition));
    const dimension = current.axis === 'x' ? 'width' : 'height';
    return slots.map((slot) => {
        if (current.beforeIds.includes(slot.id)) return { ...slot, [dimension]: position - slot[current.axis] };
        if (current.afterIds.includes(slot.id)) return { ...slot, [current.axis]: position, [dimension]: slot[current.axis] + slot[dimension] - position };
        return slot;
    });
}
