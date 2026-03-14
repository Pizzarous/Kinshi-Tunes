export function createProgressBar(current: number, total: number): string {
    const pos = Math.ceil((current / total) * 15) || 1;

    return `${"█".repeat(pos)}${"░".repeat(15 - pos)}`;
}
